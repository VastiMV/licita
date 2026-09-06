/**
 * Caminhos da API, centralizados. Nenhum serviço de domínio escreve uma
 * string de rota solta — todos importam daqui, então mudar uma rota no
 * backend é uma mudança num só lugar no frontend.
 */
export const ENDPOINTS = {
  auth: {
    login: 'auth/login/',
    refresh: 'auth/refresh/',
    logout: 'auth/logout/',
  },
  filtros: {
    lista: 'filtros/',
    detalhe: (id: number) => `filtros/${id}/`,
  },
  licitacoes: {
    oportunidades: 'licitacoes/oportunidades/',
    compraDetalhe: (cnpj: string, ano: string | number, sequencial: string | number) =>
      `licitacoes/compras/${cnpj}/${ano}/${sequencial}/detalhe/`,
    salvas: 'licitacoes/salvas/',
    salvasChaves: 'licitacoes/salvas/chaves/',
    salvasExpiradas: 'licitacoes/salvas/expiradas/',
    salva: (id: number) => `licitacoes/salvas/${id}/`,
    /** Cotação (Cotador) de uma salva — GET/PUT/DELETE, um-para-um. */
    salvaCotacao: (id: number) => `licitacoes/salvas/${id}/cotacao/`,
    /** Histórico de uma salva — a tela que lê isso ainda não existe (ver
     * docs/DOMINIO.md, "Histórico da oportunidade salva"). */
    salvaEventos: (id: number) => `licitacoes/salvas/${id}/eventos/`,
  },
  fornecedores: {
    lista: 'fornecedores/',
    detalhe: (id: number) => `fornecedores/${id}/`,
    /** Cadastro inteiro, enxuto — o seletor de fornecedor do Cotador. */
    opcoes: 'fornecedores/opcoes/',
  },
  /** O Cotador novo (`apps/cotador`). Não confundir com
   * `licitacoes.salvaCotacao`, que é o cotador antigo. */
  cotador: {
    cotacoes: 'cotador/cotacoes/',
    cotacao: (id: number) => `cotador/cotacoes/${id}/`,
    planilha: (id: number) => `cotador/cotacoes/${id}/planilha/`,
    /** A cotação de uma oportunidade salva — 404 quando ainda não foi
     * cotada, que é o sinal de abrir o modal em branco. */
    cotacaoDaOportunidade: (oportunidadeId: number) =>
      `cotador/oportunidades/${oportunidadeId}/cotacao/`,
  },
  alertas: {
    lista: 'alertas/',
  },
} as const;
