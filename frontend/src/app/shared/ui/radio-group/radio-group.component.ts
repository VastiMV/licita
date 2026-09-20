import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RadioOption {
  readonly value: string;
  readonly label: string;
}

let nextId = 0;

/**
 * Grupo de `<input type="radio">` empilhado na vertical — único componente de
 * rádio do projeto. Serve escolha entre poucas opções que precisam estar
 * TODAS visíveis (ex.: "buscar por palavra-chave ou por UASG", em
 * `pesquisar.page.html`); para listas longas, o componente é o `app-select`.
 *
 * Estado interno é `signal` pelo mesmo motivo do `InputTextComponent`: em
 * Angular zoneless só um `set()` notifica o scheduler, e um `writeValue`
 * (`form.reset(...)`, por exemplo) precisa disso para re-renderizar.
 */
@Component({
  selector: 'app-radio-group',
  templateUrl: './radio-group.component.html',
  styleUrl: './radio-group.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroupComponent),
      multi: true,
    },
  ],
})
export class RadioGroupComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly options = input.required<readonly RadioOption[]>();

  /** Um `name` por instância: dois grupos na mesma página com o mesmo `name`
   * viram um grupo só para o navegador (marcar num desmarca no outro). */
  protected readonly name = `radio-group-${++nextId}`;
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

  protected idDe(option: RadioOption): string {
    return `${this.name}-${option.value}`;
  }

  protected handleChange(novoValor: string): void {
    this.value.set(novoValor);
    this.onChange(novoValor);
    this.onTouched();
  }
}
