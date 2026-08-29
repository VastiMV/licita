import { Component, inject } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';
import { Toast, ToastService, ToastTom } from './toast.service';

/** Ícone fixo por tom (spec: sucesso = check, alerta = exclamação, erro = X). */
const ICONES: Record<ToastTom, IconName> = {
  sucesso: 'check',
  alerta: 'exclamation',
  erro: 'close',
};

/**
 * Pilha de toasts da aplicação — montada uma única vez na `Shell`, nunca
 * por uma página. Quem abre um aviso chama `ToastService`.
 */
@Component({
  selector: 'app-toast-container',
  imports: [IconComponent],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  private readonly service = inject(ToastService);

  protected readonly toasts = this.service.toasts;

  protected icone(tom: ToastTom): IconName {
    return ICONES[tom];
  }

  protected fechar(toast: Toast): void {
    this.service.fechar(toast.id);
  }

  /** A ação fecha o toast: ela sempre leva a outra tela/estado, e um aviso
   * já resolvido em cima da nova tela seria ruído. */
  protected executar(toast: Toast): void {
    toast.acao?.executar();
    this.fechar(toast);
  }
}
