/**
 * Contratos da busca de oportunidades — não persiste no backend, é consulta
 * ao vivo (PNCP + catálogo de materiais). Ver docs/DOMINIO.md, seção "Busca
 * de oportunidades", no repositório principal.
 */

export interface OportunidadeBuscaParams {
  readonly palavra_chave?: string;
  readonly uf?: string;
  readonly codigo_unidade?: string;
  readonly modalidade?: string;
  readonly data_inicial?: string;
  readonly data_final?: string;
}

export interface OportunidadeResponse {
  readonly numero_item: string | null;
  readonly descricao_resumida: string | null;
  readonly descricao_detalhada: string | null;
  readonly quantidade: number | null;
  readonly unidade_medida: string | null;
  readonly valor_unitario_estimado: number | null;
  readonly valor_total: number | null;
  readonly tipo_beneficio: string | null;
  readonly contratacao_uf: string | null;
  readonly contratacao_modalidade: string | null;
  readonly contratacao_srp: boolean;
  readonly contratacao_situacao: string | null;
  readonly situacao_item: string | null;
  readonly contratacao_data_publicacao: string | null;
  readonly contratacao_data_encerramento_proposta: string | null;
  readonly contratacao_orgao_nome: string | null;
  readonly contratacao_municipio: string | null;
  readonly contratacao_uasg: string | null;
  readonly contratacao_objeto: string | null;
  readonly link_compras_gov: string;
  readonly link_pncp: string | null;
}
