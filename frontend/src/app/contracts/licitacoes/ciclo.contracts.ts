/**
 * Contratos do quadro do Ciclo de Licitação — ver `apps/licitacoes/ciclo.py`
 * no backend. A etapa de cada licitação é calculada lá, a cada leitura:
 * ninguém escolhe etapa nem arrasta cartão.
 */

import { OportunidadeResponse } from './oportunidade.contracts';

export type EtapaCiclo = 'oportunidade' | 'cotacao' | 'proposta' | 'disputa' | 'empenho';

export type NivelAlertaCiclo = 'ok' | 'neutro' | 'aviso' | 'alerta';

export interface CartaoCiclo {
  /** Id da oportunidade salva — a licitação é a mesma do salvar ao fim. */
  readonly id: number;
  readonly etapa: EtapaCiclo;
  readonly uasg: string;
  readonly municipio: string;
  readonly uf: string;
  readonly objeto: string;
  readonly data_encerramento_proposta: string | null;
  readonly valor_total_estimado: number | null;
  readonly cotacao_id: number | null;
  readonly valor_cotado: number | null;
  readonly pendencias: number | null;
  readonly alerta: { readonly nivel: NivelAlertaCiclo; readonly texto: string };
  /** A primeira coisa que falta para a licitação andar. */
  readonly falta: string;
  /** O snapshot do edital — só na etapa Oportunidade, para o Cotador abrir
   * preenchido. */
  readonly itens: readonly OportunidadeResponse[];
}

export interface ColunaCiclo {
  readonly etapa: EtapaCiclo;
  readonly rotulo: string;
  /** Falso enquanto a tela da etapa não existe — a coluna aparece vazia. */
  readonly disponivel: boolean;
  readonly total_estimado: number;
  readonly cartoes: readonly CartaoCiclo[];
}

export interface QuadroCiclo {
  readonly hoje: string;
  readonly resumo: {
    readonly prazo_ate_amanha: number;
    readonly prazo_nesta_semana: number;
    readonly salvas_sem_cotacao: number;
    readonly cotacoes_com_pendencia: number;
  };
  readonly colunas: readonly ColunaCiclo[];
  /** Fora do quadro: prazo perdido (e, quando existirem, perdidas,
   * descartadas e concluídas). */
  readonly encerradas: number;
  readonly dias_sem_cotacao: number;
}
