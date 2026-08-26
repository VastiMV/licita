import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';

/**
 * Layout das páginas de módulo — usado como componente de uma rota pai em
 * `app.routes.ts`, nunca envolvendo o login (que é uma rota independente,
 * sem essa casca). Só compõe: quem sabe desenhar navbar/rodapé são os
 * componentes deles.
 */
@Component({
  selector: 'app-shell',
  imports: [NavbarComponent, FooterComponent, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
