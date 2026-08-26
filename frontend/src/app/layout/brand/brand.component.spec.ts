import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { BrandComponent } from './brand.component';

describe('BrandComponent', () => {
  let fixture: ComponentFixture<BrandComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BrandComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(BrandComponent);
    fixture.detectChanges();
  });

  it('mostra INSIDE e solutions', () => {
    expect(fixture.nativeElement.textContent).toContain('INSIDE');
    expect(fixture.nativeElement.textContent).toContain('solutions');
  });

  it('linka pra raiz da aplicação', () => {
    const link = fixture.debugElement.query(By.css('a.brand'));
    expect(link.attributes['href']).toBe('/');
  });

  it('em modo compact, mostra só a marca (sem o nome)', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('INSIDE');
    expect(fixture.debugElement.query(By.css('svg.brand-mark'))).toBeTruthy();
  });
});
