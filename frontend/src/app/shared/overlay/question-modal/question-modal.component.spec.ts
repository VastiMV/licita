import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { QuestionModalComponent } from './question-modal.component';

describe('QuestionModalComponent', () => {
  let fixture: ComponentFixture<QuestionModalComponent>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [QuestionModalComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { titulo: 'Excluir filtro', mensagem: 'Essa ação não pode ser desfeita.', variantConfirmar: 'danger' },
        },
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    });
    fixture = TestBed.createComponent(QuestionModalComponent);
    fixture.detectChanges();
  });

  it('mostra título, mensagem e rótulos padrão dos botões', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.modal-footer button'));
    expect(buttons.map((b) => b.nativeElement.textContent.trim())).toEqual(['Cancelar', 'Confirmar']);
  });

  it('confirmar fecha o dialog com true', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.modal-footer button'));
    buttons[1].nativeElement.click();
    expect(closeSpy).toHaveBeenCalledWith(true);
  });

  it('cancelar fecha o dialog com false', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.modal-footer button'));
    buttons[0].nativeElement.click();
    expect(closeSpy).toHaveBeenCalledWith(false);
  });
});
