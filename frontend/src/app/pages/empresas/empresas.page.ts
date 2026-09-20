import { Component, OnInit, inject, signal } from '@angular/core';

import { EmpresaResponse, paraRequest } from '../../contracts/empresas/empresa.contracts';
import { EmpresasService } from '../../services/empresas/empresas.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import {
  ColunaTabela,
  EstadoTabela,
  estadoInicialTabela,
  parametroOrdenacao,
} from '../../shared/ui/data-table/data-table.model';
import { TabelaAcoesDirective } from '../../shared/ui/data-table/tabela-acoes.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ItemMenu, MenuComponent } from '../../shared/ui/menu/menu.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { EmpresaModalComponent } from './empresa-modal/empresa-modal.component';

/** As chaves das colunas são contrato com o backend (`ORDENACOES` em
 * `apps/empresas/views.py`) — é o que vai no `ordering` do endpoint. */
const COLUNAS: readonly ColunaTabela<EmpresaResponse>[] = [
  {
    chave: 'nome',
    titulo: 'Razão social',
    valor: (e) => e.nome,
    // A empresa padrão precisa ser reconhecível na lista sem abrir nada: é
    // ela que já vem escolhida na proposta.
    secundario: (e) => [e.fantasia, e.padrao ? 'empresa padrão' : ''].filter(Boolean).join(' · '),
    dica: (e) => e.nome,
  },
  { chave: 'cnpj', titulo: 'CNPJ', valor: (e) => e.cnpj_formatado, umaLinha: true },
  { chave: 'cidade', titulo: 'Cidade', valor: (e) => e.cidade_uf, umaLinha: true },
  { chave: 'porte', titulo: 'Porte', valor: (e) => e.porte_label },
  {
    chave: 'ativa',
    titulo: 'Situação',
    valor: (e) => (e.ativa ? 'Ativa' : 'Inativa'),
    umaLinha: true,
    ordenavel: false,
    // Ativa é o normal, e o normal não se pinta. Inativa também não é
    // alarme — é ausência: some do seletor, continua no histórico.
    tom: () => null,
  },
];

/**
 * "Empresas" — os CNPJs com que a equipe **disputa**, e não de quem ela
 * compra (isso é "Fornecedores"). Ver `apps/empresas/models.py`.
 *
 * Mesma tabela e os mesmos gestos do cadastro de fornecedores, ainda que
 * aqui o cadastro seja curto: uma tela que carrega tudo em memória viraria
 * a exceção a explicar depois.
 *
 * A coluna "Documentação" (certidões da empresa) entra junto com o módulo
 * de documentos — ver `docs/Tarefas/feat-cadastro-empresa.md`.
 */
@Component({
  selector: 'app-empresas-page',
  imports: [
    DataTableComponent,
    TabelaAcoesDirective,
    MenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './empresas.page.html',
  styleUrl: './empresas.page.scss',
})
export class EmpresasPage implements OnInit {
  private readonly service = inject(EmpresasService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly colunas = COLUNAS;

  protected readonly estado = signal<EstadoTabela>(
    // Alfabética — o cadastro é consultado por nome, não por data.
    estadoInicialTabela({ ordenarPor: 'nome', direcao: 'asc' }),
  );
  protected readonly linhas = signal<readonly EmpresaResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly chaveDe = (e: EmpresaResponse) => e.id;

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected acoesDe(empresa: EmpresaResponse): readonly ItemMenu[] {
    const itens: ItemMenu[] = [
      { rotulo: 'Editar', icone: 'edit', executar: () => this.editar(empresa) },
    ];

    if (empresa.ativa && !empresa.padrao) {
      itens.push({
        rotulo: 'Definir como padrão',
        icone: 'check',
        executar: () => this.definirPadrao(empresa),
      });
    }

    if (empresa.ativa) {
      // A padrão não sai de cena sem que outra assuma — senão a próxima
      // proposta abre sem CNPJ e ninguém entende por quê.
      if (!empresa.padrao) {
        itens.push({
          rotulo: 'Inativar',
          icone: 'trash',
          tom: 'perigo',
          executar: () => this.inativar(empresa),
        });
      }
    } else {
      itens.push({ rotulo: 'Reativar', icone: 'check', executar: () => this.reativar(empresa) });
    }

    return itens;
  }

  protected adicionar(): void {
    this.abrirModal(null);
  }

  protected editar(empresa: EmpresaResponse): void {
    this.abrirModal(empresa);
  }

  /** Não é exclusão, e o texto diz isso: o que sai é a oferta do CNPJ em
   * propostas novas, não o registro. */
  protected inativar(empresa: EmpresaResponse): void {
    this.modal
      .confirmar({
        titulo: 'Inativar empresa',
        mensagem:
          `"${empresa.nome}" deixa de ser oferecida como CNPJ de disputa. As propostas e os ` +
          'processos que já usaram esta empresa continuam como estão, e ela pode ser reativada ' +
          'depois. Deseja continuar?',
        confirmarLabel: 'Inativar',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.service.inativar(empresa.id).subscribe({
          next: () => {
            this.toast.sucesso(`"${empresa.nome}" foi inativada.`);
            this.carregar();
          },
          error: (erro) => this.toast.erro(this.mensagemDe(erro, 'inativar a empresa')),
        });
      });
  }

  protected reativar(empresa: EmpresaResponse): void {
    this.service.atualizar(empresa.id, { ...paraRequest(empresa), ativa: true }).subscribe({
      next: () => {
        this.toast.sucesso(`"${empresa.nome}" voltou a ser oferecida nas propostas.`);
        this.carregar();
      },
      error: (erro) => this.toast.erro(this.mensagemDe(erro, 'reativar a empresa')),
    });
  }

  protected definirPadrao(empresa: EmpresaResponse): void {
    this.service.atualizar(empresa.id, { ...paraRequest(empresa), padrao: true }).subscribe({
      next: () => {
        this.toast.sucesso(`"${empresa.nome}" agora é a empresa padrão.`);
        this.carregar();
      },
      error: (erro) => this.toast.erro(this.mensagemDe(erro, 'definir a empresa padrão')),
    });
  }

  /** O mesmo modal cadastra e edita — só o modo muda. Recarrega a lista
   * quando ele salvou. */
  private abrirModal(empresa: EmpresaResponse | null): void {
    this.modal
      .abrir<EmpresaResponse, EmpresaResponse | null>(EmpresaModalComponent, empresa)
      .subscribe((salva) => {
        if (!salva) return;
        this.toast.sucesso(empresa ? 'Empresa atualizada.' : `"${salva.nome}" entrou no cadastro.`);
        this.carregar();
      });
  }

  private carregar(): void {
    const estado = this.estado();
    this.carregando.set(true);
    this.erro.set(false);

    this.service
      .listar({
        page: estado.pagina,
        page_size: estado.tamanhoPagina,
        ordering: parametroOrdenacao(estado),
        busca: estado.busca,
      })
      .subscribe({
        next: (pagina) => {
          this.linhas.set(pagina.results);
          this.total.set(pagina.count);
          this.carregando.set(false);
        },
        error: () => {
          this.carregando.set(false);
          this.erro.set(true);
          this.linhas.set([]);
          this.total.set(0);
        },
      });
  }

  /** O backend recusa inativar a empresa padrão com uma explicação; jogar
   * fora esse texto e mostrar "não foi possível" seria esconder a razão. */
  private mensagemDe(erro: unknown, acao: string): string {
    const detalhe = (erro as { error?: { detail?: string } })?.error?.detail;
    return detalhe ?? `Não foi possível ${acao} agora.`;
  }
}
