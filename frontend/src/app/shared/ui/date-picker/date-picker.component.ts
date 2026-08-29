import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';
import {
  CelulaDia,
  MESES,
  MESES_CURTOS,
  Semana,
  fimDoMes,
  foraDoIntervalo,
  formatarBr,
  hojeIso,
  inicioDoMes,
  limitar,
  mascararBr,
  paraData,
  parsearBr,
  rotuloPorExtenso,
  semanasDoMes,
  somarDias,
  somarMeses,
  titulosDaSemana,
} from './date-picker.utils';

/** Quantos anos a visão de anos mostra por página — 24 (4×6), igual ao
 * "multi-year view" do Material. */
const ANOS_POR_PAGINA = 24;

/** Em que nível o calendário está: dia -> mês -> ano, o mesmo caminho de
 * navegação do datepicker do Material (clicar no título sobe um nível). */
export type VisaoCalendario = 'dias' | 'meses' | 'anos';

let nextId = 0;

/**
 * Campo de data reutilizável — único componente de escolha de data do
 * projeto, no lugar do `<input type="date">` nativo (que vinha em inglês ou
 * no idioma do SO, com visual do navegador, sem controle nenhum sobre cor).
 *
 * O calendário é nosso: português, tokens de cor do template, navegação
 * dia/mês/ano e teclado — as mesmas capacidades do datepicker do Material,
 * sem trazer o `@angular/material` (e o Material Design junto) pra dentro
 * de um projeto que já tem identidade visual própria em `src/styles/`.
 *
 * O que dá pra ajustar sem mexer no componente:
 *
 * | Propriedade | Default | Para quê |
 * |---|---|---|
 * | `label` | `''` | rótulo acima do campo |
 * | `placeholder` | `'dd/mm/aaaa'` | dica dentro do campo vazio |
 * | `min` / `max` | `null` | limites (ISO); fora deles o dia fica bloqueado e a seta desliga |
 * | `startAt` | `null` | mês que abre quando não há valor (default: hoje) |
 * | `error` | `null` | mensagem de erro abaixo do campo |
 * | `clearable` | `true` | mostra "Limpar" no rodapé |
 * | `showToday` | `true` | mostra "Hoje" no rodapé |
 * | `firstDayOfWeek` | `0` (domingo) | dia que abre a semana |
 *
 * O valor trafega em ISO `aaaa-mm-dd` (o que o backend espera), enquanto o
 * usuário lê e digita `dd/mm/aaaa` — a tradução fica em
 * `date-picker.utils.ts`. Implementa `ControlValueAccessor`, então é
 * `<app-date-picker formControlName="data_inicial" />` como qualquer campo.
 *
 * Estado interno é `signal` pelo mesmo motivo do `InputTextComponent`: em
 * Angular zoneless só um `set()` notifica o scheduler.
 */
@Component({
  selector: 'app-date-picker',
  imports: [OverlayModule, IconComponent],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('dd/mm/aaaa');
  /** Limites em ISO `aaaa-mm-dd`. */
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  /** Mês em que o calendário abre quando o campo está vazio (ISO). */
  readonly startAt = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly clearable = input(true);
  readonly showToday = input(true);
  /** 0 = domingo, 1 = segunda... */
  readonly firstDayOfWeek = input(0);

  private readonly injector = inject(Injector);
  private readonly grade = viewChild<ElementRef<HTMLElement>>('grade');
  private readonly gatilho = viewChild<ElementRef<HTMLElement>>('gatilho');

  protected readonly inputId = `date-picker-${++nextId}`;
  protected readonly hoje = hojeIso();

  protected readonly valor = signal('');
  /** O que está escrito no campo — pode estar pela metade enquanto digita
   * (`04/09/20`), por isso não dá pra derivar de `valor()`. */
  protected readonly texto = signal('');
  protected readonly disabled = signal(false);
  protected readonly aberto = signal(false);
  protected readonly visao = signal<VisaoCalendario>('dias');
  /** Dia "focado" na grade — o que as setas do teclado movem e o que define
   * qual mês está visível. */
  protected readonly dataAtiva = signal(this.hoje);

  /** Abre embaixo do campo; se não couber, em cima (o CDK escolhe). */
  protected readonly posicoes: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly titulosSemana = computed(() => titulosDaSemana(this.firstDayOfWeek()));

  protected readonly semanas = computed<Semana[]>(() => {
    const data = paraData(this.dataAtiva());
    if (!data) return [];
    return semanasDoMes(data.getFullYear(), data.getMonth(), this.firstDayOfWeek());
  });

  protected readonly meses = MESES_CURTOS;

  protected readonly anosDaPagina = computed(() => {
    const primeiro = this.primeiroAnoDaPagina();
    return Array.from({ length: ANOS_POR_PAGINA }, (_, indice) => primeiro + indice);
  });

  protected readonly titulo = computed(() => {
    const data = paraData(this.dataAtiva());
    if (!data) return '';
    switch (this.visao()) {
      case 'dias':
        return `${MESES[data.getMonth()]} de ${data.getFullYear()}`;
      case 'meses':
        return String(data.getFullYear());
      case 'anos': {
        const primeiro = this.primeiroAnoDaPagina();
        return `${primeiro} – ${primeiro + ANOS_POR_PAGINA - 1}`;
      }
    }
  });

  /** Só desliga a seta quando o período inteiro do outro lado está fora dos
   * limites — mês vizinho com pelo menos um dia válido continua alcançável. */
  protected readonly podeVoltar = computed(() => {
    const min = this.min();
    if (!min) return true;
    return fimDoPeriodo(this.deslocar(-1), this.visao()) >= min;
  });

  protected readonly podeAvancar = computed(() => {
    const max = this.max();
    if (!max) return true;
    return inicioDoPeriodo(this.deslocar(1), this.visao()) <= max;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.valor.set(value ?? '');
    this.texto.set(formatarBr(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.aberto.set(false);
  }

  // ---------- campo de texto ----------

  protected digitou(bruto: string): void {
    const mascarado = mascararBr(bruto);
    this.texto.set(mascarado);

    const iso = parsearBr(mascarado);
    if (iso && !foraDoIntervalo(iso, this.min(), this.max())) {
      this.definirValor(iso);
    } else if (mascarado === '') {
      this.definirValor('');
    }
  }

  /** Data pela metade ou impossível (`31/02/2026`) volta pro último valor
   * bom — o campo nunca fica mostrando algo que o formulário não tem. */
  protected saiuDoCampo(): void {
    this.texto.set(formatarBr(this.valor()));
    this.onTouched();
  }

  // ---------- abrir/fechar ----------

  protected alternar(): void {
    this.aberto() ? this.fechar() : this.abrir();
  }

  protected abrir(): void {
    if (this.disabled() || this.aberto()) return;
    this.visao.set('dias');
    this.dataAtiva.set(
      limitar(this.valor() || this.startAt() || this.hoje, this.min(), this.max()),
    );
    this.aberto.set(true);
    // O calendário só existe no DOM depois do próximo render (é um overlay
    // do CDK) — daí o afterNextRender pra mandar o foco pra grade.
    afterNextRender(() => this.grade()?.nativeElement.focus(), { injector: this.injector });
  }

  protected fechar(devolverFoco = false): void {
    if (!this.aberto()) return;
    this.aberto.set(false);
    this.onTouched();
    if (devolverFoco) this.gatilho()?.nativeElement.focus();
  }

  protected teclaNoOverlay(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.fechar(true);
    }
  }

  // ---------- navegação ----------

  protected alternarVisao(): void {
    this.visao.update((atual) => (atual === 'dias' ? 'anos' : 'dias'));
  }

  protected voltar(): void {
    this.dataAtiva.set(this.deslocar(-1));
  }

  protected avancar(): void {
    this.dataAtiva.set(this.deslocar(1));
  }

  protected escolherAno(ano: number): void {
    const data = paraData(this.dataAtiva())!;
    this.dataAtiva.set(this.ajustarPeriodo(ano, data.getMonth()));
    this.visao.set('meses');
  }

  protected escolherMes(mes: number): void {
    const data = paraData(this.dataAtiva())!;
    this.dataAtiva.set(this.ajustarPeriodo(data.getFullYear(), mes));
    this.visao.set('dias');
  }

  protected teclaNaGrade(evento: KeyboardEvent): void {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    const passo = passos[evento.key];
    if (passo !== undefined) {
      evento.preventDefault();
      this.moverAtiva(somarDias(this.dataAtiva(), passo));
      return;
    }

    switch (evento.key) {
      case 'Home':
      case 'End': {
        evento.preventDefault();
        const diaDaSemana = (paraData(this.dataAtiva())!.getDay() - this.firstDayOfWeek() + 7) % 7;
        const deslocamento = evento.key === 'Home' ? -diaDaSemana : 6 - diaDaSemana;
        this.moverAtiva(somarDias(this.dataAtiva(), deslocamento));
        break;
      }
      case 'PageUp':
      case 'PageDown': {
        evento.preventDefault();
        const sentido = evento.key === 'PageUp' ? -1 : 1;
        // Shift pula o ano inteiro, como no Material.
        this.moverAtiva(somarMeses(this.dataAtiva(), sentido * (evento.shiftKey ? 12 : 1)));
        break;
      }
      case 'Enter':
      case ' ':
        evento.preventDefault();
        this.escolherDia(this.dataAtiva());
        break;
    }
  }

  // ---------- seleção ----------

  protected escolherDia(iso: string): void {
    if (this.foraDoLimite(iso)) return;
    this.definirValor(iso);
    this.texto.set(formatarBr(iso));
    this.fechar(true);
  }

  protected escolherHoje(): void {
    this.escolherDia(limitar(this.hoje, this.min(), this.max()));
  }

  protected limpar(): void {
    this.definirValor('');
    this.texto.set('');
    this.fechar(true);
  }

  // ---------- consultas do template ----------

  protected foraDoLimite(iso: string): boolean {
    return foraDoIntervalo(iso, this.min(), this.max());
  }

  protected mesBloqueado(mes: number): boolean {
    const ano = paraData(this.dataAtiva())!.getFullYear();
    const primeiro = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    return this.foraDoLimite(primeiro) && this.foraDoLimite(fimDoMes(primeiro));
  }

  protected anoBloqueado(ano: number): boolean {
    return this.foraDoLimite(`${ano}-01-01`) && this.foraDoLimite(`${ano}-12-31`);
  }

  protected mesSelecionado(mes: number): boolean {
    const data = paraData(this.valor());
    return (
      data !== null &&
      data.getMonth() === mes &&
      data.getFullYear() === paraData(this.dataAtiva())!.getFullYear()
    );
  }

  protected anoSelecionado(ano: number): boolean {
    return paraData(this.valor())?.getFullYear() === ano;
  }

  protected idDia(iso: string): string {
    return `${this.inputId}-${iso}`;
  }

  protected rotuloDia(iso: string): string {
    return rotuloPorExtenso(iso);
  }

  protected chaveCelula(celula: CelulaDia | null, indice: number): string {
    return celula?.iso ?? `vazio-${indice}`;
  }

  // ---------- interno ----------

  private definirValor(iso: string): void {
    if (this.valor() === iso) return;
    this.valor.set(iso);
    this.onChange(iso);
  }

  /** Move o dia focado sem sair dos limites (a grade acompanha, virando o
   * mês sozinha quando a seta atravessa a borda). */
  private moverAtiva(iso: string): void {
    this.dataAtiva.set(limitar(iso, this.min(), this.max()));
  }

  /** Um período pra frente (`+1`) ou pra trás (`-1`), no passo da visão
   * atual: mês, ano ou página de anos. */
  private deslocar(sentido: number): string {
    switch (this.visao()) {
      case 'dias':
        return somarMeses(this.dataAtiva(), sentido);
      case 'meses':
        return somarMeses(this.dataAtiva(), sentido * 12);
      case 'anos':
        return somarMeses(this.dataAtiva(), sentido * 12 * ANOS_POR_PAGINA);
    }
  }

  /** Mantém o dia do mês quando ele existe no destino (31/03 -> fevereiro
   * vira 28/02, não 03/03). */
  private ajustarPeriodo(ano: number, mes: number): string {
    const data = paraData(this.dataAtiva())!;
    return somarMeses(this.dataAtiva(), (ano - data.getFullYear()) * 12 + (mes - data.getMonth()));
  }

  private primeiroAnoDaPagina(): number {
    const ano = paraData(this.dataAtiva())?.getFullYear() ?? new Date().getFullYear();
    return ano - (ano % ANOS_POR_PAGINA);
  }
}

function inicioDoPeriodo(iso: string, visao: VisaoCalendario): string {
  const data = paraData(iso)!;
  switch (visao) {
    case 'dias':
      return inicioDoMes(iso);
    case 'meses':
      return `${data.getFullYear()}-01-01`;
    case 'anos': {
      const ano = data.getFullYear();
      return `${ano - (ano % ANOS_POR_PAGINA)}-01-01`;
    }
  }
}

function fimDoPeriodo(iso: string, visao: VisaoCalendario): string {
  const data = paraData(iso)!;
  switch (visao) {
    case 'dias':
      return fimDoMes(iso);
    case 'meses':
      return `${data.getFullYear()}-12-31`;
    case 'anos': {
      const primeiro = data.getFullYear() - (data.getFullYear() % ANOS_POR_PAGINA);
      return `${primeiro + ANOS_POR_PAGINA - 1}-12-31`;
    }
  }
}
