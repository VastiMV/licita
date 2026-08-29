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

  /** `larga` para conteúdo que não cabe na caixa de diálogo padrão — hoje o
   * card inteiro de uma oportunidade salva. */
  readonly largura = input<'padrao' | 'larga'>('padrao');

  readonly fechar = output<void>();
}
