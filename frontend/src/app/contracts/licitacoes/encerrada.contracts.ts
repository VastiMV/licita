/**
 * Contratos de "Ciclo de Licitação / Encerradas" — as licitações que saíram
 * do ciclo. O encerramento é calculado no backend (ver
 * `apps/licitacoes/encerradas.py`), nunca gravado.
 */

import { OportunidadeSalvaResponse } from './oportunidade-salva.contracts';

export type MotivoEncerramento = 'descartada' | 'prazo_oportunidade' | 'prazo_cotacao';

export const MOTIVOS_ENCERRAMENTO: readonly { value: MotivoEncerramento; label: string }[] = [
  { value: 'descartada', label: 'Descartada' },
  { value: 'prazo_oportunidade', label: 'Prazo perdido sem cotação' },
  { value: 'prazo_cotacao', label: 'Prazo perdido na cotação' },
];

export interface EncerradaResponse extends OportunidadeSalvaResponse {
  readonly encerrada_em: string;
  readonly motivo: MotivoEncerramento;
  readonly motivo_label: string;
  readonly cotacao_id: number | null;
  readonly valor_cotado: number | null;
  readonly removida_em: string | null;
  readonly removida_por: string | null;
}

export interface EncerradasPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly EncerradaResponse[];
}

export interface EncerradasParams {
  readonly page?: number;
  readonly page_size?: number;
  readonly ordering?: string;
  readonly busca?: string;
  /** Período de encerramento, `aaaa-mm-dd`. */
  readonly data_inicial?: string;
  readonly data_final?: string;
  readonly motivo?: string;
  readonly uf?: string;
}

/** Uma linha do histórico do processo (`GET licitacoes/salvas/<id>/eventos/`). */
export interface EventoProcesso {
  readonly id: number;
  readonly tipo: string;
  readonly tipo_label: string;
  readonly descricao: string;
  /** `null` = evento do sistema (ex.: prazo vencido). */
  readonly autor: string | null;
  readonly dados: Record<string, unknown>;
  readonly ocorrido_em: string;
}

export interface HistoricoProcesso {
  readonly id: number;
  readonly eventos: readonly EventoProcesso[];
}
