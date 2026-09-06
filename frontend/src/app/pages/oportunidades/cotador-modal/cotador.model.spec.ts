import {
  ItemCotador,
  OfertaCotador,
  PADROES_INICIAIS,
  PadroesCotador,
  calcularItem,
  custoUnitarioDa,
  formatarMoeda,
  formatarPercentual,
  melhorOferta,
  ofertaEscolhida,
  totalizar,
} from './cotador.model';

/** Os mesmos números de `apps/cotador/test_formulas.py`: se uma das duas
 * implementações derivar, este teste (ou o de lá) cai. */
const PADROES: PadroesCotador = PADROES_INICIAIS;

function oferta(parcial: Partial<OfertaCotador> = {}): OfertaCotador {
  return {
    id: parcial.id ?? 'o1',
    fornecedorId: null,
    nome: 'Distribuidora Sul',
    custoProduto: 24.9,
    frete: 1.2,
    outros: 0,
    ...parcial,
  };
}

function item(parcial: Partial<ItemCotador> = {}): ItemCotador {
  const ofertas = parcial.ofertas ?? [oferta()];
  return {
    id: 'i1',
    numeroItem: '1',
    descricao: 'Papel A4 75g — resma 500fl',
    unidade: 'RESMA',
    quantidade: 120,
    valorReferencia: 30,
    margemMinima: null,
    margemMaxima: null,
    impostos: null,
    escolhida: ofertas[0]?.id ?? '',
    ...parcial,
    ofertas,
  };
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

describe('preço de um item', () => {
  it('custo unitário soma produto, frete e outros', () => {
    expect(calcularItem(item(), PADROES).custoUnitario).toBeCloseTo(26.1, 10);
  });

  it('preço final embute transporte, margem e tributo', () => {
    // 26,10 × (1 + 8% + 35%) ÷ (1 − 10%) = 41,47
    expect(arredondar(calcularItem(item(), PADROES).precoFinalUnitario)).toBe(41.47);
  });

  it('preço de reserva usa a margem mínima e fica abaixo do proposto', () => {
    // 26,10 × (1 + 8% + 10%) ÷ (1 − 10%) = 34,22
    const calculo = calcularItem(item(), PADROES);
    expect(arredondar(calculo.precoReservaUnitario)).toBe(34.22);
    expect(calculo.folgaUnitaria).toBeGreaterThan(0);
    expect(calculo.noLimite).toBe(false);
  });

  it('lucro incide sobre o custo e imposto sobre a venda', () => {
    // 26,10 × 35% = 9,135 — comparado sem arredondar, que em binário cai
    // para 9,13 e faria o teste discordar da conta certa.
    const calculo = calcularItem(item(), PADROES);
    expect(calculo.lucroUnitario).toBeCloseTo(9.135, 10);
    expect(arredondar(calculo.impostoUnitario)).toBe(arredondar(calculo.precoFinalUnitario * 0.1));
  });

  it('bate com a planilha de origem quando não há frete (R$ 100 → R$ 158,89)', () => {
    const calculo = calcularItem(
      item({ ofertas: [oferta({ custoProduto: 100, frete: 0, outros: 0 })] }),
      PADROES,
    );
    expect(arredondar(calculo.precoFinalUnitario)).toBe(158.89);
  });

  it('margem do item vence o padrão da cotação', () => {
    expect(calcularItem(item({ margemMaxima: 50 }), PADROES).margemMaxima).toBe(50);
  });

  it('margem zero do item não é confundida com ausência', () => {
    const calculo = calcularItem(item({ margemMaxima: 0, margemMinima: 0 }), PADROES);
    expect(calculo.margemMaxima).toBe(0);
    expect(calculo.lucroUnitario).toBe(0);
  });

  it('margem máxima nunca fica abaixo da mínima', () => {
    const calculo = calcularItem(item({ margemMinima: 40, margemMaxima: 10 }), PADROES);
    expect(calculo.margemMaxima).toBe(40);
    expect(calculo.precoFinalUnitario).toBe(calculo.precoReservaUnitario);
    expect(calculo.noLimite).toBe(true);
  });

  it('tributo próprio do item vence o padrão', () => {
    expect(calcularItem(item({ impostos: 21.25 }), PADROES).tributos).toBeCloseTo(0.2125, 10);
  });

  it('carga tributária absurda é limitada em vez de estourar', () => {
    const calculo = calcularItem(item({ impostos: 100 }), PADROES);
    expect(calculo.tributos).toBe(0.9);
    expect(Number.isFinite(calculo.precoFinalUnitario)).toBe(true);
  });

  it('item sem fornecedor nenhum não derruba a conta', () => {
    const calculo = calcularItem(item({ ofertas: [], escolhida: '' }), PADROES);
    expect(calculo.custoUnitario).toBe(0);
    expect(calculo.precoFinalUnitario).toBe(0);
    expect(calculo.incompleto).toBe(true);
  });
});

describe('escolha de fornecedor', () => {
  it('sem marcação válida, a primeira oferta entra na conta', () => {
    const alvo = item({
      ofertas: [oferta({ id: 'a' }), oferta({ id: 'b', custoProduto: 9 })],
      escolhida: 'inexistente',
    });
    expect(ofertaEscolhida(alvo)?.id).toBe('a');
  });

  it('melhor é o de menor custo com frete e extras', () => {
    // "b" tem produto mais barato, mas o frete o torna mais caro.
    const alvo = item({
      ofertas: [
        oferta({ id: 'a', nome: 'A', custoProduto: 10, frete: 0.5 }),
        oferta({ id: 'b', nome: 'B', custoProduto: 9.9, frete: 2 }),
      ],
      escolhida: 'a',
    });
    expect(melhorOferta(alvo)?.nome).toBe('A');
  });

  it('fornecedor sem preço não concorre a mais barato', () => {
    const alvo = item({
      ofertas: [
        oferta({ id: 'a', nome: 'A', custoProduto: 10, frete: 0 }),
        oferta({ id: 'b', nome: 'Em branco', custoProduto: 0, frete: 0 }),
      ],
      escolhida: 'a',
    });
    expect(melhorOferta(alvo)?.nome).toBe('A');
  });

  it('economia aparece quando o escolhido não é o mais barato', () => {
    const alvo = item({
      ofertas: [
        oferta({ id: 'a', custoProduto: 30, frete: 0 }),
        oferta({ id: 'b', custoProduto: 25, frete: 0 }),
      ],
      escolhida: 'a',
    });
    expect(calcularItem(alvo, PADROES).economiaUnitaria).toBe(5);
  });

  it('diferença de centésimo de centavo não vira sugestão de troca', () => {
    const alvo = item({
      ofertas: [
        oferta({ id: 'a', custoProduto: 10, frete: 0 }),
        oferta({ id: 'b', custoProduto: 9.999, frete: 0 }),
      ],
      escolhida: 'a',
    });
    expect(calcularItem(alvo, PADROES).economiaUnitaria).toBe(0);
  });

  it('custoUnitarioDa soma os três campos', () => {
    expect(custoUnitarioDa(oferta({ custoProduto: 10, frete: 2, outros: 0.5 }))).toBe(12.5);
  });
});

describe('totais da cotação', () => {
  const itens = [
    item(),
    item({
      id: 'i2',
      descricao: 'Toner HP 26A',
      quantidade: 12,
      impostos: 21.25,
      ofertas: [oferta({ id: 'o2', nome: 'InfoParts', custoProduto: 389, frete: 12 })],
      escolhida: 'o2',
    }),
  ];

  it('valor cotado é a soma dos preços finais', () => {
    const totais = totalizar(itens, PADROES);
    const esperado = itens.reduce((soma, i) => soma + calcularItem(i, PADROES).precoFinalTotal, 0);
    expect(totais.valorCotado).toBeCloseTo(esperado, 8);
  });

  it('capital inclui frete e custo dos produtos não', () => {
    const totais = totalizar(itens, PADROES);
    expect(totais.capital).toBeGreaterThan(totais.custoProdutos);
  });

  it('reserva fica abaixo do valor cotado e a folga é a diferença', () => {
    const totais = totalizar(itens, PADROES);
    expect(totais.precoReserva).toBeLessThan(totais.valorCotado);
    expect(totais.folga).toBeCloseTo(totais.valorCotado - totais.precoReserva, 8);
  });

  it('margem média é o lucro sobre o capital', () => {
    const totais = totalizar(itens, PADROES);
    expect(totais.margemMedia).toBeCloseTo((totais.lucroTotal / totais.capital) * 100, 8);
  });

  it('pendência conta item sem descrição ou sem preço', () => {
    const totais = totalizar(
      [
        item({ descricao: '   ' }),
        item({
          id: 'i3',
          ofertas: [oferta({ id: 'z', custoProduto: 0, frete: 0 })],
          escolhida: 'z',
        }),
      ],
      PADROES,
    );
    expect(totais.pendencias).toBe(2);
  });

  it('cotação vazia devolve zeros em vez de dividir por zero', () => {
    const totais = totalizar([], PADROES);
    expect(totais.valorCotado).toBe(0);
    expect(totais.margemMedia).toBe(0);
    expect(totais.lucroPercentual).toBe(0);
  });
});

describe('formatação', () => {
  it('moeda em pt-BR com duas casas', () => {
    expect(formatarMoeda(1234.5).replace(/ /g, ' ')).toBe('R$ 1.234,50');
  });

  it('percentual com uma casa', () => {
    expect(formatarPercentual(21.25)).toBe('21,3%');
    expect(formatarPercentual(8)).toBe('8%');
  });
});
