import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import type { Observable } from 'rxjs';

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

  it('renova a sessão pelo cookie de refresh em vez de redirecionar direto', () => {
    let value: boolean | UrlTree | undefined;
    (runGuard() as Observable<boolean | UrlTree>).subscribe((v) => (value = v));

    httpMock.expectOne(`/api/${ENDPOINTS.auth.refresh}`).flush({ access: 'token-renovado' });

    expect(value).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('redireciona para /login quando o refresh também falha', () => {
    let value: boolean | UrlTree | undefined;
    (runGuard() as Observable<boolean | UrlTree>).subscribe((v) => (value = v));

    httpMock.expectOne(`/api/${ENDPOINTS.auth.refresh}`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(value).toBeInstanceOf(UrlTree);
    expect((value as UrlTree).toString()).toBe('/login');
  });
});
