import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DocumentoResponse,
  TOM_SITUACAO,
} from '../../../../contracts/documentos/documento.contracts';
import {
  ArquivoProposta,
  PropostaDetalhe,
} from '../../../../contracts/propostas/proposta.contracts';
import { DocumentosService } from '../../../../services/documentos/documentos.service';
import { PropostasService } from '../../../../services/propostas/propostas.service';
import { ModalShellComponent } from '../../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { formatarBr } from '../../../../shared/ui/date-picker/date-picker.utils';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { UploadDropzoneComponent } from '../../../../shared/ui/upload-dropzone/upload-dropzone.component';
import {
  formatarMoeda,
  normalizarTitulo,
} from '../../../oportunidades/edital-card/edital-card.utils';

export interface PropostaModalData {
  readonly propostaId: number;
}

/** Algo mudou (empresa, arquivos, Word gerado) — a lista recarrega. */
export type PropostaModalResultado = boolean;

/**
 * A proposta de uma licitação: **tudo o que sobe na plataforma, num lugar
 * só**.
 *
 * 1. A proposta comercial — o Word preenchido a partir do modelo do cliente
 *    (ou do padrão), com a empresa (CNPJ) escolhida e os preços do Cotador.
 * 2. Os documentos de habilitação da empresa — conferidos aqui, renovados
 *    em Cadastros › Empresas (moram lá: são da empresa, não da licitação).
 * 3. Os arquivos desta licitação — declarações, catálogos, a proposta
 *    assinada.
 *
 * O sistema avisa o que falta (empresa sem escolher, documento vencido),
 * mas não trava nada.
 */
@Component({
  selector: 'app-proposta-modal',
  imports: [
    FormsModule,
    ModalShellComponent,
    ButtonComponent,
    IconComponent,
    SelectComponent,
    UploadDropzoneComponent,
  ],
  templateUrl: './proposta-modal.component.html',
  styleUrl: './proposta-modal.component.scss',
})
export class PropostaModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<PropostaModalResultado>);
  private readonly service = inject(PropostasService);
  private readonly documentosService = inject(DocumentosService);
  private readonly toast = inject(ToastService);
  private readonly dados = inject<PropostaModalData>(DIALOG_DATA);

  protected readonly proposta = signal<PropostaDetalhe | null>(null);
  protected readonly documentos = signal<readonly DocumentoResponse[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly gerando = signal(false);
  protected readonly baixandoPasta = signal(false);
  protected readonly enviando = signal('');
  protected readonly enviandoModelo = signal(false);
  private mudou = false;

  protected readonly data = formatarBr;
  protected readonly moeda = formatarMoeda;
  protected readonly titulo = computed(() =>
    normalizarTitulo(this.proposta()?.oportunidade.objeto ?? 'Proposta'),
  );
  protected readonly opcoesEmpresa = computed<readonly SelectOption[]>(() =>
    (this.proposta()?.empresas ?? []).map((e) => ({
      value: String(e.id),
      label: `${e.nome} · ${formatarCnpj(e.cnpj)}`,
    })),
  );
  protected readonly gerado = computed(
    () => this.proposta()?.arquivos.find((a) => a.origem === 'gerado') ?? null,
  );
  protected readonly subidos = computed(
    () => this.proposta()?.arquivos.filter((a) => a.origem === 'subido') ?? [],
  );
  protected readonly vencidos = computed(
    () =>
      this.documentos().filter((d) => d.situacao === 'vencido' || d.situacao === 'pendente').length,
  );

  /** O resumo do topo: o que já está pronto para subir. */
  protected readonly checklist = computed(() => {
    const p = this.proposta();
    if (!p) return [];
    const docs = this.documentos();
    return [
      {
        ok: p.empresa !== null,
        texto: p.empresa ? `Empresa: ${p.empresa.nome}` : 'Escolher a empresa (CNPJ)',
      },
      {
        ok: this.gerado() !== null,
        texto: this.gerado() ? 'Proposta comercial gerada' : 'Gerar a proposta comercial (Word)',
      },
      {
        ok: p.empresa !== null && docs.length > 0 && this.vencidos() === 0,
        texto:
          p.empresa === null
            ? 'Documentos de habilitação: escolha a empresa'
            : this.vencidos() > 0
              ? `Documentos de habilitação: ${this.vencidos()} vencido(s) ou pendente(s)`
              : `Documentos de habilitação: ${docs.length} em dia`,
      },
      {
        ok: this.subidos().length > 0,
        texto: `Arquivos desta licitação: ${this.subidos().length}`,
      },
    ];
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected fechar(): void {
    this.dialogRef.close(this.mudou);
  }

  protected tomDe(documento: DocumentoResponse): string | null {
    return TOM_SITUACAO[documento.situacao];
  }

  protected escolherEmpresa(valor: string): void {
    const p = this.proposta();
    if (!p || !valor || Number(valor) === p.empresa?.id) return;
    this.service.atualizar(p.id, { empresa_id: Number(valor) }).subscribe({
      next: (atualizada) => {
        this.mudou = true;
        this.proposta.set({ ...p, empresa: atualizada.empresa });
        this.carregarDocumentos();
      },
      error: () => this.toast.erro('Não foi possível trocar a empresa agora.'),
    });
  }

  protected mudarValidade(valor: string): void {
    const p = this.proposta();
    const dias = Number(valor);
    if (!p || !dias || dias === p.validade_dias) return;
    this.service.atualizar(p.id, { validade_dias: dias }).subscribe({
      next: (atualizada) => this.proposta.set({ ...p, validade_dias: atualizada.validade_dias }),
      error: () => this.toast.erro('Não foi possível salvar a validade agora.'),
    });
  }

  protected gerarWord(): void {
    const p = this.proposta();
    if (!p) return;
    this.gerando.set(true);
    this.service.documento(p.id).subscribe({
      next: ({ conteudo, nome }) => {
        this.gerando.set(false);
        this.mudou = true;
        salvarArquivo(conteudo, nome);
        this.carregar();
      },
      error: (erro) => {
        this.gerando.set(false);
        this.toast.erro(mensagemDe(erro, 'Não foi possível gerar a proposta agora.'));
      },
    });
  }

  protected baixarPasta(): void {
    const p = this.proposta();
    if (!p) return;
    this.baixandoPasta.set(true);
    this.service.pasta(p.id).subscribe({
      next: ({ conteudo, nome }) => {
        this.baixandoPasta.set(false);
        salvarArquivo(conteudo, nome);
      },
      error: (erro) => {
        this.baixandoPasta.set(false);
        this.toast.erro(mensagemDe(erro, 'Não foi possível montar a pasta agora.'));
      },
    });
  }

  protected baixarArquivo(arquivo: ArquivoProposta): void {
    this.service.urlDoArquivo(arquivo.id).subscribe({
      next: ({ url }) => window.open(url, '_blank'),
      error: (erro) => this.toast.erro(mensagemDe(erro, 'Não foi possível baixar o arquivo.')),
    });
  }

  protected baixarDocumento(documento: DocumentoResponse): void {
    const versao = documento.versao_atual;
    if (!versao) return;
    this.documentosService.urlDeDownload(versao.id).subscribe({
      next: ({ url }) => window.open(url, '_blank'),
      error: (erro) => this.toast.erro(mensagemDe(erro, 'Não foi possível baixar o arquivo.')),
    });
  }

  protected enviarArquivo(arquivo: File): void {
    const p = this.proposta();
    if (!p) return;
    this.enviando.set(arquivo.name);
    this.service.enviarArquivo(p.id, arquivo).subscribe({
      next: (novo) => {
        this.enviando.set('');
        this.mudou = true;
        this.proposta.set({ ...p, arquivos: [...p.arquivos, novo] });
      },
      error: (erro) => {
        this.enviando.set('');
        this.toast.erro(mensagemDe(erro, 'Não foi possível enviar o arquivo.'));
      },
    });
  }

  protected removerArquivo(arquivo: ArquivoProposta): void {
    const p = this.proposta();
    if (!p) return;
    this.service.removerArquivo(arquivo.id).subscribe({
      next: () => {
        this.mudou = true;
        this.proposta.set({ ...p, arquivos: p.arquivos.filter((a) => a.id !== arquivo.id) });
      },
      error: () => this.toast.erro('Não foi possível remover o arquivo agora.'),
    });
  }

  protected baixarModelo(): void {
    this.service.baixarModelo().subscribe({
      next: ({ conteudo, nome }) => salvarArquivo(conteudo, nome),
      error: (erro) => this.toast.erro(mensagemDe(erro, 'Não foi possível baixar o modelo.')),
    });
  }

  protected enviarModelo(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    const p = this.proposta();
    if (!arquivo || !p) return;
    this.enviandoModelo.set(true);
    this.service.enviarModelo(arquivo).subscribe({
      next: (modelo) => {
        this.enviandoModelo.set(false);
        this.proposta.set({ ...p, modelo });
        this.toast.sucesso('Modelo enviado — as próximas propostas saem dele.');
      },
      error: (erro) => {
        this.enviandoModelo.set(false);
        this.toast.erro(mensagemDe(erro, 'Não foi possível enviar o modelo.'));
      },
    });
  }

  protected voltarAoPadrao(): void {
    const p = this.proposta();
    if (!p) return;
    this.service.removerModelo().subscribe({
      next: (modelo) => this.proposta.set({ ...p, modelo }),
      error: () => this.toast.erro('Não foi possível voltar ao modelo padrão agora.'),
    });
  }

  protected tamanho(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private carregar(): void {
    this.service.detalhe(this.dados.propostaId).subscribe({
      next: (proposta) => {
        this.proposta.set(proposta);
        this.carregando.set(false);
        this.carregarDocumentos();
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  private carregarDocumentos(): void {
    const empresa = this.proposta()?.empresa;
    if (!empresa) {
      this.documentos.set([]);
      return;
    }
    this.documentosService.listar(empresa.id).subscribe({
      next: (resposta) => this.documentos.set(resposta.results),
      error: () => this.documentos.set([]),
    });
  }
}

export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : cnpj;
}

/** O arquivo vem por fetch autenticado (o token vai no header), então o
 * download é montado aqui a partir do blob. */
function salvarArquivo(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function mensagemDe(erro: unknown, padrao: string): string {
  const detalhe = (erro as { error?: { detail?: unknown } })?.error?.detail;
  return typeof detalhe === 'string' ? detalhe : padrao;
}
