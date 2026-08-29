/**
 * Contratos do módulo "Oportunidades / Salvas" — o que a busca **não** tem:
 * aqui persiste (ver `apps/licitacoes/models.py` no backend).
 *
 * Duas regras do domínio aparecem no formato: a lista é da equipe inteira
 * (por isso `salva_por` é informação, não filtro) e `expirada` é calculada
 * no backend a cada leitura, nunca gravada.
 */

import { CapagResponse, OportunidadeResponse } from './oportunidade.contracts';

export interface OportunidadeSalvaResponse {
  readonly id: number;
  /** `cnpj-ano-sequencial` — mesma chave do card na busca. */
  readonly chave: string;
  readonly cnpj_orgao: string;
  readonly ano_compra: string;
  readonly sequencial_compra: string;
  readonly objeto: string;
  readonly orgao_nome: string;
  readonly uasg: string;
  readonly uf: string;
  readonly municipio: string;
  readonly modalidade: string;
  readonly situacao: string;
  readonly data_publicacao: string | null;
  readonly data_encerramento_proposta: string | null;
  readonly valor_total_estimado: number | null;
  readonly plataforma_id: string;
  readonly plataforma_nome: string;
  readonly link_plataforma: string;
  readonly link_pncp: string;
  readonly capag: CapagResponse | null;
  /** Snapshot do que a busca devolveu — é com ele que o modal desenha o
   * mesmo card sem voltar ao PNCP. */
  readonly itens: readonly OportunidadeResponse[];
  /** Prazo de proposta vencido (calculado no backend a cada leitura). */
  readonly expirada: boolean;
  /** Nome (ou e-mail) de quem salvou — a lista é compartilhada. */
  readonly salva_por: string | null;
  readonly criada_em: string;
}

/** Resposta paginada de `GET /api/licitacoes/salvas/`. `expiradas` é do
 * conjunto inteiro (não da página nem da busca em curso): é o número do
 * aviso que a tela mostra ao abrir. */
export interface OportunidadesSalvasPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly expiradas: number;
  readonly results: readonly OportunidadeSalvaResponse[];
}

export interface OportunidadesSalvasParams {
  readonly page?: number;
  readonly page_size?: number;
  /** Nome de coluna da tabela, com `-` para descendente (ex.: `-prazo`). */
  readonly ordering?: string;
  readonly busca?: string;
}

/** Payload de `POST /api/licitacoes/salvas/`: o resultado da busca daquele
 * edital, mais o que o card resolveu à parte (plataforma do detalhe, selo
 * CAPAG). O resumo da lista é derivado disso no backend. */
export interface OportunidadeSalvaRequest {
  readonly itens: readonly OportunidadeResponse[];
  readonly capag: CapagResponse | null;
  readonly plataforma: { id: string | null; nome: string | null; link: string } | null;
}
