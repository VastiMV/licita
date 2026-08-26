import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { CheckboxComponent } from './checkbox.component';

@Component({
  imports: [FormsModule, CheckboxComponent],
  template: `<app-checkbox label="Ativo" [ngModel]="ativo()" (ngModelChange)="ativo.set($event)" />`,
})
class HostComponent {
  ativo = signal(false);
}

describe('CheckboxComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('começa desmarcado quando o ngModel é false', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(input.checked).toBe(false);
  });

  it('marcar propaga true para o ngModel do host', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.ativo()).toBe(true);
  });

  it('reflete no checkbox um valor setado programaticamente pelo host (writeValue)', async () => {
    host.ativo.set(true);
    fixture.detectChanges();
    // NgModel aplica o writeValue de forma assíncrona — ver o mesmo
    // comentário em input-text.component.spec.ts.
    await fixture.whenStable();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(input.checked).toBe(true);
  });
});
