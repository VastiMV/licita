import { Injectable, signal } from '@angular/core';

/**
 * Estado de exibição da Sidebar, compartilhado entre `SidebarComponent` (que
 * desenha) e `NavbarComponent`/`ShellComponent` (que precisam saber pra
 * abrir o menu mobile e reservar espaço no layout). Dois conceitos
 * independentes:
 *
 * - `collapsed`: em desktop, alterna entre expandida (marca + rótulos) e
 *   recolhida (só ícones) — ver pedido do usuário sobre "modo ícone".
 * - `mobileOpen`: em mobile, a Sidebar vira um painel off-canvas; isso
 *   controla se ele está aberto. Não existe em desktop.
 */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);

  toggleCollapsed(): void {
    this.collapsed.update((valor) => !valor);
  }

  toggleMobile(): void {
    this.mobileOpen.update((valor) => !valor);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
