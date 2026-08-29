import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { DatePickerComponent } from './date-picker.component';
import { hojeIso, formatarBr, somarDias } from './date-picker.utils';

@Component({
  imports: [FormsModule, DatePickerComponent],
  template: `<app-date-picker
    label="Publicadas de"
    [min]="min()"
    [max]="max()"
    [startAt]="startAt()"
    [ngModel]="valor()"
    (ngModelChange)="valor.set($event)"
  />`,
})
class HostComponent {
  valor = signal('');
  min = signal<string | null>(null);
  max = signal<string | null>(null);
  startAt = signal<string | null>(null);
}

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** O calendário vive num overlay do CDK — fora da árvore do fixture. */
  function calendario(): HTMLElement | null {
    return document.querySelector('.calendario');
  }

  function abrir(): void {
    fixture.debugElement.query(By.css('.gatilho')).nativeElement.click();
    fixture.detectChanges();
  }

  function input(): HTMLInputElement {
    return fixture.debugElement.query(By.css('input')).nativeElement;
  }

  function digitar(texto: string): void {
    input().value = texto;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function dias(): HTMLElement[] {
    return Array.from(calendario()!.querySelectorAll<HTMLElement>('.dia:not(.vazio)'));
  }

  function diaDoTexto(numero: string): HTMLElement {
    return dias().find((dia) => dia.textContent!.trim() === numero)!;
  }

  it('renderiza o rótulo recebido', () => {
    expect(
      fixture.debugElement.query(By.css('.field-label')).nativeElement.textContent.trim(),
    ).toBe('Publicadas de');
  });

  it('mostra o valor do formulário em dd/mm/aaaa, não em ISO', async () => {
    host.valor.set('2026-09-04');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input().value).toBe('04/09/2026');
  });

  it('digitação vira ISO no formulário, com a máscara aplicada no campo', () => {
    digitar('04092026');

    expect(input().value).toBe('04/09/2026');
    expect(host.valor()).toBe('2026-09-04');
  });

  it('data pela metade não vira valor, e o campo volta ao último valor bom no blur', () => {
    digitar('04092026');
    digitar('0409');

    expect(host.valor()).toBe('2026-09-04');

    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input().value).toBe('04/09/2026');
  });

  it('apagar o campo limpa o valor', () => {
    digitar('04092026');
    digitar('');

    expect(host.valor()).toBe('');
  });

  it('abre o calendário em português, no mês do valor atual', async () => {
    host.valor.set('2026-09-04');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    abrir();

    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('Setembro de 2026');
    expect(calendario()!.querySelector('.titulos-semana')!.textContent).toBe('DSTQQSS');
    expect(calendario()!.querySelector('.dia.selecionado')!.textContent!.trim()).toBe('4');
  });

  it('sem valor, abre no mês de startAt', () => {
    host.startAt.set('2027-03-10');
    fixture.detectChanges();

    abrir();

    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('Março de 2027');
  });

  it('clicar num dia preenche o formulário e fecha o calendário', () => {
    host.startAt.set('2026-09-01');
    fixture.detectChanges();
    abrir();

    diaDoTexto('15').click();
    fixture.detectChanges();

    expect(host.valor()).toBe('2026-09-15');
    expect(input().value).toBe('15/09/2026');
    expect(calendario()).toBeNull();
  });

  it('dia fora de [min, max] fica bloqueado e não seleciona nada', () => {
    host.startAt.set('2026-09-10');
    host.min.set('2026-09-10');
    host.max.set('2026-09-20');
    fixture.detectChanges();
    abrir();

    const bloqueado = diaDoTexto('5');
    expect(bloqueado.className).toContain('bloqueado');

    bloqueado.click();
    fixture.detectChanges();

    expect(host.valor()).toBe('');
    expect(calendario()).not.toBeNull();
  });

  it('as setas do teclado movem o dia ativo dentro da grade', () => {
    host.startAt.set('2026-09-10');
    fixture.detectChanges();
    abrir();

    const grade = calendario()!.querySelector<HTMLElement>('.grade')!;
    grade.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(calendario()!.querySelector('.dia.ativo')!.textContent!.trim()).toBe('11');

    grade.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(calendario()!.querySelector('.dia.ativo')!.textContent!.trim()).toBe('18');

    grade.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(host.valor()).toBe('2026-09-18');
  });

  it('navega mês a mês pelas setas do cabeçalho', () => {
    host.startAt.set('2026-09-10');
    fixture.detectChanges();
    abrir();

    calendario()!.querySelectorAll<HTMLElement>('.seta')[1].click();
    fixture.detectChanges();
    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('Outubro de 2026');

    calendario()!.querySelectorAll<HTMLElement>('.seta')[0].click();
    fixture.detectChanges();
    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('Setembro de 2026');
  });

  it('a seta desliga quando o período vizinho está todo fora dos limites', () => {
    host.startAt.set('2026-09-10');
    host.min.set('2026-09-01');
    host.max.set('2026-09-30');
    fixture.detectChanges();
    abrir();

    const setas = calendario()!.querySelectorAll<HTMLButtonElement>('.seta');
    expect(setas[0].disabled).toBe(true);
    expect(setas[1].disabled).toBe(true);
  });

  it('o título abre a visão de anos, e ano -> mês volta pros dias', () => {
    host.startAt.set('2026-09-10');
    fixture.detectChanges();
    abrir();

    calendario()!.querySelector<HTMLElement>('.periodo')!.click();
    fixture.detectChanges();
    const anos = Array.from(calendario()!.querySelectorAll<HTMLElement>('.celula-periodo'));
    expect(anos).toHaveLength(24);

    anos.find((ano) => ano.textContent!.trim() === '2028')!.click();
    fixture.detectChanges();
    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('2028');

    const meses = Array.from(calendario()!.querySelectorAll<HTMLElement>('.celula-periodo'));
    expect(meses).toHaveLength(12);
    meses.find((mes) => mes.textContent!.trim() === 'Mar')!.click();
    fixture.detectChanges();

    expect(calendario()!.querySelector('.periodo')!.textContent).toContain('Março de 2028');
  });

  it('"Hoje" preenche com a data de hoje e "Limpar" esvazia', () => {
    abrir();
    calendario()!.querySelectorAll<HTMLElement>('.acao')[0].click();
    fixture.detectChanges();

    expect(host.valor()).toBe(hojeIso());
    expect(input().value).toBe(formatarBr(hojeIso()));

    abrir();
    calendario()!.querySelectorAll<HTMLElement>('.acao')[1].click();
    fixture.detectChanges();

    expect(host.valor()).toBe('');
    expect(input().value).toBe('');
  });

  it('"Hoje" fica desabilitado quando hoje está fora dos limites', () => {
    host.min.set(somarDias(hojeIso(), 1));
    fixture.detectChanges();
    abrir();

    expect(calendario()!.querySelectorAll<HTMLButtonElement>('.acao')[0].disabled).toBe(true);
  });

  it('Esc fecha o calendário sem escolher nada', () => {
    abrir();
    calendario()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(calendario()).toBeNull();
    expect(host.valor()).toBe('');
  });
});
