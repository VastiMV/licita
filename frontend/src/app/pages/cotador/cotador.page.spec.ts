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

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CotadorPage] });
    fixture = TestBed.createComponent(CotadorPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

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

  it('avisa quando o lucro mínimo passa o desejado', () => {
    form().controls.parametros.controls.lucroMinimo.setValue(50);
    fixture.detectChanges();

    const avisos = fixture.debugElement.queryAll(By.css('.aviso'));
    expect(avisos.some((a) => a.nativeElement.textContent.includes('lucro mínimo'))).toBe(true);
  });

  it('avisa quando os tributos somam 100% da venda', () => {
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
});
