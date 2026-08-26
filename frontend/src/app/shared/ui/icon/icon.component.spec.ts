import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { IconComponent } from './icon.component';

@Component({
  imports: [IconComponent],
  template: `<app-icon name="user" />`,
})
class HostComponent {}

describe('IconComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('desenha um svg pro ícone pedido', () => {
    const svg = fixture.debugElement.query(By.css('svg'));
    expect(svg).toBeTruthy();
    expect(svg.query(By.css('circle'))).toBeTruthy();
  });
});
