/**
 * Contratos de `Filtro` — ver docs/DOMINIO.md no repositório principal.
 * `palavras_chave` é texto separado por vírgula dos dois lados (é assim que
 * o backend guarda e devolve); o componente de página decide como editar
 * isso, o contrato só descreve o formato da API.
 */

export interface FiltroRequest {
  readonly nome: string;
  readonly palavras_chave?: string;
  readonly uf?: string;
  readonly modalidade?: string;
  readonly uasg?: string;
  readonly ativo?: boolean;
  readonly email_notificacao?: string;
}

export interface FiltroResponse {
  readonly id: number;
  readonly nome: string;
  readonly palavras_chave: string | null;
  readonly uf: string | null;
  readonly modalidade: string | null;
  readonly uasg: string | null;
  readonly ativo: boolean;
  readonly email_notificacao: string | null;
  readonly criado_em: string;
}
