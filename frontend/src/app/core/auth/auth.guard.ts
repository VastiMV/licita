import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Bloqueia rotas que exigem sessão. Sem `access` em memória não é
 * necessariamente sessão morta: o `access` some da memória a cada reload de
 * página (nunca vai pro `localStorage`, ver `AuthService`), mas o cookie
 * `httpOnly` do `refresh` (até 30 dias, ver `RefreshView` no backend)
 * continua valendo — sem isso, recarregar a página derrubava o usuário pro
 * login bem antes da sessão de verdade expirar. Por isso tenta renovar
 * antes de desistir e mandar pro login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return auth.refresh().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
