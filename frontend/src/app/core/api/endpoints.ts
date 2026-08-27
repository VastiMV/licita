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
  },
  alertas: {
    lista: 'alertas/',
  },
} as const;
