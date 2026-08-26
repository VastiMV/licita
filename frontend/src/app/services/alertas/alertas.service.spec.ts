import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { AlertasService } from './alertas.service';

describe('AlertasService', () => {
  let service: AlertasService;
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(AlertasService);
  });

  it('listar() chama GET em alertas/', () => {
    service.listar().subscribe();
    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.alertas.lista);
  });
});
