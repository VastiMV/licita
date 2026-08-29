import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { NavItemComponent } from '../nav-item/nav-item.component';
import { NavGroupComponent } from './nav-group.component';

const ITENS = [
  { path: '/oportunidades/pesquisar', label: 'Pesquisar', icon: 'search' as const },
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
    expect(labels()).toEqual(['Pesquisar', 'Salvas']);
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
    expect(labels()).toEqual(['Pesquisar', 'Salvas']);
  });

  it('recolhida (trilho de ícones), os filhos viram itens soltos — nenhum módulo some', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.grupo-cabecalho'))).toBeNull();
    expect(labels()).toEqual(['Pesquisar', 'Salvas']);
    const itens = fixture.debugElement.queryAll(By.directive(NavItemComponent));
    expect(itens.every((item) => (item.componentInstance as NavItemComponent).compact())).toBe(
      true,
    );
  });
});
