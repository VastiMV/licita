/**
 * Contratos de Propostas (`apps/propostas`) — a etapa depois do Cotador: a
 * proposta comercial em Word, a empresa (CNPJ) que disputa e os arquivos que
 * sobem junto na plataforma.
 */

import { OportunidadeSalvaResponse } from '../licitacoes/oportunidade-salva.contracts';

export interface EmpresaDaProposta {
  readonly id: number;
  readonly nome: string;
  readonly cnpj: string;
}

export interface PropostaResponse {
  readonly id: number;
  readonly oportunidade_id: number;
  readonly valor: number;
  readonly validade_dias: number;
  readonly empresa: EmpresaDaProposta | null;
  readonly gerada_por: string | null;
  readonly gerada_em: string;
}

export interface ArquivoProposta {
  readonly id: number;
  /** `gerado` = a proposta comercial em Word; `subido` = enviado pela equipe. */
  readonly origem: 'gerado' | 'subido';
  readonly nome: string;
  readonly tamanho: number;
  readonly enviado_por: string | null;
  readonly enviado_em: string;
}

export interface ModeloProposta {
  /** Sem modelo do cliente, vale o padrão do sistema. */
  readonly padrao: boolean;
  readonly nome: string;
  readonly enviado_por: string | null;
  readonly enviado_em: string | null;
}

export interface PropostaDetalhe extends PropostaResponse {
  readonly oportunidade: OportunidadeSalvaResponse;
  readonly empresas: readonly EmpresaDaProposta[];
  readonly arquivos: readonly ArquivoProposta[];
  readonly modelo: ModeloProposta;
}

/** Uma linha de Ciclo › Propostas. */
export interface EmPropostaResponse extends OportunidadeSalvaResponse {
  readonly proposta: PropostaResponse & {
    readonly arquivos: number;
    readonly documento_gerado: boolean;
  };
}

export interface EmPropostaPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly EmPropostaResponse[];
}

export interface EmPropostaParams {
  readonly page?: number;
  readonly page_size?: number;
  readonly ordering?: string;
  readonly busca?: string;
}
