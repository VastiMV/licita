import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ItemMenu, MenuComponent } from './menu.component';

@Component({
  imports: [MenuComponent],
  template: `<app-menu [itens]="itens()" descricao="Ações da linha 1" />`,
})
class HostComponent {
  readonly visualizou = signal(false);
  readonly excluiu = signal(false);
  readonly itens = signal<readonly ItemMenu[]>([
    { rotulo: 'Visualizar', icone: 'eye', executar: () => this.visualizou.set(true) },
    { rotulo: 'Excluir', icone: 'trash', tom: 'perigo', executar: () => this.excluiu.set(true) },
  ]);
}

describe('MenuComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function gatilho(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('.gatilho')).nativeElement;
  }

  // O painel é montado num overlay do CDK, fora da árvore do componente.
  function opcoes(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-item'));
  }

  function abrir(): void {
    gatilho().click();
    fixture.detectChanges();
  }

  it('começa fechado — as opções só existem depois de abrir', () => {
    expect(opcoes()).toHaveLength(0);
    expect(gatilho().getAttribute('aria-expanded')).toBe('false');
    expect(gatilho().getAttribute('aria-haspopup')).toBe('menu');
    expect(gatilho().getAttribute('aria-label')).toBe('Ações da linha 1');

    abrir();

    expect(opcoes().map((o) => o.textContent?.trim())).toEqual(['Visualizar', 'Excluir']);
    expect(gatilho().getAttribute('aria-expanded')).toBe('true');
  });

  it('escolher uma opção executa a ação e fecha o menu', () => {
    abrir();

    opcoes()[0].click();
    fixture.detectChanges();

    expect(host.visualizou()).toBe(true);
    expect(opcoes()).toHaveLength(0);
  });

  it('clicar fora fecha sem executar nada', () => {
    abrir();

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    fixture.detectChanges();

    expect(opcoes()).toHaveLength(0);
    expect(host.visualizou()).toBe(false);
    expect(host.excluiu()).toBe(false);
  });

  it('opção destrutiva é marcada como tal, e opção desabilitada não executa', () => {
    abrir();
    expect(opcoes()[1].className).toContain('perigo');

    host.itens.set([
      { rotulo: 'Gerar proposta', desabilitado: true, executar: () => host.visualizou.set(true) },
    ]);
    fixture.detectChanges();

    opcoes()[0].click();
    fixture.detectChanges();

    expect(opcoes()[0].disabled).toBe(true);
    expect(host.visualizou()).toBe(false);
  });
});
