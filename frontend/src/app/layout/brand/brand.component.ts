import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Marca "Inside Solutions" (logo + nome). Único lugar que desenha isso —
 * usado pela `Navbar` (páginas de módulo) e sozinho na página de login,
 * que não tem navbar nenhuma.
 */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss',
})
export class BrandComponent {}
