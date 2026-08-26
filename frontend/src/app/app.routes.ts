import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'oportunidades' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'oportunidades',
    loadComponent: () =>
      import('./pages/oportunidades/oportunidades.page').then((m) => m.OportunidadesPage),
  },
  {
    path: 'filtros',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/filtros/filtros.page').then((m) => m.FiltrosPage),
  },
  {
    path: 'alertas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/alertas/alertas.page').then((m) => m.AlertasPage),
  },
  { path: '**', redirectTo: 'oportunidades' },
];
