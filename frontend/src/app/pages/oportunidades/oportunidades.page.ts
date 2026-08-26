import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MODALIDADES } from '../../contracts/licitacoes/modalidade';
import {
  CompraDetalheResponse,
  OportunidadeResponse,
} from '../../contracts/licitacoes/oportunidade.contracts';
import { LicitacoesService } from '../../services/licitacoes/licitacoes.service';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../shared/ui/select/select.component';

const FORM_INICIAL = {
  palavra_chave: '',
  modalidade: '',
  uf: '',
  codigo_unidade: '',
  data_inicial: '',
  data_final: '',
};

/** Um card = um edital. A busca devolve 1 linha por item batido (mesmo
 * edital repete se mais de um item casar) — agrupado aqui pra tela, o
 * backend continua devolvendo a lista flat (ver `OportunidadeResponse`). */
interface EditalCard {
  readonly chave: string;
  readonly contratacao: OportunidadeResponse;
  readonly itens: readonly OportunidadeResponse[];
}

/** Estado da busca de documentos+CAPAG de um card — sob demanda, 1 vez por
 * card (ver `LicitacoesService.detalharCompra`). */
interface DetalheEstado {
  readonly carregando: boolean;
  readonly dados: CompraDetalheResponse | null;
  readonly erro: boolean;
}

function chaveEdital(op: OportunidadeResponse): string {
  const { contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra } = op;
  if (contratacao_cnpj_orgao && contratacao_ano_compra && contratacao_sequencial_compra) {
    return `${contratacao_cnpj_orgao}-${contratacao_ano_compra}-${contratacao_sequencial_compra}`;
  }
  // Identificador incompleto (degradação do PNCP, ver docs/DOMINIO.md) — cada
  // item vira o card dele mesmo, em vez de agrupar errado.
  return `${op.contratacao_uasg ?? '?'}-${op.numero_item ?? '?'}`;
}

function agruparPorEdital(resultados: readonly OportunidadeResponse[]): EditalCard[] {
  const grupos = new Map<string, OportunidadeResponse[]>();
  for (const op of resultados) {
    const chave = chaveEdital(op);
    const itens = grupos.get(chave);
    if (itens) {
      itens.push(op);
    } else {
      grupos.set(chave, [op]);
    }
  }
  return Array.from(grupos, ([chave, itens]) => ({ chave, contratacao: itens[0], itens }));
}

@Component({
  selector: 'app-oportunidades-page',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    InputTextComponent,
    SelectComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
  ],
  templateUrl: './oportunidades.page.html',
  styleUrl: './oportunidades.page.scss',
})
export class OportunidadesPage {
  private readonly fb = inject(FormBuilder);
  private readonly licitacoes = inject(LicitacoesService);

  /** Requisição em andamento — guardada só pra `cancelarBusca()` poder abortá-la. */
  private buscaEmAndamento: Subscription | null = null;

  protected readonly modalidades = MODALIDADES;

  protected readonly form = this.fb.nonNullable.group(FORM_INICIAL);

  protected readonly resultados = signal<OportunidadeResponse[]>([]);
  protected readonly buscando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly buscou = signal(false);

  protected readonly editais = computed(() => agruparPorEdital(this.resultados()));

  /** Cards com a lista de itens aberta — não precisa de request, já veio na busca. */
  private readonly itensAbertos = signal<ReadonlySet<string>>(new Set());
  /** Cards com o painel de documentos aberto (documentos + CAPAG, cache em `detalhes`). */
  private readonly documentosAbertos = signal<ReadonlySet<string>>(new Set());
  private readonly detalhes = signal<ReadonlyMap<string, DetalheEstado>>(new Map());

  protected buscar(): void {
    this.buscando.set(true);
    this.erro.set(null);
    this.buscou.set(true);
    this.itensAbertos.set(new Set());
    this.documentosAbertos.set(new Set());
    this.detalhes.set(new Map());

    this.buscaEmAndamento = this.licitacoes.buscarOportunidades(this.form.getRawValue()).subscribe({
      next: (resultados) => {
        this.resultados.set(resultados);
        this.buscando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível buscar agora. Tente novamente em instantes.');
        this.buscando.set(false);
      },
    });
  }

  /** Desfazer o `subscribe` aborta a requisição HTTP em andamento de verdade (não só ignora a resposta). */
  protected cancelarBusca(): void {
    this.buscaEmAndamento?.unsubscribe();
    this.buscaEmAndamento = null;
    this.buscando.set(false);
  }

  /** Volta a tela ao estado inicial — filtros, resultado e mensagens, tudo junto. */
  protected limpar(): void {
    this.cancelarBusca();
    this.form.reset(FORM_INICIAL);
    this.resultados.set([]);
    this.erro.set(null);
    this.buscou.set(false);
    this.itensAbertos.set(new Set());
    this.documentosAbertos.set(new Set());
    this.detalhes.set(new Map());
  }

  protected itensAbertosPara(chave: string): boolean {
    return this.itensAbertos().has(chave);
  }

  protected alternarItens(chave: string): void {
    this.itensAbertos.update((atual) => alternarNoSet(atual, chave));
  }

  protected documentosAbertosPara(chave: string): boolean {
    return this.documentosAbertos().has(chave);
  }

  protected detalheDe(chave: string): DetalheEstado | undefined {
    return this.detalhes().get(chave);
  }

  /** Abre/fecha o painel de documentos; busca só na primeira vez (cache em `detalhes`). */
  protected alternarDocumentos(card: EditalCard): void {
    const aberto = this.documentosAbertosPara(card.chave);
    this.documentosAbertos.update((atual) => alternarNoSet(atual, card.chave));
    if (aberto || this.detalheDe(card.chave)) return;

    const { contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra } =
      card.contratacao;
    if (!contratacao_cnpj_orgao || !contratacao_ano_compra || !contratacao_sequencial_compra) return;

    this.definirDetalhe(card.chave, { carregando: true, dados: null, erro: false });
    this.licitacoes
      .detalharCompra(contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra)
      .subscribe({
        next: (dados) => this.definirDetalhe(card.chave, { carregando: false, dados, erro: false }),
        error: () => this.definirDetalhe(card.chave, { carregando: false, dados: null, erro: true }),
      });
  }

  private definirDetalhe(chave: string, estado: DetalheEstado): void {
    this.detalhes.update((atual) => {
      const novo = new Map(atual);
      novo.set(chave, estado);
      return novo;
    });
  }
}

function alternarNoSet<T>(conjunto: ReadonlySet<T>, valor: T): ReadonlySet<T> {
  const novo = new Set(conjunto);
  if (novo.has(valor)) {
    novo.delete(valor);
  } else {
    novo.add(valor);
  }
  return novo;
}
