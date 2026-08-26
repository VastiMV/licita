import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AvisoModalComponent } from './aviso-modal.component';

describe('AvisoModalComponent', () => {
  let fixture: ComponentFixture<AvisoModalComponent>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [AvisoModalComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { titulo: 'Catálogo', mensagem: 'Sincronizado com sucesso.' } },
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    });
    fixture = TestBed.createComponent(AvisoModalComponent);
    fixture.detectChanges();
  });

  it('mostra o título e a mensagem recebidos via DIALOG_DATA', () => {
    expect(fixture.debugElement.query(By.css('h2')).nativeElement.textContent.trim()).toBe('Catálogo');
    expect(fixture.debugElement.query(By.css('.modal-body')).nativeElement.textContent.trim()).toBe(
      'Sincronizado com sucesso.',
    );
  });

  it('clicar em OK fecha o dialog', () => {
    fixture.debugElement.query(By.css('.modal-footer button')).nativeElement.click();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('clicar no × do cabeçalho também fecha o dialog', () => {
    fixture.debugElement.query(By.css('.modal-close')).nativeElement.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
