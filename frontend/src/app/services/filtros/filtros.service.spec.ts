import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { FiltrosService } from './filtros.service';

describe('FiltrosService', () => {
  let service: FiltrosService;
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn(() => of([])), post: vi.fn(() => of({})), patch: vi.fn(() => of({})), delete: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(FiltrosService);
  });

  it('listar() chama GET em filtros/', () => {
    service.listar().subscribe();
    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.filtros.lista);
  });

  it('criar() chama POST com o corpo recebido', () => {
    const filtro = { nome: 'Notebooks SP', uf: 'SP' };
    service.criar(filtro).subscribe();
    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.filtros.lista, filtro);
  });

  it('atualizar() chama PATCH no detalhe do id', () => {
    const filtro = { nome: 'Notebooks SP (editado)' };
    service.atualizar(7, filtro).subscribe();
    expect(api.patch).toHaveBeenCalledWith(ENDPOINTS.filtros.detalhe(7), filtro);
  });

  it('remover() chama DELETE no detalhe do id', () => {
    service.remover(7).subscribe();
    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.filtros.detalhe(7));
  });
});
