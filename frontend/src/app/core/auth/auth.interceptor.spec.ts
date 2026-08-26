import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ENDPOINTS } from '../api/endpoints';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  it('não injeta Authorization quando não há sessão', () => {
    http.get('/api/filtros/').subscribe();

    const req = httpMock.expectOne('/api/filtros/');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('injeta Authorization: Bearer quando há access token', () => {
    auth.login({ email: 'a@a.com', password: 'x' }).subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: 'token-abc' });

    http.get('/api/filtros/').subscribe();

    const req = httpMock.expectOne('/api/filtros/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush([]);
  });

  it('em 401, renova a sessão e repete o request original com o token novo', () => {
    let resultado: unknown;
    http.get('/api/filtros/').subscribe((r) => (resultado = r));

    httpMock.expectOne('/api/filtros/').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`/api/${ENDPOINTS.auth.refresh}`).flush({ access: 'token-renovado' });

    const retry = httpMock.expectOne('/api/filtros/');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-renovado');
    retry.flush(['filtro-1']);

    expect(resultado).toEqual(['filtro-1']);
  });

  it('se o refresh falhar, limpa a sessão e propaga o erro', () => {
    let erro: unknown;
    http.get('/api/filtros/').subscribe({ error: (e) => (erro = e) });

    httpMock.expectOne('/api/filtros/').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`/api/${ENDPOINTS.auth.refresh}`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(erro).toBeTruthy();
    expect(auth.isAuthenticated()).toBe(false);
  });
});
