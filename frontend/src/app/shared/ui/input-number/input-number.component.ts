import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/** Aceita o que um brasileiro digita de verdade: "1.234,56", "1234,56" ou
 * "1234.56". Devolve `null` quando não sobra número nenhum — quem chama
 * decide o que fazer com campo vazio. */
export function parseNumero(bruto: string): number | null {
  const limpo = bruto.trim();
  if (!limpo) return null;

  // Só o último separador é decimal; os anteriores são de milhar. Cobre
  // "1.234,56" (ponto de milhar) e "1,234.56" sem precisar saber a locale.
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const decimal = Math.max(ultimaVirgula, ultimoPonto);

  const normalizado =
    decimal === -1
      ? limpo.replace(/[^\d-]/g, '')
      : limpo.slice(0, decimal).replace(/[^\d-]/g, '') +
        '.' +
        limpo.slice(decimal + 1).replace(/\D/g, '');

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Campo numérico reutilizável — único componente de entrada de número do
 * projeto (o `InputTextComponent` cobre texto/e-mail/senha/data e não
 * entende vírgula decimal nem prefixo de moeda).
 *
 * Usa `type="text"` com `inputmode="decimal"` de propósito: `type="number"`
 * no Chrome recusa a vírgula em locale pt-BR e ainda muda o valor sozinho
 * com a rodinha do mouse — os dois são armadilhas numa tela de pregão,
 * onde um dígito errado é dinheiro.
 *
 * Estado interno é `signal` pelo mesmo motivo do `InputTextComponent`: em
 * Angular zoneless só um `set()` de signal notifica o scheduler.
 */
@Component({
  selector: 'app-input-number',
  templateUrl: './input-number.component.html',
  styleUrl: './input-number.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputNumberComponent),
      multi: true,
    },
  ],
})
export class InputNumberComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  /** Some antes do número — "R$" numa coluna de valor. */
  readonly prefixo = input('');
  /** Some depois do número — "%" num campo de percentual. */
  readonly sufixo = input('');
  readonly error = input<string | null>(null);
  /** Rótulo pra leitor de tela quando a coluna já diz o que é o campo e
   * repetir o `label` visualmente poluiria a tabela. */
  readonly ariaLabel = input('');

  protected readonly inputId = `input-number-${++nextId}`;
  protected readonly texto = signal('');
  protected readonly disabled = signal(false);

  protected readonly temAfixo = computed(() => !!this.prefixo() || !!this.sufixo());

  private onChange: (valor: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(valor: number | null): void {
    // Reescreve o texto na notação que o usuário digita (vírgula decimal),
    // não em `toFixed`: um `patchValue` de carga não pode transformar
    // "1,5" em "1.50" e confundir quem está conferindo a coluna.
    this.texto.set(valor == null ? '' : String(valor).replace('.', ','));
  }

  registerOnChange(fn: (valor: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleInput(bruto: string): void {
    this.texto.set(bruto);
    // Campo vazio vale zero pro cálculo: a planilha também trata célula em
    // branco como 0, e deixar `null` correr solto quebraria todas as somas.
    this.onChange(parseNumero(bruto) ?? 0);
  }

  protected handleBlur(): void {
    this.onTouched();
  }
}
