import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ENDPOINTS } from '../api/endpoints';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('começa sem sessão', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });

  it('login guarda o access token em memória e autentica', () => {
    service.login({ email: 'user@licita.dev', password: 'segredo' }).subscribe();

    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: 'token-abc' });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getAccessToken()).toBe('token-abc');
  });

  it('refresh substitui o access token', () => {
    service.login({ email: 'user@licita.dev', password: 'segredo' }).subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: 'token-abc' });

    service.refresh().subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.refresh}`).flush({ access: 'token-novo' });

    expect(service.getAccessToken()).toBe('token-novo');
  });

  it('logout limpa a sessão', () => {
    service.login({ email: 'user@licita.dev', password: 'segredo' }).subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: 'token-abc' });

    service.logout().subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.logout}`).flush(null);

    expect(service.isAuthenticated()).toBe(false);
  });
});
