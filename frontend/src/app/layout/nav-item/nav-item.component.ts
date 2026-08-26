import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

/** Um link de menu da sidebar. Único lugar que sabe como um item de menu se parece. */
@Component({
  selector: 'app-nav-item',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './nav-item.component.html',
  styleUrl: './nav-item.component.scss',
})
export class NavItemComponent {
  readonly path = input.required<string>();
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();

  /** Modo ícone-só (Sidebar recolhida em desktop) — esconde o rótulo, vira tooltip. */
  readonly compact = input(false);
}
