/**
 * Contratos de "Ciclo de Licitação / Cotador" — as licitações na etapa
 * Cotação: salvas com cotação e prazo aberto (`GET licitacoes/cotacoes/`).
 */

import { OportunidadeSalvaResponse } from './oportunidade-salva.contracts';

/** O selo do cartão do quadro (`ciclo.situacao_da_cotacao`). */
export interface SeloCotacao {
  readonly nivel: 'ok' | 'neutro' | 'aviso' | 'alerta';
  readonly texto: string;
  /** O que falta, em ordem de gravidade. */
  readonly faltas: readonly string[];
}

export interface EmCotacaoResponse extends OportunidadeSalvaResponse {
  readonly cotacao_id: number;
  readonly valor_cotado: number;
  readonly cotacao_atualizada_em: string;
  readonly pendencias: number;
  readonly selo: SeloCotacao;
}

export interface EmCotacaoPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly EmCotacaoResponse[];
}

export interface EmCotacaoParams {
  readonly page?: number;
  readonly page_size?: number;
  readonly ordering?: string;
  readonly busca?: string;
}
