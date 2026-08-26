import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';

import { ENDPOINTS } from '../api/endpoints';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  const runGuard = () =>
    TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

  it('permite a navegação quando há sessão', () => {
    auth.login({ email: 'a@a.com', password: 'x' }).subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: 'token-abc' });

    expect(runGuard()).toBe(true);
  });

  it('redireciona para /login quando não há sessão', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });
});
