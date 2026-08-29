import { Component, input } from '@angular/core';

export type IconName =
  | 'menu'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'oportunidades'
  | 'alertas'
  | 'filtros'
  | 'user'
  | 'logout'
  | 'edit'
  | 'spinner'
  | 'arrow-right'
  | 'arrow-up'
  | 'download'
  | 'external-link'
  | 'check'
  | 'bookmark'
  | 'calendar'
  | 'chevron-up'
  | 'exclamation'
  | 'eye'
  | 'search'
  | 'trash';

/**
 * Catálogo de ícones inline (SVG) do projeto — único lugar que sabe
 * desenhar um ícone de uso geral. Não inclui a marca (ver `BrandComponent`,
 * que é a logo, não um ícone qualquer).
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
