import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { BrandComponent } from '../brand/brand.component';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
  });

  it('mostra a marca', () => {
    expect(fixture.debugElement.query(By.directive(BrandComponent))).toBeTruthy();
  });

  it('tem os três itens de menu, um app-nav-item por link', () => {
    const items = fixture.debugElement.queryAll(By.directive(NavItemComponent));
    const labels = items.map((item) => (item.componentInstance as NavItemComponent).label());
    expect(labels).toEqual(['Oportunidades', 'Alertas', 'Filtros']);
  });
});
