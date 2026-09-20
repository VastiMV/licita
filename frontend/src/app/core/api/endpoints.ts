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
  /** Onde os arquivos ficam (`apps/armazenamento`) — driver escolhido e
   * configurado pelo cliente, só por administrador. */
  armazenamento: {
    drivers: 'armazenamento/drivers/',
    config: 'armazenamento/config/',
    testar: 'armazenamento/testar/',
  },
  /** O dossiê de habilitação da empresa (`apps/documentos`) — certidões,
   * contrato social, balanço. Não confundir com os documentos da
   * **licitação**, que são arquivo de uma fase do processo. */
  documentos: {
    lista: 'documentos/',
    tipos: 'documentos/tipos/',
    detalhe: (id: number) => `documentos/${id}/`,
    restaurar: (id: number) => `documentos/${id}/restaurar/`,
    versoes: (id: number) => `documentos/${id}/versoes/`,
    eventos: (id: number) => `documentos/${id}/eventos/`,
    download: (versaoId: number) => `documentos/versoes/${versaoId}/download/`,
  },
  /** Os CNPJs com que a equipe disputa (`apps/empresas`) — não confundir
   * com `fornecedores`, que é de quem a equipe compra. */
  empresas: {
    lista: 'empresas/',
    detalhe: (id: number) => `empresas/${id}/`,
    /** Cadastro enxuto — o seletor de "com qual CNPJ eu disputo". */
    opcoes: 'empresas/opcoes/',
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
