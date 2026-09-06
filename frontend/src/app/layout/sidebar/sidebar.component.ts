import { Component, inject } from '@angular/core';

import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';
import { BrandComponent } from '../brand/brand.component';
import { NavGroupComponent, type NavSubItem } from '../nav-group/nav-group.component';
import { NavItemComponent } from '../nav-item/nav-item.component';
import { SidebarStateService } from './sidebar-state.service';

interface NavLink {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
  /** Item de primeiro nível que agrupa outros (ver `NavGroupComponent`) —
   * o pai não é link, quem navega são os filhos. */
  readonly itens?: readonly NavSubItem[];
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
  imports: [BrandComponent, NavItemComponent, NavGroupComponent, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly state = inject(SidebarStateService);

  /** Em mobile a Sidebar é um painel off-canvas: navegar fecha o painel.
   * Abrir/fechar um grupo (ver `NavGroupComponent`), não — o clique no
   * cabeçalho do grupo borbulha até aqui, mas não é navegação. */
  protected fecharSeNavegou(evento: Event): void {
    if ((evento.target as HTMLElement).closest('a')) this.state.closeMobile();
  }

  protected readonly links: readonly NavLink[] = [
    {
      path: '/oportunidades',
      label: 'Oportunidades',
      icon: 'oportunidades',
      itens: [
        { path: '/oportunidades/pesquisar', label: 'Pesquisar', icon: 'search' },
        { path: '/oportunidades/salvas', label: 'Salvas', icon: 'bookmark' },
      ],
    },
    { path: '/fornecedores', label: 'Fornecedores', icon: 'fornecedores' },
    { path: '/alertas', label: 'Alertas', icon: 'alertas' },
    { path: '/filtros', label: 'Filtros', icon: 'filtros' },
    { path: '/cotador', label: 'Cotador', icon: 'cotador' },
  ];
}
