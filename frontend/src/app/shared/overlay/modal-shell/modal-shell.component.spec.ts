import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ModalShellComponent } from './modal-shell.component';

@Component({
  imports: [ModalShellComponent],
  template: `
    <app-modal-shell titulo="Confirmar exclusão" (fechar)="fechado = true">
      <p>Corpo do modal</p>
      <button modalFooter type="button">Ação</button>
    </app-modal-shell>
  `,
})
class HostComponent {
  fechado = false;
}

describe('ModalShellComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('mostra o título recebido', () => {
    expect(fixture.debugElement.query(By.css('h2')).nativeElement.textContent.trim()).toBe(
      'Confirmar exclusão',
    );
  });

  it('projeta o corpo em .modal-body e as ações em .modal-footer', () => {
    expect(fixture.debugElement.query(By.css('.modal-body p')).nativeElement.textContent.trim()).toBe(
      'Corpo do modal',
    );
    expect(fixture.debugElement.query(By.css('.modal-footer button')).nativeElement.textContent.trim()).toBe(
      'Ação',
    );
  });

  it('clicar em fechar emite o evento para o host', () => {
    fixture.debugElement.query(By.css('.modal-close')).nativeElement.click();
    expect(host.fechado).toBe(true);
  });
});
