import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FooterComponent] });
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
  });

  it('mostra o texto institucional', () => {
    expect(fixture.nativeElement.textContent).toContain('SOLUÇÕES QUE TRANSFORMAM A GESTÃO PÚBLICA.');
  });
});
