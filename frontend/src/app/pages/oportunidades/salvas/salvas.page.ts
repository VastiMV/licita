import { Component, OnInit, inject, signal } from '@angular/core';

import { OportunidadeSalvaResponse } from '../../../contracts/licitacoes/oportunidade-salva.contracts';
import { OportunidadesSalvasService } from '../../../services/licitacoes/oportunidades-salvas.service';
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
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatarData, formatarMoeda } from '../edital-card/edital-card.utils';
import { nomePlataforma } from '../edital-card/plataformas';
import { OportunidadeModalComponent } from './oportunidade-modal/oportunidade-modal.component';

/** As chaves das colunas são contrato com o backend (`ORDENACOES` em
 * `apps/licitacoes/views.py`) — é o que vai no `ordering` do endpoint. */
const COLUNAS: readonly ColunaTabela<OportunidadeSalvaResponse>[] = [
  { chave: 'descricao', titulo: 'Descrição', valor: (salva) => salva.objeto || '—' },
  {
    chave: 'plataforma',
    titulo: 'Plataforma',
    valor: (salva) => nomePlataforma(salva.plataforma_id, salva.plataforma_nome),
  },
  { chave: 'modalidade', titulo: 'Modalidade', valor: (salva) => salva.modalidade || '—' },
  {
    chave: 'cidade',
    titulo: 'Cidade',
    valor: (salva) => [salva.municipio, salva.uf].filter(Boolean).join(' / ') || '—',
  },
  {
    chave: 'data_publicacao',
    titulo: 'Publicação',
    valor: (salva) => formatarData(salva.data_publicacao) ?? '—',
  },
  {
    chave: 'prazo',
    titulo: 'Prazo da proposta',
    valor: (salva) => formatarData(salva.data_encerramento_proposta) ?? '—',
    // Prazo vencido é o dado mais importante da linha: vira pílula vermelha
    // (a linha inteira também fica destacada, ver `expirada` no template).
    tom: (salva) => (salva.expirada ? 'perigo' : null),
  },
  {
    chave: 'valor',
    titulo: 'Valor estimado',
    valor: (salva) => formatarMoeda(salva.valor_total_estimado) ?? '—',
    numerica: true,
  },
];

/**
 * "Oportunidades / Salvas" — a lista que a equipe montou a partir da busca.
 *
 * Compartilhada: o que um usuário salva aparece para todos (ver
 * docs/DOMINIO.md). Buscar, ordenar e paginar são sempre consulta nova ao
 * endpoint — a tela nunca tem a lista inteira em memória.
 */
@Component({
  selector: 'app-salvas-page',
  imports: [DataTableComponent, TabelaAcoesDirective, ButtonComponent, IconComponent],
  templateUrl: './salvas.page.html',
  styleUrl: './salvas.page.scss',
})
export class SalvasPage implements OnInit {
  private readonly service = inject(OportunidadesSalvasService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly colunas = COLUNAS;

  protected readonly estado = signal<EstadoTabela>(
    // Mais recentes primeiro — mesma ordem padrão do endpoint.
    estadoInicialTabela({ ordenarPor: 'criada_em', direcao: 'desc' }),
  );
  protected readonly linhas = signal<readonly OportunidadeSalvaResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  /** Quantas expiradas o último aviso anunciou. Guardado para não repetir o
   * mesmo toast a cada troca de página/ordenação — o aviso é sobre a lista,
   * não sobre a consulta. */
  private ultimoAviso: number | null = null;

  protected readonly chaveDe = (salva: OportunidadeSalvaResponse) => salva.id;
  protected readonly estaExpirada = (salva: OportunidadeSalvaResponse) => salva.expirada;

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected visualizar(salva: OportunidadeSalvaResponse): void {
    this.modal.abrir(OportunidadeModalComponent, salva).subscribe();
  }

  protected excluir(salva: OportunidadeSalvaResponse): void {
    this.modal
      .confirmar({
        titulo: 'Excluir oportunidade salva',
        mensagem:
          `"${this.resumo(salva)}" sai da lista de toda a equipe. ` +
          'Esta ação não poderá ser desfeita. Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.service.remover(salva.id).subscribe({
          next: () => {
            this.toast.sucesso('Oportunidade excluída da lista.');
            this.voltarPaginaSeEsvaziou();
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir a oportunidade agora.'),
        });
      });
  }

  protected excluirExpiradas(quantidade: number): void {
    this.modal
      .confirmar({
        titulo: 'Excluir oportunidades vencidas',
        mensagem:
          `${quantidade} oportunidade(s) sem prazo para proposta serão retiradas da lista. ` +
          'Esta ação não poderá ser desfeita. Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.service.removerExpiradas().subscribe({
          next: ({ removidas }) => {
            this.toast.sucesso(`${removidas} oportunidade(s) vencida(s) excluída(s).`);
            this.estado.update((atual) => ({ ...atual, pagina: 1 }));
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir as vencidas agora.'),
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
          this.avisarExpiradas(pagina.expiradas);
        },
        error: () => {
          this.carregando.set(false);
          this.erro.set(true);
          this.linhas.set([]);
          this.total.set(0);
        },
      });
  }

  /** O aviso amarelo da tela: quantas já não dão mais para virar proposta, e
   * o atalho para tirá-las da lista de uma vez. */
  private avisarExpiradas(expiradas: number): void {
    if (expiradas === 0) {
      this.ultimoAviso = 0;
      return;
    }
    if (expiradas === this.ultimoAviso) return;

    this.ultimoAviso = expiradas;
    this.toast.alerta(
      expiradas === 1
        ? '1 oportunidade salva não tem mais prazo para gerar proposta.'
        : `${expiradas} oportunidades salvas não têm mais prazo para gerar proposta.`,
      { acao: { rotulo: 'Apagar as vencidas', executar: () => this.excluirExpiradas(expiradas) } },
    );
  }

  /** Excluir o último item de uma página deixaria a tabela vazia com um
   * paginador dizendo que há mais — volta uma página antes de recarregar. */
  private voltarPaginaSeEsvaziou(): void {
    const estado = this.estado();
    if (this.linhas().length === 1 && estado.pagina > 1) {
      this.estado.set({ ...estado, pagina: estado.pagina - 1 });
    }
  }

  private resumo(salva: OportunidadeSalvaResponse): string {
    const objeto = salva.objeto.trim();
    return objeto.length > 80 ? `${objeto.slice(0, 80)}…` : objeto || 'Oportunidade sem objeto';
  }
}
