/**
 * A conta do Cotador — formação de preço com comparação de fornecedores.
 *
 * Espelha `apps/cotador/formulas.py`: as duas implementações são ancoradas
 * nos mesmos exemplos (`cotador.model.spec.ts` aqui, `test_formulas.py`
 * lá), então se uma derivar o teste da outra continua de pé e a divergência
 * aparece. Esta roda a cada tecla enquanto o operador digita; a de lá é
 * quem grava — total não pode vir do cliente.
 *
 * Funções puras, separadas do componente pra dar pra testar sem montar DOM
 * (mesmo padrão de `edital-card.utils.ts`).
 *
 * ## As duas bases de percentual
 *
 * Trocá-las é o erro clássico desta conta:
 *
 * - **% sobre o custo** — transporte, garantia e lucro incidem sobre o que
 *   se paga ao fornecedor. "35% de lucro" é ganhar 35% do que custou.
 * - **% sobre a venda** — os tributos (ICMS/Simples, PIS, COFINS, IPI e ISS
 *   já somados num número só) incidem sobre o preço final, que é justamente
 *   o que se quer descobrir.
 *
 * Por isso o preço não é "custo + margem": é uma divisão por
 * `(1 − tributos)`, que embute o imposto que ainda vai cair sobre o próprio
 * preço.
 *
 * Percentuais entram como **percentual** (35 = 35%), o mesmo número do
 * slider — a divisão por 100 acontece só aqui dentro.
 */

/** Teto da carga tributária. Acima de 90% a divisão explode o preço (e em
 * 100% seria divisão por zero): não existe preço que feche a conta. */
export const TETO_TRIBUTOS = 0.9;

/** Abaixo disso dois custos são "o mesmo preço" — não vale sugerir troca de
 * fornecedor por meio centavo de arredondamento. */
export const TOLERANCIA = 0.005;

export interface OfertaCotador {
  /** Id local (não do banco): o item pode ter ofertas ainda não salvas. */
  readonly id: string;
  /** Fornecedor do cadastro. Nulo = digitado à mão nesta cotação. */
  readonly fornecedorId: number | null;
  readonly nome: string;
  readonly custoProduto: number;
  readonly frete: number;
  readonly outros: number;
}

export interface ItemCotador {
  readonly id: string;
  readonly numeroItem: string;
  readonly descricao: string;
  readonly unidade: string;
  readonly quantidade: number;
  /** O unitário estimado do edital. Nulo = edital sem referência. */
  readonly valorReferencia: number | null;
  /** Nulo = usa o padrão da cotação. Zero é decisão (vender no custo), por
   * isso o ausente não pode ser 0. */
  readonly margemMinima: number | null;
  readonly margemMaxima: number | null;
  readonly impostos: number | null;
  readonly ofertas: readonly OfertaCotador[];
  /** Id da oferta que entra no cálculo. */
  readonly escolhida: string;
}

export interface PadroesCotador {
  readonly transporte: number;
  readonly garantia: number;
  readonly lucroMinimo: number;
  readonly lucroMaximo: number;
  readonly impostos: number;
}

export const PADROES_INICIAIS: PadroesCotador = {
  transporte: 8,
  garantia: 0,
  lucroMinimo: 10,
  lucroMaximo: 35,
  impostos: 10,
};

/** Um degrau da "memória de cálculo" — a escada que mostra como se chegou
 * no preço. `sinal` é `+`, `=` ou vazio. */
export interface DegrauCalculo {
  readonly sinal: '' | '+' | '=';
  readonly rotulo: string;
  readonly valor: number;
  /** Linha de subtotal (custo unitário, preço final) — destacada. */
  readonly forte: boolean;
}

export interface ItemCalculado {
  readonly escolhida: OfertaCotador | null;
  readonly melhor: OfertaCotador | null;
  readonly quantidade: number;
  readonly custoUnitario: number;
  readonly margemMinima: number;
  readonly margemMaxima: number;
  /** Fração já limitada pelo teto (0,10 = 10%). */
  readonly tributos: number;
  readonly precoFinalUnitario: number;
  readonly precoReservaUnitario: number;
  readonly lucroUnitario: number;
  readonly impostoUnitario: number;
  readonly folgaUnitaria: number;
  readonly precoFinalTotal: number;
  readonly precoReservaTotal: number;
  readonly lucroTotal: number;
  /** Sem descrição ou sem preço do fornecedor escolhido — não dá para levar
   * ao pregão assim. */
  readonly incompleto: boolean;
  /** Quanto se economizaria por unidade trocando para o melhor fornecedor.
   * Zero quando o escolhido já é o melhor. */
  readonly economiaUnitaria: number;
  /** `true` quando o preço proposto já está no piso — não dá para negociar
   * mais. */
  readonly noLimite: boolean;
  readonly memoria: readonly DegrauCalculo[];
}

export interface TotaisCotador {
  readonly itens: number;
  readonly unidades: number;
  /** Só o que vai para o fornecedor, sem frete nem extras. */
  readonly custoProdutos: number;
  /** O desembolso real para entregar — com frete e extras. */
  readonly capital: number;
  readonly transporte: number;
  readonly garantia: number;
  readonly impostos: number;
  readonly valorCotado: number;
  readonly precoReserva: number;
  readonly folga: number;
  readonly lucroTotal: number;
  /** Lucro como % da venda — a leitura de quem olha a proposta. */
  readonly lucroPercentual: number;
  /** Lucro como % do capital — a leitura de quem põe o dinheiro. */
  readonly margemMedia: number;
  readonly economia: number;
  readonly pendencias: number;
}

/** Divisão que devolve zero em vez de `Infinity`/`NaN` — é o
 * `IFERROR(...;0)` que a planilha de origem repete em toda coluna
 * calculada. Uma cotação vazia não pode derrubar a tela. */
function dividir(numerador: number, denominador: number): number {
  return denominador === 0 ? 0 : numerador / denominador;
}

function ouPadrao(valor: number | null, padrao: number): number {
  return valor === null ? padrao : valor;
}

export function custoUnitarioDa(oferta: OfertaCotador): number {
  return oferta.custoProduto + oferta.frete + oferta.outros;
}

/** Fornecedor sem preço não concorre a "mais barato" — senão o campo em
 * branco venceria toda comparação. */
export function temPreco(oferta: OfertaCotador): boolean {
  return oferta.custoProduto > 0;
}

/** A oferta que entra na conta. Sem marcação válida, a primeira — um item
 * recém-criado tem um fornecedor só e ainda não foi marcado. */
export function ofertaEscolhida(item: ItemCotador): OfertaCotador | null {
  return item.ofertas.find((o) => o.id === item.escolhida) ?? item.ofertas[0] ?? null;
}

export function melhorOferta(item: ItemCotador): OfertaCotador | null {
  const comPreco = item.ofertas.filter(temPreco);
  if (comPreco.length === 0) return null;
  return comPreco.reduce((a, b) => (custoUnitarioDa(b) < custoUnitarioDa(a) ? b : a));
}

export function calcularItem(item: ItemCotador, padroes: PadroesCotador): ItemCalculado {
  const escolhida = ofertaEscolhida(item);
  const melhor = melhorOferta(item);

  const custoUnitario = escolhida ? custoUnitarioDa(escolhida) : 0;
  const quantidade = Math.max(item.quantidade, 0);

  // Transporte e garantia entram como acréscimo sobre o custo, junto com a
  // margem.
  const sobreCusto = (padroes.transporte + padroes.garantia) / 100;

  const margemMinima = ouPadrao(item.margemMinima, padroes.lucroMinimo);
  // A máxima nunca fica abaixo da mínima: os dois sliders se travam entre si
  // na tela, e uma cotação salva antes de o mínimo subir não pode passar a
  // propor menos que o próprio piso.
  const margemMaxima = Math.max(ouPadrao(item.margemMaxima, padroes.lucroMaximo), margemMinima);

  const tributos = Math.min(ouPadrao(item.impostos, padroes.impostos) / 100, TETO_TRIBUTOS);

  const preco = (margem: number) =>
    dividir(custoUnitario * (1 + sobreCusto + margem / 100), 1 - tributos);

  const precoFinalUnitario = preco(margemMaxima);
  const precoReservaUnitario = preco(margemMinima);
  const impostoUnitario = precoFinalUnitario * tributos;
  const lucroUnitario = (custoUnitario * margemMaxima) / 100;

  const economiaUnitaria =
    melhor && escolhida && melhor.id !== escolhida.id
      ? Math.max(custoUnitario - custoUnitarioDa(melhor), 0)
      : 0;

  const transporteUnitario = (custoUnitario * padroes.transporte) / 100;
  const garantiaUnitario = (custoUnitario * padroes.garantia) / 100;

  return {
    escolhida,
    melhor,
    quantidade,
    custoUnitario,
    margemMinima,
    margemMaxima,
    tributos,
    precoFinalUnitario,
    precoReservaUnitario,
    lucroUnitario,
    impostoUnitario,
    folgaUnitaria: precoFinalUnitario - precoReservaUnitario,
    precoFinalTotal: precoFinalUnitario * quantidade,
    precoReservaTotal: precoReservaUnitario * quantidade,
    lucroTotal: lucroUnitario * quantidade,
    incompleto: !item.descricao.trim() || !escolhida || !temPreco(escolhida),
    economiaUnitaria: economiaUnitaria > TOLERANCIA ? economiaUnitaria : 0,
    noLimite: precoFinalUnitario <= precoReservaUnitario + TOLERANCIA,
    memoria: [
      { sinal: '', rotulo: 'Custo do produto', valor: escolhida?.custoProduto ?? 0, forte: false },
      { sinal: '+', rotulo: 'Frete fixo', valor: escolhida?.frete ?? 0, forte: false },
      { sinal: '+', rotulo: 'Outros custos', valor: escolhida?.outros ?? 0, forte: false },
      { sinal: '=', rotulo: 'Custo unitário', valor: custoUnitario, forte: true },
      {
        sinal: '+',
        rotulo: `Transporte ${formatarPercentual(padroes.transporte)} do custo`,
        valor: transporteUnitario,
        forte: false,
      },
      {
        sinal: '+',
        rotulo: `Garantia extra ${formatarPercentual(padroes.garantia)} do custo`,
        valor: garantiaUnitario,
        forte: false,
      },
      {
        sinal: '+',
        rotulo: `Lucro ${formatarPercentual(margemMaxima)} do custo`,
        valor: lucroUnitario,
        forte: false,
      },
      {
        sinal: '+',
        rotulo: `Tributos ${formatarPercentual(tributos * 100)} da venda`,
        valor: impostoUnitario,
        forte: false,
      },
      { sinal: '=', rotulo: 'Preço final unitário', valor: precoFinalUnitario, forte: true },
    ],
  };
}

export function totalizar(itens: readonly ItemCotador[], padroes: PadroesCotador): TotaisCotador {
  const calculados = itens.map((item) => calcularItem(item, padroes));
  const somar = (extrair: (c: ItemCalculado) => number) =>
    calculados.reduce((total, c) => total + extrair(c), 0);

  const capital = somar((c) => c.custoUnitario * c.quantidade);
  const valorCotado = somar((c) => c.precoFinalTotal);
  const precoReserva = somar((c) => c.precoReservaTotal);
  const lucroTotal = somar((c) => c.lucroTotal);

  return {
    itens: itens.length,
    unidades: somar((c) => c.quantidade),
    custoProdutos: somar((c) => (c.escolhida?.custoProduto ?? 0) * c.quantidade),
    capital,
    transporte: somar((c) => (c.custoUnitario * padroes.transporte * c.quantidade) / 100),
    garantia: somar((c) => (c.custoUnitario * padroes.garantia * c.quantidade) / 100),
    impostos: somar((c) => c.impostoUnitario * c.quantidade),
    valorCotado,
    precoReserva,
    folga: valorCotado - precoReserva,
    lucroTotal,
    lucroPercentual: dividir(lucroTotal, valorCotado) * 100,
    margemMedia: dividir(lucroTotal, capital) * 100,
    economia: somar((c) => c.economiaUnitaria * c.quantidade),
    pendencias: calculados.filter((c) => c.incompleto).length,
  };
}

export function formatarMoeda(valor: number): string {
  return `R$ ${(Number.isFinite(valor) ? valor : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Uma casa decimal: "8%" e "21,3%" — duas casas num percentual de margem
 * viram ruído na tela. */
export function formatarPercentual(valor: number): string {
  const arredondado = Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;
  return `${arredondado.toLocaleString('pt-BR')}%`;
}

export function formatarQuantidade(valor: number): string {
  return (Number.isFinite(valor) ? valor : 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 4,
  });
}
