import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { RadioGroupComponent, RadioOption } from './radio-group.component';

const OPCOES: readonly RadioOption[] = [
  { value: 'palavra_chave', label: 'Palavra-chave' },
  { value: 'uasg', label: 'UASG' },
];

@Component({
  imports: [FormsModule, RadioGroupComponent],
  template: `<app-radio-group
    label="Buscar por"
    [options]="opcoes"
    [ngModel]="modo()"
    (ngModelChange)="modo.set($event)"
  />`,
})
class HostComponent {
  readonly opcoes = OPCOES;
  modo = signal('palavra_chave');
}

describe('RadioGroupComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function radios(): HTMLInputElement[] {
    return fixture.debugElement.queryAll(By.css('input')).map((el) => el.nativeElement);
  }

  it('desenha uma opção por item, com o valor do ngModel já marcado', async () => {
    // NgModel aplica o writeValue de forma assíncrona — ver o mesmo
    // comentário em input-text.component.spec.ts.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(radios()).toHaveLength(2);
    expect(radios()[0].checked).toBe(true);
    expect(radios()[1].checked).toBe(false);
    expect(fixture.debugElement.nativeElement.textContent).toContain('UASG');
  });

  it('as opções compartilham o mesmo name (é um grupo só para o navegador)', () => {
    const [primeiro, segundo] = radios();
    expect(primeiro.name).toBe(segundo.name);
    expect(primeiro.name).not.toBe('');
  });

  it('escolher outra opção propaga o valor dela para o ngModel do host', () => {
    radios()[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.modo()).toBe('uasg');
  });

  it('reflete um valor setado programaticamente pelo host (writeValue)', async () => {
    host.modo.set('uasg');
    fixture.detectChanges();
    // NgModel aplica o writeValue de forma assíncrona — ver o mesmo
    // comentário em input-text.component.spec.ts.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(radios()[1].checked).toBe(true);
  });
});
