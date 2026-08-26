import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ButtonComponent } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `<app-button variant="danger" [disabled]="desabilitado()" (click)="cliques = cliques + 1">Excluir</app-button>`,
})
class HostComponent {
  // Signal, não campo simples: em Angular zoneless uma mutação de campo puro
  // (`this.desabilitado = true`) não notifica o scheduler — só um `set()`
  // de signal (ou uma API do próprio Angular) marca a view para recheck.
  desabilitado = signal(false);
  cliques = 0;
}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('projeta o conteúdo e aplica a variante como data-attribute', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(button.textContent?.trim()).toBe('Excluir');
    expect(button.dataset['variant']).toBe('danger');
  });

  it('o clique borbulha até o host sem @Output extra', () => {
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    expect(host.cliques).toBe(1);
  });

  it('desabilitado não dispara clique', () => {
    host.desabilitado.set(true);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('button')).nativeElement.click();
    expect(host.cliques).toBe(0);
  });
});
