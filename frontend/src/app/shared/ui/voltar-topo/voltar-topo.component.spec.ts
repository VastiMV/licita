import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { VoltarTopoComponent } from './voltar-topo.component';

/** Coloca a janela numa posição de rolagem e avisa quem escuta — jsdom não
 * rola de verdade, então o `scrollY` é forjado. */
function rolarPara(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

/** O jsdom do runner não implementa `matchMedia`, e o componente consulta
 * `prefers-reduced-motion` antes de rolar. */
function preferirMovimentoReduzido(reduz: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduz })),
  );
}

describe('VoltarTopoComponent', () => {
  let fixture: ComponentFixture<VoltarTopoComponent>;

  const botao = () => fixture.debugElement.query(By.css('button'));

  beforeEach(() => {
    preferirMovimentoReduzido(false);
    TestBed.configureTestingModule({ imports: [VoltarTopoComponent] });
    fixture = TestBed.createComponent(VoltarTopoComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    rolarPara(0);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('não existe na tela com a página no topo', () => {
    expect(botao()).toBeNull();
  });

  it('aparece rotulado depois do limite de rolagem', () => {
    rolarPara(400);
    fixture.detectChanges();

    expect(botao().nativeElement.getAttribute('aria-label')).toBe('Voltar ao topo');
  });

  it('some de novo quando a página volta pro topo', () => {
    rolarPara(400);
    fixture.detectChanges();
    rolarPara(10);
    fixture.detectChanges();

    expect(botao()).toBeNull();
  });

  it('o clique rola a janela até o topo', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    rolarPara(400);
    fixture.detectChanges();

    botao().nativeElement.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('pula a animação pra quem pediu menos movimento no sistema', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    preferirMovimentoReduzido(true);
    rolarPara(400);
    fixture.detectChanges();

    botao().nativeElement.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
