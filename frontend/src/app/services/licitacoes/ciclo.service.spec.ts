import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { CicloService } from './ciclo.service';

describe('CicloService', () => {
  it('quadro() chama GET em licitacoes/ciclo/', () => {
    const api = { get: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });

    TestBed.inject(CicloService).quadro().subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.licitacoes.ciclo);
  });
});
