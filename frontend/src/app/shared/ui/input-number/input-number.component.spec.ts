import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { InputNumberComponent, parseNumero } from './input-number.component';

@Component({
  imports: [FormsModule, InputNumberComponent],
  template: `<app-input-number
    label="Valor do produto"
    prefixo="R$"
    [ngModel]="valor()"
    (ngModelChange)="valor.set($event)"
  />`,
})
class HostComponent {
  // Signal, não campo simples: em Angular zoneless uma mutação de campo puro
  // não notifica o scheduler — só um `set()` de signal marca a view para recheck.
  valor = signal(0);
}

describe('parseNumero', () => {
  it('entende vírgula decimal', () => {
    expect(parseNumero('1234,56')).toBe(1234.56);
  });

  it('entende ponto de milhar junto com vírgula decimal', () => {
    expect(parseNumero('1.234,56')).toBe(1234.56);
  });

  it('entende ponto decimal, para quem digita no teclado numérico', () => {
    expect(parseNumero('1234.56')).toBe(1234.56);
  });

  it('trata o último separador como decimal, não o primeiro', () => {
    expect(parseNumero('1.234.567,89')).toBe(1234567.89);
  });

  it('descarta o que não é número', () => {
    expect(parseNumero('R$ 1.500,00')).toBe(1500);
  });

  it('preserva o sinal negativo', () => {
    expect(parseNumero('-12,5')).toBe(-12.5);
  });

  it('devolve null para campo vazio ou só espaços', () => {
    expect(parseNumero('')).toBeNull();
    expect(parseNumero('   ')).toBeNull();
  });
});

describe('InputNumberComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let input: HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.debugElement.query(By.css('input')).nativeElement;
  });

  it('renderiza o rótulo recebido', () => {
    const label = fixture.debugElement.query(By.css('.field-label'));

    expect(label.nativeElement.textContent.trim()).toBe('Valor do produto');
  });

  it('renderiza o prefixo recebido', () => {
    const afixo = fixture.debugElement.query(By.css('.afixo'));

    expect(afixo.nativeElement.textContent.trim()).toBe('R$');
  });

  it('propaga o número digitado para o ngModel do host', () => {
    input.value = '158,89';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.valor()).toBe(158.89);
  });

  it('trata campo apagado como zero, para não quebrar as somas da tela', () => {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.valor()).toBe(0);
  });

  it('reflete no input um valor setado programaticamente, com vírgula decimal', async () => {
    host.valor.set(1234.5);
    fixture.detectChanges();
    // NgModel aplica o writeValue de forma assíncrona (um microtask) para
    // evitar ExpressionChangedAfterItHasBeenCheckedError — sem zone.js
    // (projeto zoneless) o teste precisa esperar essa volta explicitamente.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input.value).toBe('1234,5');
  });

  it('não usa type="number" — a vírgula decimal é recusada nele em pt-BR', () => {
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
  });
});
