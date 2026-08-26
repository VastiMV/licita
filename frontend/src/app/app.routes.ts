import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  // Independente de propósito — não é filha do Shell, não tem navbar/menu.
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'oportunidades' },
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
    ],
  },
  { path: '**', redirectTo: 'oportunidades' },
];
