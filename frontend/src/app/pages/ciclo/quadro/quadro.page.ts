import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CartaoCiclo,
  NivelAlertaCiclo,
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
import {
  OportunidadeModalComponent,
  OportunidadeModalResultado,
} from '../../oportunidades/salvas/oportunidade-modal/oportunidade-modal.component';
import { OportunidadeSalvaResponse } from '../../../contracts/licitacoes/oportunidade-salva.contracts';

/** Quantas faltas o cartão mostra; o resto vira "+N". */
const MAX_FALTAS = 3;

/** Um card do resumo: número, legenda e o nível que pinta a borda. */
interface Indicador {
  readonly valor: number;
  readonly legenda: string;
  readonly nivel: NivelAlertaCiclo;
}

/** Verde quando não há nada a fazer; senão o nível que o número pede. */
const nivelSe = (valor: number, nivel: NivelAlertaCiclo): NivelAlertaCiclo =>
  valor > 0 ? nivel : 'ok';

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
 * O quadro existe para mostrar o que falta: cada cartão lista, em concreto,
 * o que impede a licitação de andar, e traz o botão que a leva à etapa
 * seguinte. Tudo reaproveita os modais que já existem — Oportunidade abre o
 * visualizador da salva (que tem "Iniciar cotação"), Cotação abre o
 * Cotador. Fechar recarrega o quadro. "Gerar proposta" aparece desabilitado
 * até a tela de Proposta existir.
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

  /** Os quatro cards do resumo do dia. */
  protected readonly indicadores = computed<readonly Indicador[]>(() => {
    const q = this.quadro();
    if (!q) return [];
    const r = q.resumo;
    return [
      {
        valor: r.prazo_ate_amanha,
        legenda: 'com prazo de proposta até amanhã',
        nivel: nivelSe(r.prazo_ate_amanha, 'alerta'),
      },
      {
        valor: r.prazo_nesta_semana,
        legenda: 'com prazo de proposta nesta semana',
        nivel: nivelSe(r.prazo_nesta_semana, 'aviso'),
      },
      {
        valor: r.salvas_sem_cotacao,
        legenda: `salvas há mais de ${q.dias_sem_cotacao} dias sem cotação`,
        nivel: nivelSe(r.salvas_sem_cotacao, 'aviso'),
      },
      {
        valor: r.cotacoes_com_pendencia,
        legenda: 'cotações com item sem preço',
        nivel: nivelSe(r.cotacoes_com_pendencia, 'aviso'),
      },
    ];
  });

  /** Os dois cards menores: o que já saiu do ciclo. */
  protected readonly encerradas = computed<readonly Indicador[]>(() => {
    const e = this.quadro()?.encerradas;
    if (!e) return [];
    return [
      {
        valor: e.vencidas,
        legenda: 'vencidas — prazo de proposta perdido',
        nivel: nivelSe(e.vencidas, 'aviso'),
      },
      { valor: e.concluidas, legenda: 'encerradas por completo', nivel: 'neutro' },
    ];
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

  protected faltasVisiveis(cartao: CartaoCiclo): readonly string[] {
    return cartao.faltas.slice(0, MAX_FALTAS);
  }

  protected faltasOcultas(cartao: CartaoCiclo): number {
    return Math.max(cartao.faltas.length - MAX_FALTAS, 0);
  }

  /** Clique no cartão: a tela da etapa em que ele está. */
  protected abrir(cartao: CartaoCiclo): void {
    if (cartao.etapa === 'oportunidade' && cartao.salva) {
      this.modal
        .abrir<OportunidadeModalResultado, OportunidadeSalvaResponse>(
          OportunidadeModalComponent,
          cartao.salva,
        )
        .subscribe((resultado) => {
          if (resultado === 'cotar') this.cotar(cartao);
          else this.carregar();
        });
      return;
    }
    if (cartao.etapa === 'cotacao') this.cotar(cartao);
  }

  /** Abre o Cotador: em branco, com os itens do edital, na etapa
   * Oportunidade; com a cotação salva, na etapa Cotação. Salvando ou não,
   * volta para o quadro atualizado — salvar a primeira cotação é o que move
   * o cartão de coluna. */
  protected cotar(cartao: CartaoCiclo): void {
    const dados: CotadorModalData = {
      titulo: normalizarTitulo(cartao.objeto),
      itens: cartao.salva?.itens ?? [],
      oportunidadeId: cartao.id,
    };
    this.modal
      .abrir<unknown, CotadorModalData>(CotadorModalComponent, dados)
      .subscribe(() => this.carregar());
  }
}
