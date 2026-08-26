import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

// Mesmo breakpoint usado no resto do layout (ver *.component.scss) — acima
// disso é desktop, abaixo é mobile.
const MOBILE_QUERY = '(max-width: 640px)';

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
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly isMobileViewport = toSignal(
    this.breakpointObserver.observe(MOBILE_QUERY).pipe(map((estado) => estado.matches)),
    { initialValue: this.breakpointObserver.isMatched(MOBILE_QUERY) },
  );

  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);

  /**
   * Se a Sidebar deve mesmo desenhar em modo ícone (marca compacta, rótulo
   * escondido). Não é só `collapsed()`: sem checar a viewport, um "recolher"
   * feito em desktop continuava valendo ao reabrir em mobile — o painel
   * off-canvas abria só com ícones em vez do menu completo, já que
   * `collapsed` é um conceito exclusivo de desktop.
   */
  readonly iconOnly = computed(() => this.collapsed() && !this.isMobileViewport());

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
