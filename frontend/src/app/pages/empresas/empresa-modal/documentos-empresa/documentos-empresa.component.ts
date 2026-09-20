import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  BLOCOS,
  DocumentoResponse,
  SituacaoDocumento,
  TOM_SITUACAO,
  TipoDocumento,
  VersaoDocumento,
} from '../../../../contracts/documentos/documento.contracts';
import { DocumentosService } from '../../../../services/documentos/documentos.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { UploadDropzoneComponent } from '../../../../shared/ui/upload-dropzone/upload-dropzone.component';

type Filtro = 'todos' | 'a_vencer' | 'vencidos' | 'pendentes';

/** Um grupo da lista: os documentos de um bloco da Lei 14.133. Blocos sem
 * nenhum documento não aparecem. */
interface Grupo {
  readonly bloco: string;
  readonly label: string;
  readonly documentos: readonly DocumentoResponse[];
}

/**
 * Os documentos da empresa, dentro do modal dela.
 *
 * **A tela não é uma pasta de arquivos, é um painel de validade.** A lista
 * é agrupada pelos quatro blocos de habilitação da Lei 14.133 e ordenada
 * por quem vence primeiro, porque a pergunta que ela responde é "o que vai
 * me derrubar primeiro" — não "onde está o arquivo".
 *
 * Uma diferença consciente em relação ao mockup: não há uma dropzone única
 * no topo. Um arquivo solto não diz de qual documento ele é nem qual a
 * validade dele, e validade é o dado principal aqui — então o envio é
 * **por linha**, junto dos campos daquela certidão. O gesto que se repete
 * doze vezes por ano (renovar o FGTS) continua sendo um clique e um
 * arrastar, só que no lugar certo.
 */
@Component({
  selector: 'app-documentos-empresa',
  imports: [
    DatePipe,
    FormsModule,
    ButtonComponent,
    IconComponent,
    SelectComponent,
    UploadDropzoneComponent,
  ],
  templateUrl: './documentos-empresa.component.html',
  styleUrl: './documentos-empresa.component.scss',
})
export class DocumentosEmpresaComponent implements OnInit {
  readonly empresaId = input.required<number>();

  private readonly service = inject(DocumentosService);
  private readonly toast = inject(ToastService);

  protected readonly documentos = signal<readonly DocumentoResponse[]>([]);
  protected readonly contadores = signal({ validos: 0, a_vencer: 0, vencidos: 0, pendentes: 0 });
  protected readonly tipos = signal<readonly TipoDocumento[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly filtro = signal<Filtro>('todos');

  /** Qual linha está com o formulário de envio aberto. Uma por vez: duas
   * abertas competiriam pelo mesmo gesto. */
  protected readonly enviandoEm = signal<number | null>(null);
  protected readonly versoesAbertas = signal<number | null>(null);
  protected readonly versoes = signal<readonly VersaoDocumento[]>([]);
  protected readonly progresso = signal<number | null>(null);
  protected readonly arquivoEmEnvio = signal('');

  /** O formulário da versão nova, da linha aberta. */
  protected readonly numero = signal('');
  protected readonly emissao = signal('');
  protected readonly validade = signal('');
  protected readonly nota = signal('');

  /** Abrir vaga nova (o tipo opcional e o "outro documento"). */
  protected readonly abrindoVaga = signal(false);
  protected readonly tipoNovo = signal('');
  protected readonly tituloNovo = signal('');

  protected readonly filtrados = computed<readonly DocumentoResponse[]>(() => {
    const documentos = this.documentos();
    switch (this.filtro()) {
      case 'a_vencer':
        return documentos.filter((d) => d.situacao === 'a_vencer');
      case 'vencidos':
        return documentos.filter((d) => d.situacao === 'vencido');
      case 'pendentes':
        return documentos.filter((d) => d.situacao === 'pendente');
      default:
        return documentos;
    }
  });

  protected readonly grupos = computed<readonly Grupo[]>(() =>
    BLOCOS.map((bloco) => ({
      bloco: bloco.value,
      label: bloco.label,
      documentos: this.filtrados().filter((d) => d.bloco === bloco.value),
    })).filter((grupo) => grupo.documentos.length > 0),
  );

  protected readonly opcoesTipo = computed<readonly SelectOption[]>(() => {
    const jaAbertos = new Set(this.documentos().map((d) => d.tipo));
    return (
      this.tipos()
        // O tipo livre pode repetir: "Alvará sanitário" e "Licença ambiental"
        // são dois documentos, ainda que do mesmo tipo.
        .filter((tipo) => tipo.bloco === 'outros' || !jaAbertos.has(tipo.id))
        .map((tipo) => ({ value: String(tipo.id), label: tipo.nome }))
    );
  });

  protected readonly tipoEscolhidoELivre = computed(
    () => this.tipos().find((t) => String(t.id) === this.tipoNovo())?.bloco === 'outros',
  );

  ngOnInit(): void {
    this.carregar();
    this.service.tipos().subscribe({ next: (tipos) => this.tipos.set(tipos) });
  }

  protected tomDe(documento: DocumentoResponse): string | null {
    return TOM_SITUACAO[documento.situacao];
  }

  protected exigeValidade(documento: DocumentoResponse): boolean {
    return documento.exige_validade;
  }

  protected trocarFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  protected contagemDe(filtro: Filtro): number {
    const c = this.contadores();
    if (filtro === 'a_vencer') return c.a_vencer;
    if (filtro === 'vencidos') return c.vencidos;
    if (filtro === 'pendentes') return c.pendentes;
    return this.documentos().length;
  }

  /** Abre (ou fecha) o formulário de envio de uma linha, sempre limpo: os
   * campos da certidão anterior não valem para a próxima. */
  protected alternarEnvio(documento: DocumentoResponse): void {
    const mesma = this.enviandoEm() === documento.id;
    this.enviandoEm.set(mesma ? null : documento.id);
    this.numero.set('');
    this.emissao.set('');
    this.validade.set('');
    this.nota.set('');
  }

  protected alternarVersoes(documento: DocumentoResponse): void {
    if (this.versoesAbertas() === documento.id) {
      this.versoesAbertas.set(null);
      return;
    }
    this.versoesAbertas.set(documento.id);
    this.versoes.set([]);
    this.service.versoes(documento.id).subscribe({
      next: (versoes) => this.versoes.set(versoes),
      error: () => this.toast.erro('Não foi possível carregar o histórico deste documento.'),
    });
  }

  protected enviar(documento: DocumentoResponse, arquivo: File): void {
    if (this.progresso() !== null) return;

    this.progresso.set(0);
    this.arquivoEmEnvio.set(arquivo.name);

    this.service
      .enviarVersao(documento.id, {
        arquivo,
        numero: this.numero(),
        emissao: this.emissao(),
        validade: this.validade(),
        nota: this.nota(),
      })
      .subscribe({
        next: ({ pct, resultado }) => {
          this.progresso.set(pct);
          if (!resultado) return;

          this.progresso.set(null);
          this.enviandoEm.set(null);
          this.toast.sucesso(
            `${arquivo.name} enviado — ${resultado.documento.nome} na versão ${resultado.versao.versao}.`,
          );
          this.carregar();
        },
        error: (erro) => {
          this.progresso.set(null);
          this.toast.erro(this.mensagemDe(erro, 'Não foi possível enviar o arquivo agora.'));
        },
      });
  }

  protected baixar(versaoId: number): void {
    this.service.urlDeDownload(versaoId).subscribe({
      next: ({ url }) => window.open(url, '_blank'),
      error: (erro) => this.toast.erro(this.mensagemDe(erro, 'Não foi possível baixar o arquivo.')),
    });
  }

  protected abrirVaga(): void {
    const tipo = Number(this.tipoNovo());
    if (!tipo) return;

    this.service.abrirVaga(this.empresaId(), tipo, this.tituloNovo().trim()).subscribe({
      next: () => {
        this.abrindoVaga.set(false);
        this.tipoNovo.set('');
        this.tituloNovo.set('');
        this.carregar();
      },
      error: (erro) =>
        this.toast.erro(this.mensagemDe(erro, 'Não foi possível adicionar o documento.')),
    });
  }

  /** Arquivar, não excluir: o documento sai da lista e continua preso ao
   * processo em que foi usado. */
  protected arquivar(documento: DocumentoResponse): void {
    this.service.arquivar(documento.id).subscribe({
      next: () => {
        this.toast.sucesso(`"${documento.nome}" foi arquivado.`);
        this.carregar();
      },
      error: () => this.toast.erro('Não foi possível arquivar o documento agora.'),
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.service.listar(this.empresaId()).subscribe({
      next: (resposta) => {
        this.documentos.set(resposta.results);
        this.contadores.set({
          validos: resposta.validos,
          a_vencer: resposta.a_vencer,
          vencidos: resposta.vencidos,
          pendentes: resposta.pendentes,
        });
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar os documentos desta empresa.');
      },
    });
  }

  /** O backend explica o que recusou (extensão, tamanho, validade, bucket
   * sem configurar); esconder isso atrás de "não foi possível" tiraria da
   * pessoa a única informação útil. */
  private mensagemDe(erro: unknown, padrao: string): string {
    const corpo = (erro as { error?: Record<string, unknown> })?.error;
    if (!corpo) return padrao;
    const valor = corpo['arquivo'] ?? corpo['detail'] ?? corpo['validade'] ?? corpo['titulo'];
    if (!valor) return padrao;
    return String(Array.isArray(valor) ? valor[0] : valor);
  }

  protected readonly situacoesComTom: readonly SituacaoDocumento[] = [
    'valido',
    'a_vencer',
    'vencido',
  ];
}
