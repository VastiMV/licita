import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { CotadorPage } from './cotador.page';

/** Lê o texto de uma célula calculada procurando a coluna pelo título do
 * cabeçalho em todas as tabelas da tela — assim o teste não se amarra nem
 * à ordem das tabelas nem ao índice da coluna. */
function celula(fixture: ComponentFixture<CotadorPage>, coluna: string): string {
  for (const tabela of fixture.debugElement.queryAll(By.css('.tabela'))) {
    const cabecalhos = tabela.queryAll(By.css('thead th'));
    const indice = cabecalhos.findIndex((th) => th.nativeElement.textContent.trim() === coluna);
    if (indice === -1) continue;

    const primeiraLinha = tabela.queryAll(By.css('tbody tr'))[0];
    return primeiraLinha.queryAll(By.css('td'))[indice].nativeElement.textContent.trim();
  }

  throw new Error(`Coluna "${coluna}" não existe em nenhuma tabela da tela.`);
}

describe('CotadorPage', () => {
  let fixture: ComponentFixture<CotadorPage>;
  let page: CotadorPage;

  /** Acesso ao form protegido — o teste é do comportamento da tela, e
   * digitar em 12 inputs por caso deixaria o spec ilegível. */
  function form(): any {
    return (page as any).form;
  }

  function primeiroItem() {
    return form().controls.itens.at(0).controls;
  }

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CotadorPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(CotadorPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // A tela busca as oportunidades salvas ao abrir; sem responder, toda
    // asserção depois disso ficaria com uma requisição pendente aberta.
    http
      .expectOne((r) => r.url.includes('licitacoes/salvas'))
      .flush({
        count: 2,
        results: [
          { id: 7, objeto: 'Aquisição de papel A4', uf: 'SP' },
          { id: 9, objeto: 'Toner para impressora', uf: 'RJ' },
        ],
      });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('abre com os percentuais padrão da planilha', () => {
    const parametros = form().controls.parametros.value;

    expect(parametros.transporte).toBe(8);
    expect(parametros.icms).toBe(10);
    expect(parametros.lucroDesejado).toBe(35);
    expect(parametros.lucroMinimo).toBe(10);
  });

  it('abre com uma linha de item, pronta pra digitar', () => {
    expect(fixture.debugElement.queryAll(By.css('.tabela tbody tr')).length).toBeGreaterThan(0);
    expect(form().controls.itens.length).toBe(1);
  });

  it('calcula o preço final do exemplo da planilha ao digitar o custo', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    // R$100 + transporte 8% + imposto 10% + lucro 35% = R$158,89.
    expect(celula(fixture, 'Preço final un.')).toBe('R$ 158,89');
    expect(celula(fixture, 'Custo un.')).toBe('R$ 108,00');
  });

  it('recalcula quando um percentual muda', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();
    const antes = celula(fixture, 'Preço final un.');

    form().controls.parametros.controls.lucroDesejado.setValue(50);
    fixture.detectChanges();

    expect(celula(fixture, 'Preço final un.')).not.toBe(antes);
  });

  it('pede o lance antes de julgar a disputa', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    expect(celula(fixture, 'Status')).toBe('DIGITE O LANCE');
  });

  it('acusa prejuízo num lance abaixo do preço de equilíbrio', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    primeiroItem().lance.setValue(110);
    fixture.detectChanges();

    expect(celula(fixture, 'Status')).toBe('PREJUÍZO');
  });

  it('reconhece o lucro ideal no preço final', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    primeiroItem().lance.setValue(158.89);
    fixture.detectChanges();

    expect(celula(fixture, 'Status')).toBe('LUCRO IDEAL');
  });

  it('adiciona e remove itens', () => {
    (page as any).adicionarItem();
    fixture.detectChanges();
    expect(form().controls.itens.length).toBe(2);

    (page as any).removerItem(1);
    fixture.detectChanges();
    expect(form().controls.itens.length).toBe(1);
  });

  it('nunca deixa a cotação sem nenhuma linha', () => {
    (page as any).removerItem(0);
    fixture.detectChanges();

    expect(form().controls.itens.length).toBe(1);
  });

  it('volta a seleção do simulador para um item que ainda existe', () => {
    (page as any).adicionarItem();
    (page as any).itemSelecionado.set(1);
    (page as any).removerItem(1);
    fixture.detectChanges();

    expect((page as any).itemSelecionado()).toBe(0);
  });

  it('copia o lance sugerido pelo simulador para o campo de lance', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    (page as any).usarLance(131.111111);
    fixture.detectChanges();

    // Arredonda pra centavo: é o valor que vai ser digitado no portal.
    expect(primeiroItem().lance.value).toBe(131.11);
  });

  it('avisa quando o lucro mínimo passa o máximo', () => {
    (page as any).alternarParametros();
    form().controls.parametros.controls.lucroMinimo.setValue(50);
    fixture.detectChanges();

    const avisos = fixture.debugElement.queryAll(By.css('.aviso'));
    expect(avisos.some((a) => a.nativeElement.textContent.includes('lucro mínimo'))).toBe(true);
  });

  it('avisa quando os tributos somam 100% da venda', () => {
    (page as any).alternarParametros();
    form().controls.parametros.controls.icms.setValue(100);
    fixture.detectChanges();

    const avisos = fixture.debugElement.queryAll(By.css('.aviso'));
    expect(avisos.some((a) => a.nativeElement.textContent.includes('100%'))).toBe(true);
  });

  it('mostra os cinco degraus do simulador', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    const tabelas = fixture.debugElement.queryAll(By.css('.tabela'));
    const simulador = tabelas[tabelas.length - 1];

    expect(simulador.queryAll(By.css('tbody tr')).length).toBe(5);
  });

  it('começa com o card de percentuais fechado, já que os valores vêm preenchidos', () => {
    expect(fixture.debugElement.queryAll(By.css('.form-grid')).length).toBe(0);

    (page as any).alternarParametros();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.form-grid')).length).toBeGreaterThan(0);
  });

  it('põe os itens da cotação antes dos percentuais na página', () => {
    const titulos = fixture.debugElement
      .queryAll(By.css('h2'))
      .map((h) => h.nativeElement.textContent.trim());

    expect(titulos[0]).toBe('Itens da cotação');
    expect(titulos[1]).toBe('Custos e percentuais');
  });

  it('tem uma linha no painel de lances para cada item da cotação', () => {
    (page as any).adicionarItem();
    (page as any).adicionarItem();
    fixture.detectChanges();

    const linhas = fixture.debugElement.queryAll(By.css('.linha-lance.clicavel'));
    expect(linhas.length).toBe(form().controls.itens.length);
    expect(linhas.length).toBe(3);
  });

  it('colore a linha do painel de lances conforme o status do lance', () => {
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();
    const linha = () => fixture.debugElement.queryAll(By.css('.linha-lance.clicavel'))[0];

    // Sem lance a linha não chama atenção.
    expect(linha().nativeElement.className).toContain('tom-neutro');

    primeiroItem().lance.setValue(110); // abaixo do equilíbrio
    fixture.detectChanges();
    expect(linha().nativeElement.className).toContain('tom-perigo');

    primeiroItem().lance.setValue(140); // entre mínimo e máximo
    fixture.detectChanges();
    expect(linha().nativeElement.className).toContain('tom-ok');
  });

  it('troca o item do simulador ao clicar numa linha do painel de lances', () => {
    (page as any).adicionarItem();
    fixture.detectChanges();
    form().controls.itens.at(1).controls.fornecedor.setValue('Toner HP');
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.linha-lance.clicavel'))[1].nativeElement.click();
    fixture.detectChanges();

    expect((page as any).itemSelecionado()).toBe(1);
    const titulos = fixture.debugElement
      .queryAll(By.css('h2'))
      .map((h) => h.nativeElement.textContent.trim());
    expect(titulos.some((t) => t.includes('Toner HP'))).toBe(true);
  });

  it('mostra o valor total cotado e o lucro total', () => {
    primeiroItem().quantidade.setValue(10);
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    const textos = fixture.debugElement
      .queryAll(By.css('.totais div'))
      .map((d) => d.nativeElement.textContent.replace(/\s+/g, ' ').trim());

    expect(textos.some((t) => t.includes('Valor total cotado') && t.includes('1.588,89'))).toBe(
      true,
    );
    expect(textos.some((t) => t.includes('Lucro total') && t.includes('350,00'))).toBe(true);
  });

  it('só mostra totais de lance depois que existe algum lance', () => {
    primeiroItem().quantidade.setValue(10);
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();
    expect((page as any).totaisLance().algumLance).toBe(false);

    primeiroItem().lance.setValue(140);
    fixture.detectChanges();

    expect((page as any).totaisLance().algumLance).toBe(true);
    expect((page as any).totaisLance().valorTotal).toBeCloseTo(1400, 10);
    expect((page as any).totaisLance().lucroTotal).toBeCloseTo(180, 10);
  });

  it('lista as oportunidades salvas para vincular a cotação', () => {
    expect((page as any).oportunidades()).toEqual([
      { value: '7', label: 'Aquisição de papel A4 — SP' },
      { value: '9', label: 'Toner para impressora — RJ' },
    ]);
  });

  it('não deixa salvar sem escolher a oportunidade', () => {
    (page as any).salvarCotacao();

    // Nenhuma requisição sai: não há a que edital anexar a cotação.
    http.expectNone((r) => r.url.includes('/cotacao/'));
  });

  it('carrega a cotação gravada ao escolher um edital', () => {
    (page as any).oportunidadeId.setValue('7');
    fixture.detectChanges();

    http.expectOne('/api/licitacoes/salvas/7/cotacao/').flush({
      id: 1,
      parametros: {
        transporte: 0.1,
        garantia: 0,
        icms: 0.18,
        pis: 0,
        cofins: 0,
        ipi: 0,
        iss: 0,
        lucro_desejado: 0.4,
        lucro_minimo: 0.15,
      },
      itens: [
        {
          fornecedor: 'Papel A4',
          quantidade: 5,
          valor_unitario_produto: 200,
          frete_fixo_unitario: 0,
          outros_custos_unitarios: 0,
          valor_referencia_edital: 0,
          lance: 300,
        },
      ],
      valor_total: '1000.00',
      lucro_total: '100.00',
      atualizada_por_nome: '',
      criada_em: '2026-08-29T12:00:00Z',
      atualizada_em: '2026-08-29T12:00:00Z',
    });
    fixture.detectChanges();

    // Percentual volta de fração para o número que a tela mostra.
    expect(form().controls.parametros.value.icms).toBe(18);
    expect(form().controls.parametros.value.lucroDesejado).toBe(40);
    expect(primeiroItem().quantidade.value).toBe(5);
    expect(primeiroItem().lance.value).toBe(300);
  });

  it('trata 404 como edital ainda não cotado, não como erro', () => {
    (page as any).oportunidadeId.setValue('9');
    fixture.detectChanges();

    http
      .expectOne('/api/licitacoes/salvas/9/cotacao/')
      .flush({ detail: 'Não encontrado.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((page as any).carregandoCotacao()).toBe(false);
    expect((page as any).gravadaEm()).toBeNull();
  });

  it('manda a cotação em fração e snake_case ao salvar', () => {
    (page as any).oportunidadeId.setValue('7');
    fixture.detectChanges();
    http.expectOne('/api/licitacoes/salvas/7/cotacao/').flush({}, { status: 404, statusText: 'x' });

    primeiroItem().fornecedor.setValue('Papel A4');
    primeiroItem().quantidade.setValue(10);
    primeiroItem().valorUnitarioProduto.setValue(100);
    fixture.detectChanges();

    (page as any).salvarCotacao();

    const req = http.expectOne('/api/licitacoes/salvas/7/cotacao/');
    expect(req.request.method).toBe('PUT');
    // 35 na tela, 0,35 no corpo.
    expect(req.request.body.parametros.lucro_desejado).toBeCloseTo(0.35, 10);
    expect(req.request.body.parametros.icms).toBeCloseTo(0.1, 10);
    expect(req.request.body.itens[0]).toMatchObject({
      fornecedor: 'Papel A4',
      quantidade: 10,
      valor_unitario_produto: 100,
    });

    req.flush({ id: 1, atualizada_em: '2026-08-29T13:00:00Z' });
    fixture.detectChanges();
    expect((page as any).gravadaEm()).toBe('2026-08-29T13:00:00Z');
  });
});
