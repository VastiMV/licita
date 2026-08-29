import { Dialog } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AvisoModalComponent, AvisoModalData } from './aviso-modal/aviso-modal.component';
import { QuestionModalComponent, QuestionModalData } from './question-modal/question-modal.component';

/**
 * Único ponto para abrir modal no projeto. Nenhuma página injeta `Dialog`
 * do `@angular/cdk/dialog` diretamente — todas chamam `ModalService.aviso(...)`
 * ou `ModalService.confirmar(...)`, que já devolvem o resultado tipado.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly dialog = inject(Dialog);

  /** Mensagem informativa com uma única ação. Resolve quando o usuário fecha o modal. */
  aviso(data: AvisoModalData): Observable<void> {
    const ref = this.dialog.open<void, AvisoModalData>(AvisoModalComponent, { data });
    return ref.closed;
  }

  /**
   * Modal de conteúdo próprio — para o que não é aviso nem confirmação (ex.:
   * visualizar uma oportunidade salva). Continua passando por aqui para que
   * nenhuma página injete o `Dialog` do CDK direto.
   */
  abrir<TResultado, TData>(
    componente: ComponentType<unknown>,
    data: TData,
  ): Observable<TResultado | undefined> {
    return this.dialog.open<TResultado, TData>(componente, { data }).closed;
  }

  /** Questionbox de confirmação. Resolve `true` (confirmou) ou `false` (cancelou/fechou sem escolher). */
  confirmar(data: QuestionModalData): Observable<boolean> {
    const ref = this.dialog.open<boolean, QuestionModalData>(QuestionModalComponent, { data });
    return ref.closed.pipe(map((resultado) => resultado ?? false));
  }
}
