import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EmpresaRequest } from '../../contracts/empresas/empresa.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { EmpresasService } from './empresas.service';

const PAYLOAD = { nome: 'Inside Solutions Ltda', cnpj: '11222333000181' } as EmpresaRequest;

describe('EmpresasService', () => {
  let service: EmpresasService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      get: vi.fn(() => of([])),
      post: vi.fn(() => of({})),
      put: vi.fn(() => of({})),
      delete: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(EmpresasService);
  });

  it('listar() manda página, tamanho, ordenação e busca pro endpoint', () => {
    const params = { page: 2, page_size: 25, ordering: '-nome', busca: 'inside' };
    service.listar(params).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.empresas.lista, params);
  });

  it('criar() posta na lista', () => {
    service.criar(PAYLOAD).subscribe();

    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.empresas.lista, PAYLOAD);
  });

  it('atualizar() usa PUT — o modal edita o registro inteiro', () => {
    service.atualizar(7, PAYLOAD).subscribe();

    expect(api.put).toHaveBeenCalledWith(ENDPOINTS.empresas.detalhe(7), PAYLOAD);
  });

  it('inativar() chama o detalhe — o DELETE do backend não apaga, inativa', () => {
    service.inativar(7).subscribe();

    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.empresas.detalhe(7));
  });

  it('opcoes() traz só as ativas por padrão', () => {
    service.opcoes().subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.empresas.opcoes, {});
  });

  it('opcoes(true) pede todas — a proposta antiga não pode perder o CNPJ escolhido', () => {
    service.opcoes(true).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.empresas.opcoes, { todas: 1 });
  });
});
