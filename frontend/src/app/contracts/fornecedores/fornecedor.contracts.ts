/**
 * Contratos do módulo "Fornecedores" — o cadastro de quem a empresa compra
 * para revender numa licitação. Ver `apps/fornecedores/models.py` no backend.
 *
 * Duas coisas do domínio aparecem no formato:
 *
 * - **A lista é da equipe inteira**, como a de oportunidades salvas: quem
 *   cadastrou é informação, não filtro.
 * - **`cnpj` é só dígitos.** A máscara é da tela (`cnpj_formatado` vem
 *   pronto do backend para a tabela e a planilha não remontarem cada uma a
 *   sua). Mandar com ou sem pontuação dá no mesmo: o backend normaliza.
 */

import type { SelectOption } from '../../shared/ui/select/select.component';

export type TipoFornecedor = 'pj' | 'pf' | 'mei';
export type CategoriaFornecedor =
  'materiais' | 'equipamentos' | 'servicos' | 'logistica' | 'tecnologia';
export type SituacaoFornecedor = 'ativo' | 'em_analise' | 'inativo' | 'documentacao_vencida';
export type CondicaoPagamento = 'a_vista' | '7_dias' | '14_28_dias' | '30_dias' | '30_60_90_dias';

export interface FornecedorResponse {
  readonly id: number;
  readonly nome: string;
  readonly fantasia: string;
  readonly tipo: TipoFornecedor;
  /** Só dígitos — use `cnpj_formatado` para exibir. */
  readonly cnpj: string;
  readonly cnpj_formatado: string;
  readonly inscricao_estadual: string;
  readonly categoria: CategoriaFornecedor;
  readonly categoria_label: string;
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string;
  readonly bairro: string;
  readonly uf: string;
  readonly cidade: string;
  /** "Campinas / SP" — já montado, é a coluna "Cidade" da tabela. */
  readonly cidade_uf: string;
  readonly responsavel: string;
  readonly email: string;
  readonly telefone: string;
  readonly celular: string;
  readonly condicao_pagamento: CondicaoPagamento;
  readonly prazo_entrega_dias: number | null;
  readonly dados_bancarios: string;
  readonly chave_pix: string;
  readonly observacoes: string;
  readonly situacao: SituacaoFornecedor;
  readonly situacao_label: string;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

/** O corpo de `POST`/`PUT` — o formulário inteiro (o modal edita o registro
 * completo, não um pedaço dele). */
export type FornecedorRequest = Omit<
  FornecedorResponse,
  | 'id'
  | 'cnpj_formatado'
  | 'cidade_uf'
  | 'categoria_label'
  | 'situacao_label'
  | 'criado_em'
  | 'atualizado_em'
>;

export interface FornecedoresPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  /** Do cadastro inteiro (não da página nem da busca): é o número do aviso
   * que a tela mostra ao abrir. */
  readonly documentacao_vencida: number;
  readonly results: readonly FornecedorResponse[];
}

export interface FornecedoresParams {
  readonly page?: number;
  readonly page_size?: number;
  /** Nome de coluna da tabela, com `-` para descendente (ex.: `-nome`). */
  readonly ordering?: string;
  readonly busca?: string;
}

/** A versão enxuta que o Cotador usa no seletor de fornecedor de um item —
 * o cadastro inteiro de uma vez, sem paginação. */
export interface FornecedorOpcao {
  readonly id: number;
  readonly nome: string;
  readonly fantasia: string;
  readonly cnpj: string;
  readonly cnpj_formatado: string;
  readonly categoria: CategoriaFornecedor;
  readonly cidade: string;
  readonly uf: string;
  readonly situacao: SituacaoFornecedor;
  readonly situacao_label: string;
  readonly condicao_pagamento: CondicaoPagamento;
  readonly prazo_entrega_dias: number | null;
}

// As listas fechadas ficam aqui, e não na página, porque o modal e a tabela
// consomem as mesmas — e a ordem/rótulo tem que bater com as `TextChoices`
// do backend (`apps/fornecedores/models.py`).

export const TIPOS_FORNECEDOR: readonly SelectOption[] = [
  { value: 'pj', label: 'Pessoa jurídica' },
  { value: 'pf', label: 'Pessoa física' },
  { value: 'mei', label: 'MEI' },
];

export const CATEGORIAS_FORNECEDOR: readonly SelectOption[] = [
  { value: 'materiais', label: 'Materiais' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'logistica', label: 'Logística' },
  { value: 'tecnologia', label: 'Tecnologia' },
];

export const CONDICOES_PAGAMENTO: readonly SelectOption[] = [
  { value: 'a_vista', label: 'À vista' },
  { value: '7_dias', label: '7 dias' },
  { value: '14_28_dias', label: '14/28 dias' },
  { value: '30_dias', label: '30 dias' },
  { value: '30_60_90_dias', label: '30/60/90 dias' },
];

/** Situação não é `<select>` na tela: é uma lista de botões no painel
 * "Situação do fornecedor" (ver o handoff em `docs/Mockups/fornecedores`),
 * porque é a decisão que muda a cor da linha na tabela e merece peso visual.
 * `tom` casa com as pílulas do design system. */
export const SITUACOES_FORNECEDOR: readonly {
  readonly value: SituacaoFornecedor;
  readonly label: string;
  readonly tom: 'sucesso' | 'alerta' | 'neutro' | 'perigo';
}[] = [
  { value: 'ativo', label: 'Ativo', tom: 'sucesso' },
  { value: 'em_analise', label: 'Em análise', tom: 'alerta' },
  { value: 'inativo', label: 'Inativo', tom: 'neutro' },
  { value: 'documentacao_vencida', label: 'Documentação vencida', tom: 'perigo' },
];
