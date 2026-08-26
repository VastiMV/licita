import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { InputTextComponent } from './input-text.component';

@Component({
  imports: [FormsModule, InputTextComponent],
  template: `<app-input-text label="Palavra-chave" [ngModel]="valor()" (ngModelChange)="valor.set($event)" />`,
})
class HostComponent {
  // Signal, não campo simples: em Angular zoneless uma mutação de campo puro
  // não notifica o scheduler — só um `set()` de signal marca a view para recheck.
  valor = signal('');
}

describe('InputTextComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renderiza o rótulo recebido', () => {
    const label = fixture.debugElement.query(By.css('.field-label'));
    expect(label.nativeElement.textContent.trim()).toBe('Palavra-chave');
  });

  it('propaga o valor digitado para o ngModel do host (via ControlValueAccessor)', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    input.value = 'notebook';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.valor()).toBe('notebook');
  });

  it('reflete no input um valor setado programaticamente pelo host', async () => {
    host.valor.set('cimento');
    fixture.detectChanges();
    // NgModel aplica o writeValue de forma assíncrona (um microtask) para
    // evitar ExpressionChangedAfterItHasBeenCheckedError — sem zone.js
    // (projeto zoneless) o teste precisa esperar essa volta explicitamente.
    await fixture.whenStable();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(input.value).toBe('cimento');
  });
});
