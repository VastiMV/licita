import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, of, switchMap, catchError, tap } from 'rxjs';

export interface OpcaoCombo {
  readonly id: number;
  readonly nome: string;
  /** Linha menor embaixo do nome (ex.: "vende a Jaguaribe"). */
  readonly detalhe?: string | null;
  /** Vem primeiro e marcada — no fabricante, os que o fornecedor vende. */
  readonly destaque?: boolean;
}

/** Caixa alta, sem acento, espaços colapsados — a mesma regra do backend
 * (`apps/produtos/models.normalizar_nome`) para decidir se já existe. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

let proximoId = 0;

/**
 * Dropdown com busca e "criar novo" — o mesmo para fornecedor, fabricante,
 * marca e modelo no Cotador.
 *
 * Quem usa passa `buscar` (a consulta, normalmente ao backend) e, se der
 * para criar ali, `criar`. A opção "Criar" só aparece quando nenhuma opção
 * tem o mesmo nome normalizado — e o backend ainda devolve o existente se
 * mesmo assim chegar uma duplicata.
 */
@Component({
  selector: 'app-combobox',
  templateUrl: './combobox.component.html',
  styleUrl: './combobox.component.scss',
  host: { '(focusout)': 'aoSairDoFoco($event)' },
})
export class ComboboxComponent {
  private readonly elemento = inject(ElementRef<HTMLElement>);

  readonly rotulo = input.required<string>();
  readonly placeholder = input('Pesquisar…');
  readonly selecionado = input<OpcaoCombo | null>(null);
  readonly buscar = input.required<(termo: string) => Observable<readonly OpcaoCombo[]>>();
  readonly criar = input<((nome: string) => Observable<OpcaoCombo | undefined>) | null>(null);
  readonly desabilitado = input(false);
  /** Texto do item "criar" — ex.: "Cadastrar fornecedor" quando criar abre um modal. */
  readonly rotuloCriar = input('Criar');

  readonly escolheu = output<OpcaoCombo | null>();

  protected readonly listaId = `combobox-${++proximoId}`;
  protected readonly aberto = signal(false);
  protected readonly termo = signal('');
  protected readonly opcoes = signal<readonly OpcaoCombo[]>([]);
  protected readonly carregando = signal(false);
  protected readonly ativo = signal(0);
  protected readonly criando = signal(false);

  private readonly consultas = new Subject<string>();

  /** Mostra "Criar “x”" se há termo e nenhuma opção com o mesmo nome. */
  protected readonly podeCriar = computed(() => {
    const termo = this.termo().trim();
    if (!this.criar() || !termo) return false;
    const chave = normalizarNome(termo);
    return !this.opcoes().some((opcao) => normalizarNome(opcao.nome) === chave);
  });

  /** Quantas linhas navegáveis: as opções e, se houver, a de criar. */
  private readonly totalLinhas = computed(() => this.opcoes().length + (this.podeCriar() ? 1 : 0));

  constructor() {
    this.consultas
      .pipe(
        tap(() => this.carregando.set(true)),
        debounceTime(200),
        switchMap((termo) => this.buscar()(termo).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((opcoes) => {
        this.opcoes.set(opcoes);
        this.carregando.set(false);
        this.ativo.set(0);
      });
  }

  protected abrir(): void {
    if (this.desabilitado() || this.aberto()) return;
    this.aberto.set(true);
    this.termo.set('');
    this.consultas.next('');
  }

  protected digitou(valor: string): void {
    this.termo.set(valor);
    this.aberto.set(true);
    this.consultas.next(valor);
  }

  protected teclado(evento: KeyboardEvent): void {
    const total = this.totalLinhas();
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (!this.aberto()) this.abrir();
      else this.ativo.set(total ? (this.ativo() + 1) % total : 0);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.ativo.set(total ? (this.ativo() - 1 + total) % total : 0);
    } else if (evento.key === 'Enter' && this.aberto()) {
      evento.preventDefault();
      const opcao = this.opcoes()[this.ativo()];
      if (opcao) this.escolher(opcao);
      else if (this.podeCriar()) this.criarNovo();
    } else if (evento.key === 'Escape' && this.aberto()) {
      evento.stopPropagation();
      this.fechar();
    }
  }

  protected escolher(opcao: OpcaoCombo): void {
    this.escolheu.emit(opcao);
    this.fechar();
  }

  protected limpar(): void {
    this.escolheu.emit(null);
    this.fechar();
  }

  protected criarNovo(): void {
    const criar = this.criar();
    const nome = this.termo().trim();
    if (!criar || this.criando()) return;
    this.criando.set(true);
    criar(nome).subscribe({
      next: (criada) => {
        this.criando.set(false);
        if (criada) this.escolher(criada);
      },
      error: () => this.criando.set(false),
    });
  }

  protected aoSairDoFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !this.elemento.nativeElement.contains(destino)) this.fechar();
  }

  private fechar(): void {
    this.aberto.set(false);
    this.termo.set('');
  }
}
