import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { NavItemComponent } from './nav-item.component';

describe('NavItemComponent', () => {
  let fixture: ComponentFixture<NavItemComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavItemComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(NavItemComponent);
    fixture.componentRef.setInput('path', '/filtros');
    fixture.componentRef.setInput('label', 'Filtros');
    fixture.detectChanges();
  });

  it('mostra o rótulo e linka pro caminho recebido', () => {
    const link = fixture.debugElement.query(By.css('a'));
    expect(link.nativeElement.textContent.trim()).toBe('Filtros');
    expect(link.attributes['href']).toBe('/filtros');
  });
});
