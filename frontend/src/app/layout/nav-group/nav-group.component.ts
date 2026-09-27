import { Component, computed, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { NavItemComponent } from '../nav-item/nav-item.component';

/** Um item de submenu — mesma forma de um `NavItemComponent`. Com `itens`,
 * é um subgrupo ("Ciclo de Licitação" → "Oportunidades" → "Buscar"). */
export interface NavSubItem {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
  readonly itens?: readonly NavSubItem[];
  /** O próprio grupo é uma tela (o quadro do Ciclo): o rótulo navega e só
   * a seta abre e fecha. Sem isto, o cabeçalho inteiro abre e fecha. */
  readonly navega?: boolean;
}

/** Um item do trilho de ícones — os grupos achatados. */
interface ItemPlano {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

function achatar(itens: readonly NavSubItem[]): ItemPlano[] {
  return itens.flatMap((item) =>
    item.itens ? [...(item.navega ? [item] : []), ...achatar(item.itens)] : [item],
  );
}

/**
 * Item de menu que agrupa outros ("Oportunidades" → "Buscar" / "Salvas").
 * Por padrão o pai não é link: ele abre e fecha o grupo — quem navega são os
 * filhos. Com `navega`, o rótulo do pai também é uma tela ("Ciclo de
 * Licitação" abre o quadro) e só a seta abre e fecha. Grupos se aninham: um
 * filho com `itens` vira um subgrupo.
 *
 * Com a Sidebar recolhida (trilho de ícones) o grupo desaparece e os filhos
 * viram itens soltos, cada um com o próprio ícone e tooltip: esconder um
 * módulo inteiro atrás de um menu que não dá pra abrir seria pior que perder
 * o agrupamento.
 */
@Component({
  selector: 'app-nav-group',
  imports: [IconComponent, NavItemComponent, RouterLink, RouterLinkActive],
  templateUrl: './nav-group.component.html',
  styleUrl: './nav-group.component.scss',
})
export class NavGroupComponent {
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly itens = input.required<readonly NavSubItem[]>();
  readonly path = input<string | null>(null);
  readonly navega = input(false);

  /** Modo ícone-só (Sidebar recolhida em desktop). */
  readonly compact = input(false);

  /** Começa aberto: são poucos itens e o grupo é o caminho para a tela
   * inicial do app — abrir na mão a cada visita seria atrito puro. */
  protected readonly aberto = signal(true);

  /** Trilho de ícones: o grupo some e ficam só os itens que navegam. */
  protected readonly planos = computed(() =>
    achatar([
      {
        path: this.path() ?? '',
        label: this.label(),
        icon: this.icon(),
        itens: this.itens(),
        navega: this.navega(),
      },
    ]),
  );

  protected alternar(): void {
    this.aberto.update((valor) => !valor);
  }
}
