import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let client: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('prefixa o caminho com /api e normaliza barra inicial', () => {
    client.get('filtros/').subscribe();

    const req = httpMock.expectOne('/api/filtros/');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('omite da query string os parâmetros vazios, nulos ou indefinidos', () => {
    client.get('licitacoes/oportunidades/', { palavra_chave: 'notebook', uf: '', uasg: null, buscar: undefined }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/licitacoes/oportunidades/' && r.params.get('palavra_chave') === 'notebook',
    );
    expect(req.request.params.has('uf')).toBe(false);
    expect(req.request.params.has('uasg')).toBe(false);
    expect(req.request.params.has('buscar')).toBe(false);
    req.flush([]);
  });

  it('post envia o corpo tal como recebido', () => {
    const body = { nome: 'Notebooks SP' };
    client.post('filtros/', body).subscribe();

    const req = httpMock.expectOne('/api/filtros/');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});
