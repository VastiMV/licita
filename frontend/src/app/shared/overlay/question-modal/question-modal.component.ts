import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

import { ButtonComponent, ButtonVariant } from '../../ui/button/button.component';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

export interface QuestionModalData {
  readonly titulo?: string;
  readonly mensagem: string;
  readonly confirmarLabel?: string;
  readonly cancelarLabel?: string;
  readonly variantConfirmar?: ButtonVariant;
}

/** Modal de confirmação (questionbox): Cancelar/Confirmar. Abrir via `ModalService.confirmar(...)`. */
@Component({
  selector: 'app-question-modal',
  imports: [ButtonComponent, ModalShellComponent],
  templateUrl: './question-modal.component.html',
})
export class QuestionModalComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<QuestionModalData>(DIALOG_DATA);

  protected confirmar(): void {
    this.dialogRef.close(true);
  }

  protected cancelar(): void {
    this.dialogRef.close(false);
  }
}
