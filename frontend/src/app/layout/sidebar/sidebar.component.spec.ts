import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { BrandComponent } from '../brand/brand.component';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { SidebarStateService } from './sidebar-state.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let state: SidebarStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(SidebarComponent);
    state = TestBed.inject(SidebarStateService);
    fixture.detectChanges();
  });

  it('mostra a marca e os três itens de menu', () => {
    expect(fixture.debugElement.query(By.directive(BrandComponent))).toBeTruthy();

    const items = fixture.debugElement.queryAll(By.directive(NavItemComponent));
    const labels = items.map((item) => (item.componentInstance as NavItemComponent).label());
    expect(labels).toEqual(['Oportunidades', 'Alertas', 'Filtros']);
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

    fixture.debugElement.query(By.css('nav')).nativeElement.click();
    expect(state.mobileOpen()).toBe(false);
  });
});
