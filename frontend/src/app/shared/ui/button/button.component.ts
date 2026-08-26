import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'danger' | 'ghost';

/**
 * Único componente de botão do projeto. O clique nativo borbulha
 * normalmente pelo host, então `<app-button (click)="salvar()">` funciona
 * sem nenhum `@Output` extra.
 */
@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  readonly type = input<'button' | 'submit'>('button');
  readonly variant = input<ButtonVariant>('primary');
  readonly disabled = input(false);
}
