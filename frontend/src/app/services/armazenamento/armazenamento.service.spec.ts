import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { ArmazenamentoService } from './armazenamento.service';

describe('ArmazenamentoService', () => {
  let service: ArmazenamentoService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { get: vi.fn(() => of([])), put: vi.fn(() => of({})), post: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(ArmazenamentoService);
  });

  it('drivers() pergunta o que está instalado no backend', () => {
    service.drivers().subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.armazenamento.drivers);
  });

  it('config() busca a configuração atual', () => {
    service.config().subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.armazenamento.config);
  });

  it('salvar() manda driver, opções e só os segredos digitados agora', () => {
    const payload = { driver: 'r2', opcoes: { bucket: 'b' }, segredos: { secret_key: 'x' } };
    service.salvar(payload).subscribe();

    expect(api.put).toHaveBeenCalledWith(ENDPOINTS.armazenamento.config, payload);
  });

  it('testar() posta sem corpo', () => {
    service.testar().subscribe();

    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.armazenamento.testar, undefined);
  });
});
