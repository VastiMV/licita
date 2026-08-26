import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { LicitacoesService } from './licitacoes.service';

describe('LicitacoesService', () => {
  let service: LicitacoesService;
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(LicitacoesService);
  });

  it('buscarOportunidades() chama GET em licitacoes/oportunidades/ com os parâmetros de busca', () => {
    const params = { palavra_chave: 'notebook', uf: 'SP' };
    service.buscarOportunidades(params).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.licitacoes.oportunidades, params);
  });
});
