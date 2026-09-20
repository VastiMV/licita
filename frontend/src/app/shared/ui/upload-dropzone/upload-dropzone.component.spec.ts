import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { UploadDropzoneComponent } from './upload-dropzone.component';

function arquivo(nome = 'certidao.pdf'): File {
  return new File([new Blob(['x'])], nome, { type: 'application/pdf' });
}

/** O jsdom não implementa `DragEvent`, e o handler só usa `preventDefault` e
 * `dataTransfer` — então o dublê basta e o teste não depende do navegador. */
function soltar(files: File[]) {
  return { preventDefault: vi.fn(), dataTransfer: { files } };
}

describe('UploadDropzoneComponent', () => {
  let fixture: ComponentFixture<UploadDropzoneComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UploadDropzoneComponent] });
    fixture = TestBed.createComponent(UploadDropzoneComponent);
    fixture.detectChanges();
  });

  const zona = () => fixture.debugElement.query(By.css('.zona'));

  it('emite o arquivo solto na área', () => {
    const escolhido = vi.fn();
    fixture.componentInstance.escolhido.subscribe(escolhido);

    zona().triggerEventHandler('drop', soltar([arquivo()]));

    expect(escolhido).toHaveBeenCalledWith(expect.objectContaining({ name: 'certidao.pdf' }));
  });

  it('não aceita arquivo enquanto está desabilitada', () => {
    const escolhido = vi.fn();
    fixture.componentInstance.escolhido.subscribe(escolhido);
    fixture.componentRef.setInput('desabilitado', true);
    fixture.detectChanges();

    zona().triggerEventHandler('drop', soltar([arquivo()]));

    expect(escolhido).not.toHaveBeenCalled();
  });

  it('abre o seletor pelo teclado — a área é um botão', () => {
    const clique = vi.spyOn(
      fixture.debugElement.query(By.css('input[type=file]')).nativeElement,
      'click',
    );

    zona().triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(clique).toHaveBeenCalled();
  });

  it('com progresso, vira barra e mostra a porcentagem real', () => {
    fixture.componentRef.setInput('progresso', 42);
    fixture.componentRef.setInput('enviando', 'balanco-2025.pdf');
    fixture.detectChanges();

    expect(zona()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('42%');
    expect(fixture.nativeElement.textContent).toContain('balanco-2025.pdf');
    expect(fixture.debugElement.query(By.css('.preenchimento')).nativeElement.style.width).toBe(
      '42%',
    );
  });
});
