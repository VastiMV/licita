/**
 * Contratos da cotação (Cotador) de uma oportunidade salva — ver
 * `apps/licitacoes/models.py` (classe `Cotacao`) no backend.
 *
 * Duas coisas do domínio aparecem no formato:
 *
 * - **Percentuais são fração** (0,08 = 8%), como no `cotador.model.ts`. A
 *   tela é quem converte de "8" para 0,08 na borda.
 * - **`valor_total` e `lucro_total` são somente-leitura.** Quem os calcula
 *   é o backend, a partir de `parametros`/`itens` — mandar total no corpo
 *   não muda nada, o servidor recalcula (ver `cotacao.py`).
 */

export interface CotacaoParametros {
  readonly transporte: number;
  readonly garantia: number;
  readonly icms: number;
  readonly pis: number;
  readonly cofins: number;
  readonly ipi: number;
  readonly iss: number;
  readonly lucro_desejado: number;
  readonly lucro_minimo: number;
}

export interface CotacaoItem {
  readonly fornecedor: string;
  readonly quantidade: number;
  readonly valor_unitario_produto: number;
  readonly frete_fixo_unitario: number;
  readonly outros_custos_unitarios: number;
  readonly valor_referencia_edital: number;
  /** O lance corrente do pregão. Vai junto porque a disputa continua
   * depois de fechar o navegador. */
  readonly lance: number;
}

export interface CotacaoRequest {
  readonly parametros: CotacaoParametros;
  readonly itens: readonly CotacaoItem[];
}

export interface CotacaoResponse extends CotacaoRequest {
  readonly id: number;
  readonly valor_total: string;
  readonly lucro_total: string;
  readonly atualizada_por_nome: string;
  readonly criada_em: string;
  readonly atualizada_em: string;
}
