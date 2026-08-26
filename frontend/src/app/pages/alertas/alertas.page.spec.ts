import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AlertaResponse } from '../../contracts/alertas/alerta.contracts';
import { AlertasService } from '../../services/alertas/alertas.service';
import { AlertasPage } from './alertas.page';

const ALERTA: AlertaResponse = {
  id: 1,
  criado_em: '2026-08-20T10:00:00Z',
  email_enviado: true,
  filtro: { id: 1, nome: 'Notebooks SP' },
  licitacao: { id: '925123-6-1', objeto: 'Aquisição de notebooks', uasg: '925123' },
};

describe('AlertasPage', () => {
  let fixture: ComponentFixture<AlertasPage>;
  let alertasService: { listar: ReturnType<typeof vi.fn> };

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [AlertasPage],
      providers: [provideRouter([]), { provide: AlertasService, useValue: alertasService }],
    });
    fixture = TestBed.createComponent(AlertasPage);
    fixture.detectChanges();
  }

  it('lista os alertas recebidos', () => {
    alertasService = { listar: vi.fn(() => of([ALERTA])) };
    setup();

    const linha = fixture.debugElement.query(By.css('tbody tr'));
    expect(linha.nativeElement.textContent).toContain('Notebooks SP');
    expect(linha.nativeElement.textContent).toContain('Aquisição de notebooks');
  });

  it('sem alertas, mostra o estado vazio com link para criar filtro', () => {
    alertasService = { listar: vi.fn(() => of([])) };
    setup();

    expect(fixture.debugElement.query(By.css('table'))).toBeNull();
    expect(fixture.debugElement.query(By.css('a[routerLink="/filtros"]'))).toBeTruthy();
  });
});
