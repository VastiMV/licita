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
  readonly criterio_julgamento: string | null;
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
  /** Identificam a compra no PNCP — usados pra agrupar itens do mesmo
   * edital num card só e pra buscar `CompraDetalheResponse` sob demanda. */
  readonly contratacao_cnpj_orgao: string | null;
  readonly contratacao_ano_compra: string | null;
  readonly contratacao_sequencial_compra: string | null;
  /** Plataforma onde a disputa acontece (registro em
   * `apps/integracoes/plataformas.py` do backend). Garantidos não-nulos: o
   * backend só devolve oportunidade da plataforma escolhida e com link de
   * disputa — sem link não existe oportunidade. */
  readonly plataforma_id: string;
  readonly link_plataforma: string;
  readonly link_pncp: string | null;
  /** Selo CAPAG já resolvido na busca (caminho da busca textual, que pega
   * os insumos de graça ao filtrar a plataforma). Nulo = sem nota ou o
   * caminho não tinha os insumos — aí o `CompraDetalheResponse` do card é
   * quem tenta resolver. */
  readonly capag: CapagResponse | null;
}

/** Um arquivo do edital (aviso, anexo, termo de referência...), com link de
 * download direto — não precisa passar pelo site do PNCP. */
export interface DocumentoResponse {
  readonly titulo: string | null;
  readonly tipo_documento: string | null;
  readonly url: string | null;
}

/** Nota CAPAG do ente responsável pela compra (município OU estado,
 * conforme a esfera) — `null` quando não há nota (órgão federal, ente não
 * avaliado, ou base ainda não sincronizada). Ver docs/DOMINIO.md. */
export interface CapagResponse {
  readonly nota: string;
  readonly cor: 'verde' | 'amarelo' | 'vermelho';
}

/** A plataforma de origem da compra, resolvida pelo `linkSistemaOrigem` do
 * PNCP. `id` nulo = plataforma real porém não registrada no backend (o link
 * e o nome continuam valendo; só não há ícone próprio). */
export interface PlataformaResponse {
  readonly id: string | null;
  readonly nome: string | null;
  readonly link: string;
}

/** Resposta de `GET .../compras/<cnpj>/<ano>/<sequencial>/detalhe/` —
 * uma chamada por card, disparada quando o resultado da busca chega. */
export interface CompraDetalheResponse {
  readonly documentos: readonly DocumentoResponse[];
  readonly capag: CapagResponse | null;
  readonly plataforma: PlataformaResponse | null;
}
