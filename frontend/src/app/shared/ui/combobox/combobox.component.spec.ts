import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ComboboxComponent, OpcaoCombo, normalizarNome } from './combobox.component';

const OPCOES: OpcaoCombo[] = [
  { id: 1, nome: 'Jaguaribe', destaque: true },
  { id: 2, nome: 'Ortobras' },
];

describe('ComboboxComponent', () => {
  let fixture: ComponentFixture<ComboboxComponent>;
  let criar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    criar = vi.fn((nome: string) => of({ id: 9, nome }));
    TestBed.configureTestingModule({ imports: [ComboboxComponent] });
    fixture = TestBed.createComponent(ComboboxComponent);
    fixture.componentRef.setInput('rotulo', 'Fabricante');
    fixture.componentRef.setInput('buscar', () => of(OPCOES));
    fixture.componentRef.setInput('criar', criar);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  function digitar(texto: string) {
    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(250);
    fixture.detectChanges();
  }

  const linhas = () =>
    fixture.debugElement.queryAll(By.css('li')).map((li) => li.nativeElement.textContent.trim());

  it('normaliza como o backend: caixa, acento e espaços', () => {
    expect(normalizarNome('  jaguaribé   ltda ')).toBe('JAGUARIBE LTDA');
  });

  it('nome igual (sem acento, outra caixa) não oferece criar — já existe', () => {
    digitar('JAGUARIBÉ');
    expect(linhas().some((l) => l.startsWith('Criar'))).toBe(false);
  });

  it('nome novo oferece criar e escolhe o criado', () => {
    const escolhido = vi.fn();
    fixture.componentInstance.escolheu.subscribe(escolhido);

    digitar('Baxter');
    const criarLinha = fixture.debugElement.query(By.css('li.criar'));
    expect(criarLinha.nativeElement.textContent).toContain('Criar “Baxter”');
    criarLinha.nativeElement.click();

    expect(criar).toHaveBeenCalledWith('Baxter');
    expect(escolhido).toHaveBeenCalledWith({ id: 9, nome: 'Baxter' });
  });
});
