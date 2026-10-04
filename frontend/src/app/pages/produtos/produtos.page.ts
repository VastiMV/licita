import { Component, OnInit, inject, signal } from '@angular/core';

import { FabricanteResponse } from '../../contracts/produtos/produto.contracts';
import { ProdutosService } from '../../services/produtos/produtos.service';
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
import {
  FabricanteModalComponent,
  FabricanteModalData,
  FabricanteModalResultado,
  resumoFornecedores,
} from './fabricante-modal/fabricante-modal.component';

const COLUNAS: readonly ColunaTabela<FabricanteResponse>[] = [
  {
    chave: 'nome',
    titulo: 'Fabricante',
    valor: (f) => f.nome,
    secundario: (f) => f.marcas.map((m) => m.nome).join(', ') || null,
  },
  {
    chave: 'modelos',
    titulo: 'Marcas / modelos',
    valor: (f) => `${f.marcas_total} / ${f.modelos_total}`,
    numerica: true,
    umaLinha: true,
    ordenavel: false,
  },
  {
    chave: 'fornecedores',
    titulo: 'Vendido por',
    valor: (f) => resumoFornecedores(f.fornecedores) || '—',
    ordenavel: false,
  },
];

/**
 * "Cadastros / Produtos" — Fabricante › Marca › Modelo e quem vende cada
 * fabricante. Uma linha por fabricante; o modal abre a árvore inteira.
 */
@Component({
  selector: 'app-produtos-page',
  imports: [
    DataTableComponent,
    TabelaAcoesDirective,
    MenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './produtos.page.html',
  styleUrl: './produtos.page.scss',
})
export class ProdutosPage implements OnInit {
  private readonly service = inject(ProdutosService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly colunas = COLUNAS;
  protected readonly estado = signal<EstadoTabela>(
    estadoInicialTabela({ ordenarPor: 'nome', direcao: 'asc' }),
  );
  protected readonly linhas = signal<readonly FabricanteResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly chaveDe = (f: FabricanteResponse) => f.id;

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected acoesDe(fabricante: FabricanteResponse): readonly ItemMenu[] {
    return [
      { rotulo: 'Editar', icone: 'edit', executar: () => this.abrir(fabricante) },
      {
        rotulo: 'Excluir',
        icone: 'trash',
        tom: 'perigo',
        executar: () => this.excluir(fabricante),
      },
    ];
  }

  protected abrir(fabricante: FabricanteResponse | null): void {
    this.modal
      .abrir<FabricanteModalResultado, FabricanteModalData>(FabricanteModalComponent, fabricante)
      .subscribe((alterou) => {
        if (alterou) this.carregar();
      });
  }

  protected excluir(fabricante: FabricanteResponse): void {
    this.modal
      .confirmar({
        titulo: 'Excluir fabricante',
        mensagem:
          `"${fabricante.nome}" sai do cadastro com as marcas, os modelos e a tabela de ` +
          'preços deles. As cotações que já o usaram continuam mostrando o nome. ' +
          'Esta ação não poderá ser desfeita. Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;
        this.service.removerFabricante(fabricante.id).subscribe({
          next: () => {
            this.toast.sucesso('Fabricante excluído.');
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir o fabricante agora.'),
        });
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
}
