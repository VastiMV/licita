/**
 * Contratos do módulo "Empresas" — os CNPJs com que a equipe **disputa**.
 * Ver `apps/empresas/models.py` no backend.
 *
 * Não confundir com `Fornecedor`, que é de quem a empresa compra para
 * revender. Aqui o que importa é habilitação: porte, inscrições, certidões.
 *
 * Como no fornecedor, `cnpj` é só dígitos — `cnpj_formatado` vem pronto do
 * backend para a tabela não remontar máscara em JS. Mandar com ou sem
 * pontuação dá no mesmo.
 */

import type { SelectOption } from '../../shared/ui/select/select.component';

export type PorteEmpresa = 'mei' | 'me' | 'epp' | 'demais';

export interface EmpresaResponse {
  readonly id: number;
  readonly nome: string;
  readonly fantasia: string;
  /** Só dígitos — use `cnpj_formatado` para exibir. */
  readonly cnpj: string;
  readonly cnpj_formatado: string;
  readonly porte: PorteEmpresa;
  readonly porte_label: string;
  readonly inscricao_estadual: string;
  readonly inscricao_municipal: string;
  readonly cnae_principal: string;
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string;
  readonly bairro: string;
  readonly uf: string;
  readonly cidade: string;
  /** "São Paulo / SP" — já montado, é a coluna "Cidade" da tabela. */
  readonly cidade_uf: string;
  readonly responsavel_legal: string;
  readonly email: string;
  readonly telefone: string;
  readonly observacoes: string;
  /** A que já vem escolhida na proposta. Uma por operação. */
  readonly padrao: boolean;
  readonly ativa: boolean;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

/** O corpo de `POST`/`PUT` — o formulário inteiro (o modal edita o registro
 * completo, não um pedaço dele). */
export type EmpresaRequest = Omit<
  EmpresaResponse,
  'id' | 'cnpj_formatado' | 'cidade_uf' | 'porte_label' | 'criado_em' | 'atualizado_em'
>;

export interface EmpresasPagina {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly EmpresaResponse[];
}

export interface EmpresasParams {
  readonly page?: number;
  readonly page_size?: number;
  /** Nome de coluna da tabela, com `-` para descendente (ex.: `-nome`). */
  readonly ordering?: string;
  readonly busca?: string;
}

/** A versão enxuta do seletor "com qual CNPJ eu disputo". Com uma opção só,
 * a tela não mostra seletor nenhum — mas ainda precisa perguntar para
 * descobrir isso. */
export interface EmpresaOpcao {
  readonly id: number;
  readonly nome: string;
  readonly fantasia: string;
  readonly cnpj: string;
  readonly cnpj_formatado: string;
  readonly porte: PorteEmpresa;
  readonly porte_label: string;
  readonly padrao: boolean;
}

/** Porte não é papelada: ME e EPP têm empate ficto e prazo para regularizar
 * certidão fiscal depois de vencer (LC 123). Ordem e rótulo batem com as
 * `TextChoices` do backend. */
export const PORTES_EMPRESA: readonly SelectOption[] = [
  { value: 'mei', label: 'MEI' },
  { value: 'me', label: 'Microempresa (ME)' },
  { value: 'epp', label: 'Empresa de pequeno porte (EPP)' },
  { value: 'demais', label: 'Demais' },
];

/** O registro que voltou do backend, pronto para ser reenviado num `PUT`.
 *
 * Existe porque duas ações da tabela — "definir como padrão" e "reativar" —
 * mudam **um** campo, mas o endpoint é `PUT` (o modal manda o formulário
 * inteiro, e aceitar parcial esconderia um campo apagado de propósito). Em
 * vez de espalhar esse recorte por cada ação, ele fica aqui, ao lado do
 * tipo que ele recorta. */
export function paraRequest(empresa: EmpresaResponse): EmpresaRequest {
  const { id, cnpj_formatado, cidade_uf, porte_label, criado_em, atualizado_em, ...request } =
    empresa;
  return request;
}
