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
    // No Shell inteiro, não em cada filha — nenhuma rota atrás dele fica
    // aberta sem login (nova filha entra protegida sem precisar lembrar
    // de repetir `canActivate` nela).
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'oportunidades' },
      {
        path: 'oportunidades',
        loadComponent: () =>
          import('./pages/oportunidades/oportunidades.page').then((m) => m.OportunidadesPage),
      },
      {
        path: 'filtros',
        loadComponent: () => import('./pages/filtros/filtros.page').then((m) => m.FiltrosPage),
      },
      {
        path: 'alertas',
        loadComponent: () => import('./pages/alertas/alertas.page').then((m) => m.AlertasPage),
      },
    ],
  },
  { path: '**', redirectTo: 'oportunidades' },
];
