import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CartaoCiclo,
  ColunaCiclo,
  QuadroCiclo,
} from '../../../contracts/licitacoes/ciclo.contracts';
import { CicloService } from '../../../services/licitacoes/ciclo.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import {
  CotadorModalComponent,
  CotadorModalData,
} from '../../oportunidades/cotador-modal/cotador-modal.component';
import {
  formatarData,
  formatarMoeda,
  normalizarTitulo,
} from '../../oportunidades/edital-card/edital-card.utils';

/** "R$ 214 mil" — o topo da coluna só precisa da ordem de grandeza. */
export function formatarMil(valor: number): string {
  if (valor >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (valor >= 1_000) return `R$ ${Math.round(valor / 1_000).toLocaleString('pt-BR')} mil`;
  return formatarMoeda(valor) ?? 'R$ 0';
}

/**
 * O quadro do Ciclo de Licitação: uma coluna por etapa, e nenhuma se
 * arrasta — o cartão muda de coluna quando o trabalho anda (a etapa é
 * calculada no backend, ver `apps/licitacoes/ciclo.py`).
 *
 * Abrir um cartão abre a tela de trabalho da etapa em que ele está. Hoje só
 * o Cotador existe: Oportunidade e Cotação abrem o mesmo
 * `CotadorModalComponent` das Salvas, e fechar (salvando ou não) recarrega
 * o quadro — salvar a primeira cotação é justamente o que move o cartão.
 * Proposta, Disputa e Empenho aparecem vazias até as telas delas chegarem.
 */
@Component({
  selector: 'app-quadro-page',
  imports: [RouterLink, IconComponent],
  templateUrl: './quadro.page.html',
  styleUrl: './quadro.page.scss',
})
export class QuadroPage implements OnInit {
  private readonly ciclo = inject(CicloService);
  private readonly modal = inject(ModalService);

  protected readonly quadro = signal<QuadroCiclo | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);

  protected readonly emAndamento = computed(
    () => this.quadro()?.colunas.reduce((soma, coluna) => soma + coluna.cartoes.length, 0) ?? 0,
  );

  protected readonly hojePorExtenso = computed(() => {
    const hoje = this.quadro()?.hoje;
    if (!hoje) return '';
    const [ano, mes, dia] = hoje.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  protected readonly formatarMil = formatarMil;
  protected readonly titulo = normalizarTitulo;

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.ciclo.quadro().subscribe({
      next: (quadro) => {
        this.quadro.set(quadro);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  protected local(cartao: CartaoCiclo): string {
    const cidade = [cartao.municipio, cartao.uf].filter(Boolean).join('/');
    return [cartao.uasg && `UASG ${cartao.uasg}`, cidade].filter(Boolean).join(' · ');
  }

  protected dado(cartao: CartaoCiclo): string {
    const prazo = formatarData(cartao.data_encerramento_proposta);
    const valor =
      cartao.etapa === 'cotacao' && cartao.valor_cotado !== null
        ? `cotado ${formatarMoeda(cartao.valor_cotado)}`
        : formatarMoeda(cartao.valor_total_estimado);
    return [prazo && `propostas até ${prazo}`, valor].filter(Boolean).join(' · ');
  }

  /** Só as etapas com tela abrem alguma coisa. */
  protected abre(coluna: ColunaCiclo): boolean {
    return coluna.disponivel;
  }

  protected abrir(cartao: CartaoCiclo): void {
    if (cartao.etapa !== 'oportunidade' && cartao.etapa !== 'cotacao') return;

    const dados: CotadorModalData = {
      titulo: normalizarTitulo(cartao.objeto),
      itens: cartao.itens,
      oportunidadeId: cartao.id,
    };
    // Salvando ou não, volta para o quadro atualizado.
    this.modal
      .abrir<unknown, CotadorModalData>(CotadorModalComponent, dados)
      .subscribe(() => this.carregar());
  }
}
