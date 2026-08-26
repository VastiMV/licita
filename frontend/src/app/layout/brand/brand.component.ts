import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Marca "Inside Solutions" (logo + nome). Único lugar que desenha isso —
 * usado pela `Sidebar` (páginas de módulo) e sozinho na página de login,
 * que não tem shell nenhuma.
 *
 * `[compact]` mostra só a marca (mesmo desenho do favicon), sem o nome —
 * usado na Sidebar recolhida (modo ícone) e na topbar mobile.
 */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss',
})
export class BrandComponent {
  readonly compact = input(false);
}
