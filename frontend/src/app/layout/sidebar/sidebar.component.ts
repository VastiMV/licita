import { Component, inject } from '@angular/core';

import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';
import { BrandComponent } from '../brand/brand.component';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { SidebarStateService } from './sidebar-state.service';

interface NavLink {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Menu lateral das páginas de módulo — marca + navegação. Substituiu a
 * antiga topbar de links horizontais (ver `NavbarComponent`, que agora só
 * tem o botão hamburguer e o menu de perfil).
 *
 * Em desktop fica sempre visível: expandida (marca + rótulos) por padrão,
 * ou recolhida a um trilho de ícones (`SidebarStateService.collapsed`) —
 * quem alterna é o botão de colapso aqui dentro. Em mobile vira um painel
 * off-canvas, escondido até o hamburguer da `Navbar` abrir
 * (`SidebarStateService.mobileOpen`); breakpoint em 640px pra ficar igual
 * ao resto do layout (ver `shell.component.scss`).
 *
 * Não é usada no login: essa página é independente, sem shell nenhuma.
 */
@Component({
  selector: 'app-sidebar',
  imports: [BrandComponent, NavItemComponent, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly state = inject(SidebarStateService);

  protected readonly links: readonly NavLink[] = [
    { path: '/oportunidades', label: 'Oportunidades', icon: 'oportunidades' },
    { path: '/alertas', label: 'Alertas', icon: 'alertas' },
    { path: '/filtros', label: 'Filtros', icon: 'filtros' },
  ];
}
