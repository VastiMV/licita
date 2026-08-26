import { Component, input, output } from '@angular/core';

/**
 * Moldura visual comum a todo modal (cabeçalho com título + fechar, corpo,
 * rodapé de ações). Não sabe nada sobre `@angular/cdk/dialog` — quem abre e
 * fecha o diálogo é o componente de conteúdo (`AvisoModalComponent`,
 * `QuestionModalComponent`, ...), isso aqui só desenha.
 */
@Component({
  selector: 'app-modal-shell',
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
})
export class ModalShellComponent {
  readonly titulo = input('');
  readonly fechar = output<void>();
}
