import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { ENDPOINTS } from '../api/endpoints';
import type { LoginRequest, LoginResponse, RefreshResponse } from '../../contracts/auth/auth.contracts';
import { decodeJwtPayload } from './jwt';

/**
 * Claims que esperamos encontrar no payload do `access` token, pra exibir
 * nome/e-mail no menu de perfil sem outro request. Nenhuma delas é
 * garantida — o backend ainda não emite token nenhum de verdade (ver
 * docs/ARQUITETURA.md), então tudo aqui é opcional e a UI trata a ausência
 * como "sem dado", nunca como erro.
 */
export interface UsuarioClaims {
  readonly email?: string;
  readonly nome?: string;
}

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

  /** Nome/e-mail lidos do `access` token, pro menu de perfil. `null` sem sessão ou sem claims. */
  readonly usuario = computed<UsuarioClaims | null>(() => {
    const token = this.accessToken();
    return token ? decodeJwtPayload<UsuarioClaims>(token) : null;
  });

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
