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
    fixture.componentRef.setInput('icon', 'filtros');
    fixture.detectChanges();
  });

  it('mostra o rótulo e linka pro caminho recebido', () => {
    const link = fixture.debugElement.query(By.css('a'));
    expect(link.nativeElement.textContent.trim()).toBe('Filtros');
    expect(link.attributes['href']).toBe('/filtros');
  });

  it('em modo compact, esconde o rótulo e vira tooltip', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('a'));
    expect(link.query(By.css('.label'))).toBeNull();
    expect(link.attributes['title']).toBe('Filtros');
  });
});
