import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('mostra a marca Inside Solutions', () => {
    const brand = fixture.debugElement.query(By.css('.brand'));
    expect(brand.nativeElement.textContent).toContain('INSIDE');
    expect(brand.nativeElement.textContent).toContain('solutions');
  });

  it('tem os três links de navegação principais', () => {
    const links = fixture.debugElement.queryAll(By.css('nav a')).map((a) => a.nativeElement.textContent.trim());
    expect(links).toEqual(['Oportunidades', 'Alertas', 'Filtros']);
  });
});
