import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from './toast.service';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastContainerComponent] });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();
  });

  it('cada tom tem sua cor e seu ícone: check, exclamação e X', () => {
    toasts.sucesso('Salva.');
    toasts.alerta('Vencidas.');
    toasts.erro('Falhou.');
    fixture.detectChanges();

    const abertos = fixture.debugElement.queryAll(By.css('.toast'));
    expect(abertos.map((t) => t.nativeElement.className)).toEqual([
      'toast toast-sucesso',
      'toast toast-alerta',
      'toast toast-erro',
    ]);
    const icones = fixture.debugElement
      .queryAll(By.css('.toast-icone app-icon'))
      .map((icone) => icone.componentInstance.name());
    expect(icones).toEqual(['check', 'exclamation', 'close']);
  });

  it('o link de ação executa e fecha o aviso', () => {
    const executar = vi.fn();
    toasts.alerta('3 sem prazo.', { acao: { rotulo: 'Apagar as vencidas', executar } });
    fixture.detectChanges();

    const acao = fixture.debugElement.query(By.css('.toast-acao'));
    expect(acao.nativeElement.textContent.trim()).toBe('Apagar as vencidas');

    acao.nativeElement.click();
    fixture.detectChanges();

    expect(executar).toHaveBeenCalled();
    expect(fixture.debugElement.queryAll(By.css('.toast'))).toHaveLength(0);
  });

  it('o X fecha o aviso sem executar nada', () => {
    const executar = vi.fn();
    toasts.alerta('3 sem prazo.', { acao: { rotulo: 'Apagar', executar } });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.toast-fechar')).nativeElement.click();
    fixture.detectChanges();

    expect(executar).not.toHaveBeenCalled();
    expect(fixture.debugElement.queryAll(By.css('.toast'))).toHaveLength(0);
  });

  it('anuncia para leitor de tela sem interromper (role=status, aria-live polite)', () => {
    const regiao = fixture.debugElement.query(By.css('.toasts')).nativeElement;

    expect(regiao.getAttribute('role')).toBe('status');
    expect(regiao.getAttribute('aria-live')).toBe('polite');
  });
});
