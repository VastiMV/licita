import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainerComponent } from '../../shared/ui/toast/toast-container.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

/**
 * Layout das páginas de módulo — usado como componente de uma rota pai em
 * `app.routes.ts`, nunca envolvendo o login (que é uma rota independente,
 * sem essa casca). Só compõe: quem sabe desenhar sidebar/topbar/rodapé são
 * os componentes deles.
 *
 * A pilha de toasts (`ToastContainerComponent`) é montada aqui, uma vez só:
 * as páginas chamam `ToastService` e não sabem onde o aviso aparece.
 */
@Component({
  selector: 'app-shell',
  imports: [
    SidebarComponent,
    NavbarComponent,
    FooterComponent,
    ToastContainerComponent,
    RouterOutlet,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
