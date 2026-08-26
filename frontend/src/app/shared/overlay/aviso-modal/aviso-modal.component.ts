import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

export interface AvisoModalData {
  readonly titulo?: string;
  readonly mensagem: string;
}

/** Modal de mensagem informativa, uma única ação ("OK"). Abrir via `ModalService.aviso(...)`. */
@Component({
  selector: 'app-aviso-modal',
  imports: [ButtonComponent, ModalShellComponent],
  templateUrl: './aviso-modal.component.html',
})
export class AvisoModalComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<AvisoModalData>(DIALOG_DATA);

  protected fechar(): void {
    this.dialogRef.close();
  }
}
