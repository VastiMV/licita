/**
 * Produtos — Fabricante › Marca › Modelo (o produto é o modelo), a afinidade
 * do fornecedor (por fabricante) e a tabela de preços. Ver
 * `apps/produtos/models.py`.
 */

export interface ModeloResponse {
  readonly id: number;
  readonly nome: string;
  readonly marca: number;
}

export interface MarcaResponse {
  readonly id: number;
  readonly nome: string;
  readonly fabricante: number;
  readonly modelos: readonly ModeloResponse[];
}

export interface FornecedorResumo {
  readonly id: number;
  readonly nome: string;
  readonly fantasia: string;
}

export interface FabricanteResponse {
  readonly id: number;
  readonly nome: string;
  /** A afinidade: quem vende este fabricante. */
  readonly fornecedores: readonly FornecedorResumo[];
  readonly marcas: readonly MarcaResponse[];
  readonly marcas_total: number;
  readonly modelos_total: number;
  readonly criado_por: string | null;
  readonly criado_em: string;
}

export interface FabricantesPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly FabricanteResponse[];
}

export interface FabricantesParams {
  readonly page?: number;
  readonly page_size?: number;
  readonly ordering?: string;
  readonly busca?: string;
}

/** Criar é idempotente: nome existente devolve o registro (200). */
export interface FabricanteRequest {
  readonly nome: string;
  readonly fornecedor_ids?: readonly number[];
  /** Grava a afinidade com este fornecedor (criando ou não). */
  readonly fornecedor?: number;
}

export interface OpcaoProduto {
  readonly id: number;
  readonly nome: string;
  /** Só no fabricante: o fornecedor informado vende este. */
  readonly afim?: boolean;
}

export interface PrecoSugerido {
  readonly custo: string;
  readonly registrado_em: string;
  readonly registrado_por: string | null;
}

/** De onde veio o preço: registrado à mão ou aprendido ao salvar uma cotação. */
export type OrigemPreco = 'manual' | 'cotador';

/**
 * Por quanto um fornecedor **me vende** um produto (fornecedor → empresa).
 * Não é o Cotador, que é empresa → órgão público. Ver
 * `apps/produtos/models.PrecoFornecedor`.
 */
export interface PrecoResponse {
  readonly id: number;
  readonly fornecedor: FornecedorResumo;
  /** O nome para mostrar: a descrição livre ou "Fabricante › Marca › Modelo". */
  readonly produto: string;
  readonly descricao: string;
  readonly modelo: number | null;
  readonly embalagem: string;
  readonly quantidade_embalagem: number;
  /** Decimal como string (DRF). */
  readonly preco_embalagem: string;
  /** Custo por unidade = preço da embalagem ÷ quantidade. */
  readonly custo: string;
  readonly observacoes: string;
  readonly origem: OrigemPreco;
  readonly registrado_em: string;
  readonly registrado_por: string | null;
}

export interface PrecosPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly PrecoResponse[];
}

export interface PrecosParams {
  readonly page?: number;
  readonly page_size?: number;
  readonly ordering?: string;
  readonly busca?: string;
  readonly fornecedor?: number;
  /** Também as linhas antigas (preço que mudou). Padrão: só o atual. */
  readonly historico?: 1;
}

/** O custo unitário não vai: o backend calcula da embalagem. */
export interface PrecoRequest {
  readonly fornecedor: number;
  readonly descricao: string;
  readonly modelo?: number | null;
  readonly embalagem: string;
  readonly quantidade_embalagem: number;
  readonly preco_embalagem: number;
  readonly observacoes: string;
}
