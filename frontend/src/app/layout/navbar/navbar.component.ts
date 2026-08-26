import { Component } from '@angular/core';

import { BrandComponent } from '../brand/brand.component';
import { NavItemComponent } from '../nav-item/nav-item.component';

interface NavLink {
  readonly path: string;
  readonly label: string;
}

/**
 * Topbar das páginas de módulo (Oportunidades/Alertas/Filtros) — marca +
 * menu. Não é usada no login: essa página é independente, mostra só a
 * `Brand` (ver `pages/auth/login`).
 */
@Component({
  selector: 'app-navbar',
  imports: [BrandComponent, NavItemComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly links: readonly NavLink[] = [
    { path: '/oportunidades', label: 'Oportunidades' },
    { path: '/alertas', label: 'Alertas' },
    { path: '/filtros', label: 'Filtros' },
  ];
}
