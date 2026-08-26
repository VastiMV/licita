import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { ENDPOINTS } from '../api/endpoints';
import type { LoginRequest, LoginResponse, RefreshResponse } from '../../contracts/auth/auth.contracts';

/**
 * Dono do `access` token em memória — nunca `localStorage`/`sessionStorage`,
 * para reduzir o que um XSS conseguiria roubar de forma persistente. O
 * `refresh` token nem passa por aqui: vive só no cookie `httpOnly` que o
 * backend seta, e o `AuthInterceptor` o usa para renovar a sessão sozinho.
 *
 * Ver docs/ARQUITETURA.md → "Autenticação" no repositório principal para o
 * fluxo completo.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  private readonly accessToken = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  getAccessToken(): string | null {
    return this.accessToken();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse, LoginRequest>(ENDPOINTS.auth.login, credentials)
      .pipe(tap((response) => this.accessToken.set(response.access)));
  }

  /** Chamado pelo `AuthInterceptor` quando um request volta 401. */
  refresh(): Observable<RefreshResponse> {
    return this.api
      .post<RefreshResponse, undefined>(ENDPOINTS.auth.refresh, undefined)
      .pipe(tap((response) => this.accessToken.set(response.access)));
  }

  logout(): Observable<void> {
    return this.api
      .post<void, undefined>(ENDPOINTS.auth.logout, undefined)
      .pipe(tap(() => this.accessToken.set(null)));
  }

  /** Usado só pelo interceptor ao desistir de um refresh — não é logout de negócio. */
  clearSession(): void {
    this.accessToken.set(null);
  }
}
