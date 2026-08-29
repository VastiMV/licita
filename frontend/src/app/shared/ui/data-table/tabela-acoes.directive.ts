import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Marca o `<ng-template>` que desenha a coluna de ações de uma linha:
 *
 * ```html
 * <app-data-table ...>
 *   <ng-template appTabelaAcoes let-linha>
 *     <app-button (click)="excluir(linha)">Excluir</app-button>
 *   </ng-template>
 * </app-data-table>
 * ```
 *
 * A tabela não conhece ação nenhuma (excluir, visualizar, gerar proposta...) —
 * quem sabe o que fazer com uma linha é a página que a usa.
 */
@Directive({ selector: 'ng-template[appTabelaAcoes]' })
export class TabelaAcoesDirective<T> {
  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  /** Tipa o `let-linha` do template como a linha da tabela. */
  static ngTemplateContextGuard<T>(
    _diretiva: TabelaAcoesDirective<T>,
    _contexto: unknown,
  ): _contexto is { $implicit: T } {
    return true;
  }
}
