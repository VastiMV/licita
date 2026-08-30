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
      // "Oportunidades" é um menu de primeiro nível, não uma tela: quem abre
      // é "Pesquisar" (a busca ao vivo, tela inicial do app) ou "Salvas" (a
      // lista que a equipe montou a partir dela).
      {
        path: 'oportunidades',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'pesquisar' },
          {
            path: 'pesquisar',
            loadComponent: () =>
              import('./pages/oportunidades/pesquisar/pesquisar.page').then((m) => m.PesquisarPage),
          },
          {
            path: 'salvas',
            loadComponent: () =>
              import('./pages/oportunidades/salvas/salvas.page').then((m) => m.SalvasPage),
          },
        ],
      },
      {
        path: 'cotador',
        loadComponent: () => import('./pages/cotador/cotador.page').then((m) => m.CotadorPage),
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
  { path: '**', redirectTo: 'oportunidades/pesquisar' },
];
