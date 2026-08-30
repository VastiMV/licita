/** Formação de preço para pregão — as fórmulas da planilha
 * "Planilha_Licitacoes_Lucro_Sobre_Custo.xlsx" (aba "Formação de Preço"),
 * traduzidas para funções puras. Separadas do componente pra dar pra testar
 * sem montar DOM, igual `edital-card.utils.ts`.
 *
 * Duas bases de percentual convivem aqui e trocá-las é o erro clássico
 * dessa conta:
 *
 * - **% do custo** (transporte, garantia, lucro): incidem sobre o valor
 *   pago ao fornecedor. "35% de lucro" = ganhar 35% sobre o que o produto
 *   custou, não 35% do preço de venda.
 * - **% da venda** (ICMS/Simples, PIS, COFINS, IPI, ISS): incidem sobre o
 *   preço final, que é justamente o que se quer descobrir. Por isso o preço
 *   não é "custo + margem": é uma divisão por `(1 - impostos)`, que embute
 *   o imposto que ainda vai incidir sobre ele mesmo.
 *
 * Todos os percentuais entram aqui como **fração** (0,08 = 8%). A tela
 * converte de "8" para 0,08 na borda — ver `cotador.page.ts`.
 */

/** Um item da cotação: o que o usuário digita por linha. */
export interface ItemCotacao {
  readonly fornecedor: string;
  readonly quantidade: number;
  /** Valor unitário pago ao fornecedor (coluna C da planilha). */
  readonly valorUnitarioProduto: number;
  /** Frete em R$/un., quando não é percentual (coluna S). */
  readonly freteFixoUnitario: number;
  /** Qualquer outro custo em R$/un. (coluna T). */
  readonly outrosCustosUnitarios: number;
  /** Valor unitário de referência do edital, pra calcular o desconto
   * (coluna U). Zero = edital sem referência informada. */
  readonly valorReferenciaEdital: number;
}

/** Percentuais que valem para a cotação inteira (bloco
 * "CUSTOS / PERCENTUAIS" da planilha, células B16..B27). */
export interface ParametrosCotacao {
  readonly transporte: number;
  readonly garantia: number;
  readonly icms: number;
  readonly pis: number;
  readonly cofins: number;
  readonly ipi: number;
  readonly iss: number;
  readonly lucroDesejado: number;
  readonly lucroMinimo: number;
}

export interface ItemCalculado {
  readonly item: ItemCotacao;
  /** Soma de ICMS + PIS + COFINS + IPI + ISS (coluna M). */
  readonly impostos: number;
  /** `1 / (1 - impostos)` — quanto o preço precisa inflar pra sobrar o
   * líquido depois do imposto (coluna N). */
  readonly fatorVenda: number;
  /** Produto + transporte + garantia + frete fixo + outros, por unidade.
   * É o desembolso real; não inclui imposto (que é sobre a venda) nem
   * lucro (coluna J17). */
  readonly custoUnitario: number;
  /** Preço que paga custo + imposto e ainda deixa o lucro desejado
   * (coluna O). */
  readonly precoUnitarioFinal: number;
  readonly precoTotalFinal: number;
  /** Piso pra continuar dando lance: mesma conta do preço final, mas com o
   * lucro mínimo no lugar do desejado (célula L17). */
  readonly precoMinimo: number;
  /** Preço em que cobre custo e imposto e não ganha nada (coluna W). */
  readonly precoEquilibrio: number;
  readonly lucroLiquidoUnitario: number;
  readonly lucroLiquidoTotal: number;
  /** Dinheiro que precisa sair do caixa pra entregar (coluna X) — não
   * depende do preço de venda, só do custo. */
  readonly capitalNecessario: number;
  /** Quanto o preço final está abaixo da referência do edital (coluna V).
   * Zero quando não há referência informada. */
  readonly descontoSobreReferencia: number;
}

export type StatusLance =
  'DIGITE O LANCE' | 'PREJUÍZO' | 'ABAIXO DO MÍNIMO' | 'LIMITE' | 'PODE BAIXAR' | 'LUCRO IDEAL';

export interface AvaliacaoLance {
  readonly lance: number;
  /** Lucro líquido comparado ao valor pago no produto (célula N17) — a
   * mesma base do "lucro desejado", pra dar pra comparar os dois. */
  readonly lucroSobreCusto: number;
  readonly lucroLiquidoUnitario: number;
  readonly lucroLiquidoTotal: number;
  /** Quanto ainda dá pra baixar sem furar o preço mínimo (célula Q17). */
  readonly podeBaixar: number;
  /** `podeBaixar` como fração do lance atual (célula R17). */
  readonly ateLimite: number;
  /** Desconto do lance sobre a referência do edital (célula M20). */
  readonly descontoDoLance: number;
  readonly status: StatusLance;
}

export type SituacaoDegrau = 'CONFORTÁVEL' | 'ATENÇÃO' | 'LIMITE';

export interface DegrauSimulado {
  readonly lance: number;
  readonly lucroSobreCusto: number;
  readonly lucroLiquidoUnitario: number;
  readonly lucroLiquidoTotal: number;
  /** Distância até o preço mínimo (célula N25). */
  readonly distanciaDoMinimo: number;
  readonly situacao: SituacaoDegrau;
}

export interface TotaisCotacao {
  readonly quantidade: number;
  readonly custoTotalProdutos: number;
  readonly precoTotalFinal: number;
  /** Preço médio ponderado pela quantidade (célula O11) — não é a média
   * simples dos preços unitários. */
  readonly precoUnitarioMedio: number;
  readonly lucroLiquidoTotal: number;
  readonly capitalNecessario: number;
  readonly referenciaTotal: number;
}

export const ITEM_VAZIO: ItemCotacao = {
  fornecedor: '',
  quantidade: 1,
  valorUnitarioProduto: 0,
  freteFixoUnitario: 0,
  outrosCustosUnitarios: 0,
  valorReferenciaEdital: 0,
};

/** Padrões da planilha original (B16..B27): transporte 8%, ICMS/Simples
 * 10%, lucro desejado 35%, lucro mínimo 10%. */
export const PARAMETROS_PADRAO: ParametrosCotacao = {
  transporte: 0.08,
  garantia: 0,
  icms: 0.1,
  pis: 0,
  cofins: 0,
  ipi: 0,
  iss: 0,
  lucroDesejado: 0.35,
  lucroMinimo: 0.1,
};

/** Guarda de divisão por zero — é o `IFERROR(...;0)` que a planilha repete
 * em toda coluna calculada. */
function dividir(numerador: number, denominador: number): number {
  return denominador === 0 ? 0 : numerador / denominador;
}

export function somarImpostos(parametros: ParametrosCotacao): number {
  return parametros.icms + parametros.pis + parametros.cofins + parametros.ipi + parametros.iss;
}

export function calcularItem(item: ItemCotacao, parametros: ParametrosCotacao): ItemCalculado {
  const produto = item.valorUnitarioProduto;
  const impostos = somarImpostos(parametros);
  // Imposto de 100% ou mais não tem preço que feche a conta: a planilha cai
  // no IFERROR e zera. Mantemos o mesmo comportamento em vez de devolver
  // Infinity, que envenenaria todos os totais da tela.
  const sobra = 1 - impostos;

  const custoUnitario =
    produto +
    produto * parametros.transporte +
    produto * parametros.garantia +
    item.freteFixoUnitario +
    item.outrosCustosUnitarios;

  const precoUnitarioFinal = dividir(custoUnitario + produto * parametros.lucroDesejado, sobra);
  const precoMinimo = dividir(custoUnitario + produto * parametros.lucroMinimo, sobra);
  const precoEquilibrio = dividir(custoUnitario, sobra);
  const lucroLiquidoUnitario = precoUnitarioFinal - precoUnitarioFinal * impostos - custoUnitario;

  return {
    item,
    impostos,
    fatorVenda: dividir(1, sobra),
    custoUnitario,
    precoUnitarioFinal,
    precoTotalFinal: item.quantidade * precoUnitarioFinal,
    precoMinimo,
    precoEquilibrio,
    lucroLiquidoUnitario,
    lucroLiquidoTotal: item.quantidade * lucroLiquidoUnitario,
    capitalNecessario: item.quantidade * custoUnitario,
    descontoSobreReferencia: dividir(
      item.valorReferenciaEdital - precoUnitarioFinal,
      item.valorReferenciaEdital,
    ),
  };
}

function statusDoLance(
  lance: number,
  lucroSobreCusto: number,
  calculado: ItemCalculado,
  parametros: ParametrosCotacao,
): StatusLance {
  if (lance === 0) return 'DIGITE O LANCE';
  // Abaixo do equilíbrio nem os custos voltam — vem antes de qualquer
  // comparação de margem, senão um lance ruinoso apareceria só como
  // "abaixo do mínimo".
  if (lance < calculado.precoEquilibrio) return 'PREJUÍZO';
  if (lucroSobreCusto < parametros.lucroMinimo) return 'ABAIXO DO MÍNIMO';
  if (lucroSobreCusto === parametros.lucroMinimo) return 'LIMITE';
  if (lucroSobreCusto < parametros.lucroDesejado) return 'PODE BAIXAR';
  return 'LUCRO IDEAL';
}

/** O "PAINEL DE LANCES" da planilha: dado um lance digitado no meio do
 * pregão, diz se ainda compensa e quanto ainda dá pra baixar. */
export function avaliarLance(
  lance: number,
  calculado: ItemCalculado,
  parametros: ParametrosCotacao,
): AvaliacaoLance {
  const { item, impostos, custoUnitario } = calculado;
  const lucroLiquidoUnitario = lance - lance * impostos - custoUnitario;
  const lucroSobreCusto = dividir(lucroLiquidoUnitario, item.valorUnitarioProduto);
  const podeBaixar = Math.max(lance - calculado.precoMinimo, 0);

  return {
    lance,
    lucroSobreCusto,
    lucroLiquidoUnitario,
    lucroLiquidoTotal: item.quantidade * lucroLiquidoUnitario,
    podeBaixar,
    ateLimite: dividir(podeBaixar, lance),
    descontoDoLance: dividir(item.valorReferenciaEdital - lance, item.valorReferenciaEdital),
    status: statusDoLance(lance, lucroSobreCusto, calculado, parametros),
  };
}

/** Fatia do intervalo preço mínimo → preço final que cada degrau do
 * simulador representa (colunas J25..J29 da planilha). */
const DEGRAUS = [1, 0.75, 0.5, 0.25, 0] as const;

/** O "SIMULADOR AUTOMÁTICO DE LANCES": cinco preços entre o mínimo e o
 * final, pra enxergar de antemão até onde dá pra ir num pregão. */
export function simularDegraus(
  calculado: ItemCalculado,
  parametros: ParametrosCotacao,
): readonly DegrauSimulado[] {
  const { precoMinimo, precoUnitarioFinal } = calculado;

  return DEGRAUS.map((fatia) => {
    const lance = precoMinimo + (precoUnitarioFinal - precoMinimo) * fatia;
    const avaliacao = avaliarLance(lance, calculado, parametros);

    return {
      lance,
      lucroSobreCusto: avaliacao.lucroSobreCusto,
      lucroLiquidoUnitario: avaliacao.lucroLiquidoUnitario,
      lucroLiquidoTotal: avaliacao.lucroLiquidoTotal,
      distanciaDoMinimo: Math.max(lance - precoMinimo, 0),
      situacao:
        avaliacao.lucroSobreCusto >= parametros.lucroDesejado
          ? 'CONFORTÁVEL'
          : avaliacao.lucroSobreCusto > parametros.lucroMinimo
            ? 'ATENÇÃO'
            : 'LIMITE',
    };
  });
}

/** Linha TOTAL da planilha (linha 11). */
export function totalizar(calculados: readonly ItemCalculado[]): TotaisCotacao {
  const quantidade = calculados.reduce((soma, c) => soma + c.item.quantidade, 0);
  const precoTotalFinal = calculados.reduce((soma, c) => soma + c.precoTotalFinal, 0);

  return {
    quantidade,
    custoTotalProdutos: calculados.reduce(
      (soma, c) => soma + c.item.quantidade * c.item.valorUnitarioProduto,
      0,
    ),
    precoTotalFinal,
    precoUnitarioMedio: dividir(precoTotalFinal, quantidade),
    lucroLiquidoTotal: calculados.reduce((soma, c) => soma + c.lucroLiquidoTotal, 0),
    capitalNecessario: calculados.reduce((soma, c) => soma + c.capitalNecessario, 0),
    referenciaTotal: calculados.reduce(
      (soma, c) => soma + c.item.quantidade * c.item.valorReferenciaEdital,
      0,
    ),
  };
}
