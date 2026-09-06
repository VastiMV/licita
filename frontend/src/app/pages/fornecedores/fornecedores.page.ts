import { Component, OnInit, inject, signal } from '@angular/core';

import {
  FornecedorResponse,
  SITUACOES_FORNECEDOR,
} from '../../contracts/fornecedores/fornecedor.contracts';
import { FornecedoresService } from '../../services/fornecedores/fornecedores.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import {
  ColunaTabela,
  EstadoTabela,
  TomCelula,
  estadoInicialTabela,
  parametroOrdenacao,
} from '../../shared/ui/data-table/data-table.model';
import { TabelaAcoesDirective } from '../../shared/ui/data-table/tabela-acoes.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ItemMenu, MenuComponent } from '../../shared/ui/menu/menu.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FornecedorModalComponent } from './fornecedor-modal/fornecedor-modal.component';

/** A situação vira pílula colorida na tabela — é o dado que decide se o
 * fornecedor pode entrar num processo novo. "Inativo" fica sem tom (texto
 * normal): não é alerta, é só ausência. */
const TONS: Record<string, TomCelula | null> = {
  ativo: 'sucesso',
  em_analise: 'alerta',
  inativo: null,
  documentacao_vencida: 'perigo',
};

/** As chaves das colunas são contrato com o backend (`ORDENACOES` em
 * `apps/fornecedores/views.py`) — é o que vai no `ordering` do endpoint. */
const COLUNAS: readonly ColunaTabela<FornecedorResponse>[] = [
  {
    chave: 'nome',
    titulo: 'Razão social',
    valor: (f) => f.nome,
    // O nome fantasia é como a equipe se refere ao fornecedor no dia a dia,
    // mas não merece coluna própria — fica de subtítulo.
    secundario: (f) => f.fantasia,
    dica: (f) => f.nome,
  },
  {
    chave: 'cnpj',
    titulo: 'CNPJ / CPF',
    valor: (f) => f.cnpj_formatado,
    umaLinha: true,
  },
  { chave: 'cidade', titulo: 'Cidade', valor: (f) => f.cidade_uf, umaLinha: true },
  { chave: 'categoria', titulo: 'Categoria', valor: (f) => f.categoria_label },
  {
    chave: 'situacao',
    titulo: 'Situação',
    valor: (f) => f.situacao_label,
    umaLinha: true,
    tom: (f) => TONS[f.situacao] ?? null,
  },
];

/**
 * "Fornecedores" — o cadastro de quem a empresa compra para revender numa
 * licitação, e a base que o Cotador amarra a cada item.
 *
 * Mesma tabela e os mesmos gestos de "Oportunidades / Salvas" (busca,
 * ordenação e paginação sempre no endpoint; ações da linha num menu), e
 * pela mesma razão: a lista é compartilhada pela equipe e pode crescer
 * muito, então a tela nunca tem o cadastro inteiro em memória.
 */
@Component({
  selector: 'app-fornecedores-page',
  imports: [
    DataTableComponent,
    TabelaAcoesDirective,
    MenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './fornecedores.page.html',
  styleUrl: './fornecedores.page.scss',
})
export class FornecedoresPage implements OnInit {
  private readonly service = inject(FornecedoresService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly colunas = COLUNAS;
  protected readonly situacoes = SITUACOES_FORNECEDOR;

  protected readonly estado = signal<EstadoTabela>(
    // Alfabética — o cadastro é consultado por nome, não por data.
    estadoInicialTabela({ ordenarPor: 'nome', direcao: 'asc' }),
  );
  protected readonly linhas = signal<readonly FornecedorResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly vencidos = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly chaveDe = (f: FornecedorResponse) => f.id;
  protected readonly estaVencido = (f: FornecedorResponse) => f.situacao === 'documentacao_vencida';

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected acoesDe(fornecedor: FornecedorResponse): readonly ItemMenu[] {
    return [
      { rotulo: 'Editar', icone: 'edit', executar: () => this.editar(fornecedor) },
      {
        rotulo: 'Excluir',
        icone: 'trash',
        tom: 'perigo',
        executar: () => this.excluir(fornecedor),
      },
    ];
  }

  protected adicionar(): void {
    this.abrirModal(null);
  }

  protected editar(fornecedor: FornecedorResponse): void {
    this.abrirModal(fornecedor);
  }

  protected excluir(fornecedor: FornecedorResponse): void {
    this.modal
      .confirmar({
        titulo: 'Excluir fornecedor',
        mensagem:
          `"${fornecedor.nome}" sai do cadastro de toda a equipe. As cotações que já o ` +
          'usaram continuam mostrando o nome dele, mas ele deixa de ser oferecido em ' +
          'cotações novas. Esta ação não poderá ser desfeita. Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.service.remover(fornecedor.id).subscribe({
          next: () => {
            this.toast.sucesso('Fornecedor excluído do cadastro.');
            this.voltarPaginaSeEsvaziou();
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir o fornecedor agora.'),
        });
      });
  }

  /** O mesmo modal cadastra e edita — só o modo muda (ver
   * `FornecedorModalComponent`). Recarrega a lista quando ele salvou. */
  private abrirModal(fornecedor: FornecedorResponse | null): void {
    this.modal
      .abrir<FornecedorResponse, FornecedorResponse | null>(FornecedorModalComponent, fornecedor)
      .subscribe((salvo) => {
        if (!salvo) return;
        this.toast.sucesso(
          fornecedor ? 'Fornecedor atualizado.' : `"${salvo.nome}" entrou no cadastro.`,
        );
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
          this.vencidos.set(pagina.documentacao_vencida);
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

  /** Excluir o último item de uma página deixaria a tabela vazia com um
   * paginador dizendo que há mais — volta uma página antes de recarregar. */
  private voltarPaginaSeEsvaziou(): void {
    const estado = this.estado();
    if (this.linhas().length === 1 && estado.pagina > 1) {
      this.estado.set({ ...estado, pagina: estado.pagina - 1 });
    }
  }
}
