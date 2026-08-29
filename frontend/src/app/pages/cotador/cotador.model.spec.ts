import {
  ItemCotacao,
  PARAMETROS_PADRAO,
  ParametrosCotacao,
  avaliarLance,
  calcularItem,
  simularDegraus,
  somarImpostos,
  totalizar,
} from './cotador.model';

/** O caso que a própria planilha documenta na aba "Como usar", linha
 * EXEMPLO: "Produto R$100 + transporte 8% + imposto 10% + lucro desejado
 * 35% -> preço final ~R$158,89; lucro líquido = R$35". É a âncora destes
 * testes: se a conta mudar, isto quebra. */
const PRODUTO_100: ItemCotacao = {
  fornecedor: 'Papel',
  quantidade: 1,
  valorUnitarioProduto: 100,
  freteFixoUnitario: 0,
  outrosCustosUnitarios: 0,
  valorReferenciaEdital: 0,
};

function comParametros(ajustes: Partial<ParametrosCotacao> = {}): ParametrosCotacao {
  return { ...PARAMETROS_PADRAO, ...ajustes };
}

describe('somarImpostos', () => {
  it('soma os cinco tributos que incidem sobre a venda', () => {
    expect(
      somarImpostos(comParametros({ icms: 0.1, pis: 0.0165, cofins: 0.076, ipi: 0.05, iss: 0.02 })),
    ).toBeCloseTo(0.2625, 10);
  });
});

describe('calcularItem', () => {
  it('reproduz o exemplo da planilha', () => {
    const calculado = calcularItem(PRODUTO_100, PARAMETROS_PADRAO);

    expect(calculado.custoUnitario).toBeCloseTo(108, 10);
    expect(calculado.precoUnitarioFinal).toBeCloseTo(158.89, 2);
    expect(calculado.lucroLiquidoUnitario).toBeCloseTo(35, 10);
  });

  it('cobre custo e imposto sem lucro no preço de equilíbrio', () => {
    const calculado = calcularItem(PRODUTO_100, PARAMETROS_PADRAO);

    // 108 de custo / 0,9 = 120: vender a 120 devolve exatamente o que saiu.
    expect(calculado.precoEquilibrio).toBeCloseTo(120, 10);
    expect(
      avaliarLance(calculado.precoEquilibrio, calculado, PARAMETROS_PADRAO).lucroLiquidoUnitario,
    ).toBeCloseTo(0, 10);
  });

  it('usa o lucro mínimo — não o desejado — no preço mínimo', () => {
    const calculado = calcularItem(PRODUTO_100, PARAMETROS_PADRAO);

    // (108 + 100 x 10%) / 0,9
    expect(calculado.precoMinimo).toBeCloseTo(131.11, 2);
    expect(calculado.precoMinimo).toBeLessThan(calculado.precoUnitarioFinal);
  });

  it('soma frete fixo e outros custos ao custo unitário, sem aplicar transporte sobre eles', () => {
    const calculado = calcularItem(
      { ...PRODUTO_100, freteFixoUnitario: 5, outrosCustosUnitarios: 2 },
      PARAMETROS_PADRAO,
    );

    // 100 + 8 (8% de 100, não de 107) + 5 + 2
    expect(calculado.custoUnitario).toBeCloseTo(115, 10);
  });

  it('multiplica pelo total usando a quantidade', () => {
    const calculado = calcularItem({ ...PRODUTO_100, quantidade: 10 }, PARAMETROS_PADRAO);

    expect(calculado.precoTotalFinal).toBeCloseTo(calculado.precoUnitarioFinal * 10, 10);
    expect(calculado.lucroLiquidoTotal).toBeCloseTo(350, 10);
    expect(calculado.capitalNecessario).toBeCloseTo(1080, 10);
  });

  it('calcula o desconto sobre a referência do edital', () => {
    const calculado = calcularItem(
      { ...PRODUTO_100, valorReferenciaEdital: 200 },
      PARAMETROS_PADRAO,
    );

    // (200 - 158,89) / 200
    expect(calculado.descontoSobreReferencia).toBeCloseTo(0.2056, 4);
  });

  it('devolve zero em vez de Infinity quando não há referência do edital', () => {
    const calculado = calcularItem(PRODUTO_100, PARAMETROS_PADRAO);

    expect(calculado.descontoSobreReferencia).toBe(0);
  });

  it('devolve zero em vez de Infinity quando os impostos somam 100%', () => {
    const calculado = calcularItem(PRODUTO_100, comParametros({ icms: 1 }));

    expect(calculado.precoUnitarioFinal).toBe(0);
    expect(calculado.fatorVenda).toBe(0);
  });
});

describe('avaliarLance', () => {
  const calculado = calcularItem({ ...PRODUTO_100, quantidade: 10 }, PARAMETROS_PADRAO);
  const avaliar = (lance: number) => avaliarLance(lance, calculado, PARAMETROS_PADRAO);

  it('pede o lance antes de julgar qualquer coisa', () => {
    expect(avaliar(0).status).toBe('DIGITE O LANCE');
  });

  it('acusa prejuízo abaixo do preço de equilíbrio', () => {
    expect(avaliar(119).status).toBe('PREJUÍZO');
    expect(avaliar(119).lucroLiquidoUnitario).toBeLessThan(0);
  });

  it('acusa lance acima do equilíbrio mas abaixo do lucro mínimo', () => {
    // 125: cobre os custos, mas rende 4,5% sobre o custo — menos que os 10%.
    expect(avaliar(125).status).toBe('ABAIXO DO MÍNIMO');
  });

  it('marca LIMITE exatamente no preço mínimo', () => {
    expect(avaliar(calculado.precoMinimo).status).toBe('LIMITE');
    expect(avaliar(calculado.precoMinimo).lucroSobreCusto).toBeCloseTo(0.1, 10);
  });

  it('avisa que ainda dá pra baixar entre o mínimo e o desejado', () => {
    expect(avaliar(140).status).toBe('PODE BAIXAR');
  });

  it('reconhece o lucro ideal no preço final', () => {
    expect(avaliar(calculado.precoUnitarioFinal).status).toBe('LUCRO IDEAL');
    expect(avaliar(calculado.precoUnitarioFinal).lucroSobreCusto).toBeCloseTo(0.35, 10);
  });

  it('mede a folga até o preço mínimo, nunca negativa', () => {
    expect(avaliar(140).podeBaixar).toBeCloseTo(140 - calculado.precoMinimo, 10);
    expect(avaliar(140).ateLimite).toBeCloseTo((140 - calculado.precoMinimo) / 140, 10);
    // Abaixo do mínimo não existe "folga negativa": a planilha usa MAX(...;0).
    expect(avaliar(119).podeBaixar).toBe(0);
  });

  it('projeta o lucro do lance para a quantidade inteira', () => {
    expect(avaliar(140).lucroLiquidoTotal).toBeCloseTo(avaliar(140).lucroLiquidoUnitario * 10, 10);
  });
});

describe('simularDegraus', () => {
  const calculado = calcularItem(PRODUTO_100, PARAMETROS_PADRAO);
  const degraus = simularDegraus(calculado, PARAMETROS_PADRAO);

  it('vai do preço final até o preço mínimo em cinco degraus', () => {
    expect(degraus).toHaveLength(5);
    expect(degraus[0].lance).toBeCloseTo(calculado.precoUnitarioFinal, 10);
    expect(degraus[4].lance).toBeCloseTo(calculado.precoMinimo, 10);
  });

  it('desce o lance a cada degrau', () => {
    const lances = degraus.map((degrau) => degrau.lance);

    expect(lances).toEqual([...lances].sort((a, b) => b - a));
  });

  it('classifica do confortável ao limite', () => {
    expect(degraus[0].situacao).toBe('CONFORTÁVEL');
    expect(degraus[1].situacao).toBe('ATENÇÃO');
    expect(degraus[4].situacao).toBe('LIMITE');
  });

  it('zera a distância do mínimo no último degrau', () => {
    expect(degraus[4].distanciaDoMinimo).toBeCloseTo(0, 10);
  });
});

describe('totalizar', () => {
  it('soma os itens e pondera o preço médio pela quantidade', () => {
    const calculados = [
      calcularItem({ ...PRODUTO_100, quantidade: 10 }, PARAMETROS_PADRAO),
      calcularItem(
        { ...PRODUTO_100, fornecedor: 'Toner', quantidade: 1, valorUnitarioProduto: 1000 },
        PARAMETROS_PADRAO,
      ),
    ];

    const totais = totalizar(calculados);

    expect(totais.quantidade).toBe(11);
    expect(totais.custoTotalProdutos).toBeCloseTo(2000, 10);
    expect(totais.lucroLiquidoTotal).toBeCloseTo(700, 10);
    // Média ponderada: o item de R$1.000 pesa 1 de 11, não metade.
    expect(totais.precoUnitarioMedio).toBeCloseTo(totais.precoTotalFinal / 11, 10);
    expect(totais.precoUnitarioMedio).toBeLessThan(500);
  });

  it('devolve zeros para uma cotação sem itens', () => {
    const totais = totalizar([]);

    expect(totais.quantidade).toBe(0);
    expect(totais.precoUnitarioMedio).toBe(0);
    expect(totais.precoTotalFinal).toBe(0);
  });
});
