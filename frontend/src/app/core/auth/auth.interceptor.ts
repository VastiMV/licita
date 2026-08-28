import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { ENDPOINTS } from '../api/endpoints';
import { AuthService } from './auth.service';

/**
 * Injeta `Authorization: Bearer <access>` em todo request à API e, quando a
 * resposta vem `401`, tenta renovar a sessão uma vez (via `AuthService.refresh`,
 * que usa o cookie `httpOnly` do refresh token) antes de repetir o request
 * original. Chamadas de refresh concorrentes compartilham a mesma renovação
 * em vez de disparar uma por request — é o que `refreshInFlight$` garante.
 *
 * Quando o próprio refresh falha (cookie ausente/expirado/blacklisted — sessão
 * de verdade morreu), não faz sentido devolver só o erro pro chamador: sem
 * isso a tela ficava presa mostrando "erro ao carregar" com o usuário
 * efetivamente deslogado. Manda direto pro `/login`, igual o `authGuard` faz
 * quando barra uma navegação.
 */
let refreshInFlight$: Observable<unknown> | null = null;

type HttpEventStream = Observable<HttpEvent<unknown>>;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthEndpoint = req.url.includes(ENDPOINTS.auth.login) || req.url.includes(ENDPOINTS.auth.refresh);

  const authorizedReq = withBearerToken(req, auth.getAccessToken(), isAuthEndpoint);

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }
      return refreshAndRetry(auth, router, authorizedReq, next);
    }),
  );
};

function refreshAndRetry(
  auth: AuthService,
  router: Router,
  originalReq: HttpRequest<unknown>,
  next: HttpHandlerFn,
): HttpEventStream {
  refreshInFlight$ ??= auth.refresh().pipe(
    finalize(() => {
      refreshInFlight$ = null;
    }),
    shareReplay(1),
  );

  return refreshInFlight$.pipe(
    switchMap(() => next(withBearerToken(originalReq, auth.getAccessToken(), false))),
    catchError((refreshError: unknown) => {
      auth.clearSession();
      router.navigateByUrl('/login');
      return throwError(() => refreshError);
    }),
  );
}

function withBearerToken(
  req: HttpRequest<unknown>,
  token: string | null,
  isAuthEndpoint: boolean,
): HttpRequest<unknown> {
  if (!token || isAuthEndpoint) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
