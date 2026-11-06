import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { FornecedorResumo, PrecoResponse } from '../../../contracts/produtos/produto.contracts';
import { ProdutosService } from '../../../services/produtos/produtos.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import {
  ColunaTabela,
  EstadoTabela,
  estadoInicialTabela,
  parametroOrdenacao,
} from '../../../shared/ui/data-table/data-table.model';
import { TabelaAcoesDirective } from '../../../shared/ui/data-table/tabela-acoes.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ItemMenu, MenuComponent } from '../../../shared/ui/menu/menu.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatarData, formatarMoeda } from '../../oportunidades/edital-card/edital-card.utils';
import {
  PrecoModalComponent,
  PrecoModalData,
  PrecoModalResultado,
} from '../preco-modal/preco-modal.component';

/** "Caixa c/ 10" — ou só "Unidade" quando a embalagem é a própria unidade. */
export function descreverEmbalagem(preco: PrecoResponse): string {
  return preco.quantidade_embalagem > 1
    ? `${preco.embalagem} c/ ${preco.quantidade_embalagem}`
    : preco.embalagem;
}

const COLUNA_FORNECEDOR: ColunaTabela<PrecoResponse> = {
  chave: 'fornecedor',
  titulo: 'Fornecedor',
  valor: (p) => p.fornecedor.fantasia || p.fornecedor.nome,
  secundario: (p) => (p.fornecedor.fantasia ? p.fornecedor.nome : null),
  ordenavel: false,
};

const COLUNAS_PRODUTO: readonly ColunaTabela<PrecoResponse>[] = [
  {
    chave: 'produto',
    titulo: 'Produto',
    valor: (p) => p.produto,
    secundario: (p) => p.observacoes || null,
  },
  {
    chave: 'embalagem',
    titulo: 'Embalagem',
    valor: descreverEmbalagem,
    secundario: (p) =>
      p.quantidade_embalagem > 1 ? formatarMoeda(Number(p.preco_embalagem)) : null,
    umaLinha: true,
    ordenavel: false,
  },
  {
    chave: 'custo',
    titulo: 'Preço por unidade',
    valor: (p) => formatarMoeda(Number(p.custo)) ?? '—',
    numerica: true,
    umaLinha: true,
  },
  {
    chave: 'registrado_em',
    titulo: 'Atualizado em',
    valor: (p) => formatarData(p.registrado_em) ?? '—',
    secundario: (p) =>
      p.origem === 'cotador'
        ? 'veio de uma cotação'
        : p.registrado_por
          ? `por ${p.registrado_por}`
          : null,
    umaLinha: true,
  },
];

/**
 * A tabela de preços de fornecedor — "quem me vende o quê, e por quanto".
 *
 * A mesma tabela em dois lugares: na tela de Produtos (todos os
 * fornecedores, a busca "onde tenho preço de caneta?") e na ficha de um
 * fornecedor (`fornecedor` informado: só os dele, sem a coluna Fornecedor).
 */
@Component({
  selector: 'app-precos-tabela',
  imports: [
    DataTableComponent,
    TabelaAcoesDirective,
    MenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './precos-tabela.component.html',
  styleUrl: './precos-tabela.component.scss',
})
export class PrecosTabelaComponent implements OnInit {
  private readonly service = inject(ProdutosService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  /** Com fornecedor, a tabela é a ficha dele; sem, é a busca geral. */
  readonly fornecedor = input<FornecedorResumo | null>(null);

  protected readonly colunas = computed(() =>
    this.fornecedor()
      ? COLUNAS_PRODUTO
      : [COLUNAS_PRODUTO[0], COLUNA_FORNECEDOR, ...COLUNAS_PRODUTO.slice(1)],
  );
  protected readonly estado = signal<EstadoTabela>(estadoInicialTabela());
  protected readonly linhas = signal<readonly PrecoResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly chaveDe = (p: PrecoResponse) => p.id;

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected acoesDe(preco: PrecoResponse): readonly ItemMenu[] {
    return [
      { rotulo: 'Atualizar preço', icone: 'edit', executar: () => this.abrir(preco) },
      { rotulo: 'Excluir', icone: 'trash', tom: 'perigo', executar: () => this.excluir(preco) },
    ];
  }

  protected abrir(base: PrecoResponse | null): void {
    this.modal
      .abrir<PrecoModalResultado, PrecoModalData>(PrecoModalComponent, {
        fornecedor: this.fornecedor(),
        base,
      })
      .subscribe((salvo) => {
        if (!salvo) return;
        this.toast.sucesso('Preço salvo.');
        this.carregar();
      });
  }

  private excluir(preco: PrecoResponse): void {
    this.modal
      .confirmar({
        titulo: 'Excluir preço',
        mensagem:
          `O preço de "${preco.produto}" (${preco.fornecedor.fantasia || preco.fornecedor.nome}) ` +
          'sai da lista. Esta ação não poderá ser desfeita. Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;
        this.service.removerPreco(preco.id).subscribe({
          next: () => {
            this.toast.sucesso('Preço excluído.');
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir o preço agora.'),
        });
      });
  }

  private carregar(): void {
    const estado = this.estado();
    const fornecedor = this.fornecedor();
    this.carregando.set(true);
    this.erro.set(false);
    this.service
      .precos({
        page: estado.pagina,
        page_size: estado.tamanhoPagina,
        ordering: parametroOrdenacao(estado),
        busca: estado.busca,
        ...(fornecedor ? { fornecedor: fornecedor.id } : {}),
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
}
