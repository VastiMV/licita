import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { OportunidadesSalvasService } from './oportunidades-salvas.service';

describe('OportunidadesSalvasService', () => {
  let service: OportunidadesSalvasService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      get: vi.fn(() => of({ chaves: [] })),
      post: vi.fn(() => of({})),
      delete: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(OportunidadesSalvasService);
  });

  it('listar() manda página, tamanho, ordenação e busca pro endpoint', () => {
    const params = { page: 2, page_size: 25, ordering: '-prazo', busca: 'cafe' };
    service.listar(params).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.licitacoes.salvas, params);
  });

  it('chaves() devolve a lista crua, não o envelope da resposta', () => {
    api.get.mockReturnValue(of({ chaves: ['123-2026-1'] }));

    let chaves: readonly string[] = [];
    service.chaves().subscribe((c) => (chaves = c));

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.licitacoes.salvasChaves);
    expect(chaves).toEqual(['123-2026-1']);
  });

  it('salvar() posta o snapshot da oportunidade', () => {
    const payload = { itens: [], capag: null, plataforma: null };
    service.salvar(payload).subscribe();

    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.licitacoes.salvas, payload);
  });

  it('remover() e removerExpiradas() batem nas rotas de exclusão', () => {
    service.remover(7).subscribe();
    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.licitacoes.salva(7));

    service.removerExpiradas().subscribe();
    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.licitacoes.salvasExpiradas);
  });
});
