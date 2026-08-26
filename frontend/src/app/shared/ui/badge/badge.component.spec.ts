import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { BadgeComponent } from './badge.component';

@Component({
  imports: [BadgeComponent],
  template: `<app-badge>SP</app-badge>`,
})
class HostComponent {}

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('projeta o conteúdo dentro do span.badge', () => {
    const badge = fixture.debugElement.query(By.css('.badge'));
    expect(badge.nativeElement.textContent.trim()).toBe('SP');
  });
});
