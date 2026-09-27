import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { NavItemComponent } from '../nav-item/nav-item.component';
import { NavGroupComponent } from './nav-group.component';

const ITENS = [
  { path: '/oportunidades/buscar', label: 'Buscar', icon: 'search' as const },
  { path: '/oportunidades/salvas', label: 'Salvas', icon: 'bookmark' as const },
];

describe('NavGroupComponent', () => {
  let fixture: ComponentFixture<NavGroupComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavGroupComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(NavGroupComponent);
    fixture.componentRef.setInput('label', 'Oportunidades');
    fixture.componentRef.setInput('icon', 'oportunidades');
    fixture.componentRef.setInput('itens', ITENS);
    fixture.detectChanges();
  });

  function labels(): string[] {
    return fixture.debugElement
      .queryAll(By.directive(NavItemComponent))
      .map((item) => (item.componentInstance as NavItemComponent).label());
  }

  it('abre já expandido, com o pai e os filhos visíveis', () => {
    expect(
      fixture.debugElement.query(By.css('.grupo-cabecalho')).nativeElement.textContent,
    ).toContain('Oportunidades');
    expect(labels()).toEqual(['Buscar', 'Salvas']);
  });

  it('o cabeçalho abre e fecha o grupo (e anuncia o estado)', () => {
    const cabecalho = fixture.debugElement.query(By.css('.grupo-cabecalho'));

    cabecalho.nativeElement.click();
    fixture.detectChanges();

    expect(cabecalho.nativeElement.getAttribute('aria-expanded')).toBe('false');
    expect(labels()).toEqual([]);

    cabecalho.nativeElement.click();
    fixture.detectChanges();

    expect(cabecalho.nativeElement.getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['Buscar', 'Salvas']);
  });

  it('recolhida (trilho de ícones), os filhos viram itens soltos — nenhum módulo some', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.grupo-cabecalho'))).toBeNull();
    expect(labels()).toEqual(['Buscar', 'Salvas']);
    const itens = fixture.debugElement.queryAll(By.directive(NavItemComponent));
    expect(itens.every((item) => (item.componentInstance as NavItemComponent).compact())).toBe(
      true,
    );
  });

  describe('com subgrupo (o Ciclo de Licitação)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('label', 'Ciclo de Licitação');
      fixture.componentRef.setInput('icon', 'ciclo');
      fixture.componentRef.setInput('itens', [
        { path: '/ciclo/visao-geral', label: 'Visão Geral', icon: 'ciclo' },
        { path: '/oportunidades', label: 'Oportunidades', icon: 'oportunidades', itens: ITENS },
        { path: '/ciclo/cotador', label: 'Cotador', icon: 'cotador' },
      ]);
      fixture.detectChanges();
    });

    it('o pai não é link — só abre e fecha', () => {
      expect(fixture.debugElement.query(By.css('.grupo-cabecalho')).name).toBe('button');
    });

    it('o filho com itens vira subgrupo, com os netos dentro', () => {
      expect(labels()).toEqual(['Visão Geral', 'Buscar', 'Salvas', 'Cotador']);
    });

    it('recolhida, o subgrupo se achata e só ficam os itens que navegam', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();

      expect(labels()).toEqual(['Visão Geral', 'Buscar', 'Salvas', 'Cotador']);
    });
  });
});
