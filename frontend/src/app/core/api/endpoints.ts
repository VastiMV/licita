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
    /** Histórico de uma salva — a tela que lê isso ainda não existe (ver
     * docs/DOMINIO.md, "Histórico da oportunidade salva"). */
    salvaEventos: (id: number) => `licitacoes/salvas/${id}/eventos/`,
  },
  alertas: {
    lista: 'alertas/',
  },
} as const;
