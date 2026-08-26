import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  it('renderiza a casca da aplicação (app-shell)', () => {
    expect(fixture.debugElement.query(By.css('app-shell'))).toBeTruthy();
  });
});
