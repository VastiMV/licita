import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
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

  it('compõe navbar, conteúdo roteado e rodapé — não desenha nada disso sozinho', () => {
    expect(fixture.debugElement.query(By.directive(NavbarComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('router-outlet'))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(FooterComponent))).toBeTruthy();
  });
});
