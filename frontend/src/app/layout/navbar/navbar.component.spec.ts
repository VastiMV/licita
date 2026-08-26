import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { BrandComponent } from '../brand/brand.component';
import { ProfileMenuComponent } from '../profile-menu/profile-menu.component';
import { SidebarStateService } from '../sidebar/sidebar-state.service';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let sidebarState: SidebarStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(NavbarComponent);
    sidebarState = TestBed.inject(SidebarStateService);
    fixture.detectChanges();
  });

  it('mostra a marca compacta e o menu de conta', () => {
    const brand = fixture.debugElement.query(By.directive(BrandComponent));
    expect(brand).toBeTruthy();
    expect((brand.componentInstance as BrandComponent).compact()).toBe(true);

    expect(fixture.debugElement.query(By.directive(ProfileMenuComponent))).toBeTruthy();
  });

  it('o hamburguer abre a sidebar mobile', () => {
    expect(sidebarState.mobileOpen()).toBe(false);

    fixture.debugElement.query(By.css('.hamburger')).nativeElement.click();

    expect(sidebarState.mobileOpen()).toBe(true);
  });
});
