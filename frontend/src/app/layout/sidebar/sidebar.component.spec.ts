import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { BrandComponent } from '../brand/brand.component';
import { NavGroupComponent } from '../nav-group/nav-group.component';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { SidebarStateService } from './sidebar-state.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let state: SidebarStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      // Rota curinga: o teste clica num link de verdade, e sem rota casada o
      // Router rejeita a navegação depois que o teste já terminou.
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    fixture = TestBed.createComponent(SidebarComponent);
    state = TestBed.inject(SidebarStateService);
    fixture.detectChanges();
  });

  it('mostra a marca e os itens de menu, com Oportunidades como grupo', () => {
    expect(fixture.debugElement.query(By.directive(BrandComponent))).toBeTruthy();

    const grupo = fixture.debugElement.query(By.directive(NavGroupComponent));
    expect((grupo.componentInstance as NavGroupComponent).label()).toBe('Oportunidades');

    // Os filhos do grupo são itens como os de primeiro nível — "Pesquisar"
    // vem antes de "Salvas" (a busca é a tela inicial do app).
    const items = fixture.debugElement.queryAll(By.directive(NavItemComponent));
    const labels = items.map((item) => (item.componentInstance as NavItemComponent).label());
    expect(labels).toEqual(['Pesquisar', 'Salvas', 'Alertas', 'Filtros', 'Cotador']);
  });

  it('os filhos de Oportunidades apontam para as rotas do submenu', () => {
    const rotas = fixture.debugElement
      .queryAll(By.directive(NavItemComponent))
      .map((item) => (item.componentInstance as NavItemComponent).path());

    expect(rotas.slice(0, 2)).toEqual(['/oportunidades/pesquisar', '/oportunidades/salvas']);
  });

  it('o botão de colapso alterna SidebarStateService.collapsed', () => {
    const botao = fixture.debugElement.query(By.css('.collapse-toggle'));

    botao.nativeElement.click();
    expect(state.collapsed()).toBe(true);

    botao.nativeElement.click();
    expect(state.collapsed()).toBe(false);
  });

  it('aplica a classe collapsed no aside quando recolhido', () => {
    state.collapsed.set(true);
    fixture.detectChanges();

    const aside = fixture.debugElement.query(By.css('aside.sidebar'));
    expect(aside.classes['collapsed']).toBe(true);
  });

  it('clicar num item de menu fecha o menu mobile', () => {
    state.mobileOpen.set(true);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('nav a')).nativeElement.click();
    expect(state.mobileOpen()).toBe(false);
  });

  it('abrir/fechar o grupo Oportunidades não fecha o menu mobile', () => {
    state.mobileOpen.set(true);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.grupo-cabecalho')).nativeElement.click();

    expect(state.mobileOpen()).toBe(true);
  });
});
