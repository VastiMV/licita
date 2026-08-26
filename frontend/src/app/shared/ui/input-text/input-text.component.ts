import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * Campo de texto reutilizável — único componente de `<input type="text|email|password|date">`
 * do projeto. Implementa `ControlValueAccessor` para funcionar com
 * Reactive Forms como qualquer outro form control nativo:
 * `<app-input-text formControlName="nome" label="Nome" />`.
 *
 * Estado interno é `signal`, não campo simples: em Angular zoneless só um
 * `set()` de signal notifica o scheduler — uma escrita via `writeValue`
 * (ex.: `form.patchValue(...)` ao abrir um formulário de edição) precisa
 * disso para o input realmente re-renderizar.
 */
@Component({
  selector: 'app-input-text',
  templateUrl: './input-text.component.html',
  styleUrl: './input-text.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputTextComponent),
      multi: true,
    },
  ],
})
export class InputTextComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password' | 'date'>('text');
  readonly placeholder = input('');
  readonly maxlength = input<number | null>(null);
  readonly error = input<string | null>(null);

  protected readonly inputId = `input-text-${++nextId}`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleInput(rawValue: string): void {
    this.value.set(rawValue);
    this.onChange(rawValue);
  }

  protected handleBlur(): void {
    this.onTouched();
  }
}
