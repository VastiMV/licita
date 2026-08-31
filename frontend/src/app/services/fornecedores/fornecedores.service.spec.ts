import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FornecedorRequest } from '../../contracts/fornecedores/fornecedor.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { FornecedoresService } from './fornecedores.service';

const PAYLOAD = { nome: 'Marucci Distribuidora', cnpj: '11222333000181' } as FornecedorRequest;

describe('FornecedoresService', () => {
  let service: FornecedoresService;
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
      delete: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(FornecedoresService);
  });

  it('listar() manda página, tamanho, ordenação e busca pro endpoint', () => {
    const params = { page: 2, page_size: 25, ordering: '-nome', busca: 'marucci' };
    service.listar(params).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.fornecedores.lista, params);
  });

  it('criar() posta na lista', () => {
    service.criar(PAYLOAD).subscribe();

    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.fornecedores.lista, PAYLOAD);
  });

  it('atualizar() usa PUT — o modal edita o registro inteiro', () => {
    service.atualizar(7, PAYLOAD).subscribe();

    expect(api.put).toHaveBeenCalledWith(ENDPOINTS.fornecedores.detalhe(7), PAYLOAD);
  });

  it('remover() chama o detalhe', () => {
    service.remover(7).subscribe();

    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.fornecedores.detalhe(7));
  });

  it('opcoes() traz só os disponíveis por padrão', () => {
    service.opcoes().subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.fornecedores.opcoes, {});
  });

  it('opcoes(true) pede todos — a cotação salva não pode perder o escolhido', () => {
    service.opcoes(true).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.fornecedores.opcoes, { todos: 1 });
  });
});
