import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MODALIDADES } from '../../contracts/licitacoes/modalidade';
import { OportunidadeResponse } from '../../contracts/licitacoes/oportunidade.contracts';
import { UFS } from '../../contracts/localidades/uf';
import { LicitacoesService } from '../../services/licitacoes/licitacoes.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../shared/ui/date-picker/date-picker.component';
import { hojeIso, somarDias } from '../../shared/ui/date-picker/date-picker.utils';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../shared/ui/select/select.component';
import { VoltarTopoComponent } from '../../shared/ui/voltar-topo/voltar-topo.component';
import { EditalCardComponent } from './edital-card/edital-card.component';

/** Janela de publicação que a tela já vem preenchida: a última semana. É
 * mais estreita que o default de 30 dias do backend (`JANELA_PADRAO_DIAS` em
 * `apps/licitacoes/views.py`) de propósito — a busca sem período é a mais
 * lenta que existe (ver docs/DOMINIO.md), e quem abre a tela quer ver o que
 * saiu agora. Ampliar continua a um clique de distância nos dois campos. */
const JANELA_PADRAO_DIAS = 7;

/** Função, não constante: as datas dependem de quando a tela abriu (e de
 * quando "Limpar" foi clicado), então não dá pra congelar no módulo. */
function formInicial() {
  const hoje = hojeIso();
  return {
    palavra_chave: '',
    modalidade: '',
    uf: '',
    codigo_unidade: '',
    data_inicial: somarDias(hoje, -JANELA_PADRAO_DIAS),
    data_final: hoje,
  };
}

/** Um card = um edital. A busca devolve 1 linha por item batido (mesmo
 * edital repete se mais de um item casar) — agrupado aqui pra tela, o
 * backend continua devolvendo a lista flat (ver `OportunidadeResponse`).
 * Exportado porque `EditalCardComponent` recebe isso pronto via `@Input` —
 * quem monta o agrupamento é a página, o card só exibe. */
export interface EditalCard {
  readonly chave: string;
  readonly contratacao: OportunidadeResponse;
  readonly itens: readonly OportunidadeResponse[];
}

/** Documentos + CAPAG + plataforma de origem de um card, buscados em
 * `apps.licitacoes.CompraDetalheView`. */
export interface DetalheEstado {
  readonly carregando: boolean;
  readonly documentos: readonly {
    titulo: string | null;
    tipo_documento: string | null;
    url: string | null;
  }[];
  readonly capag: { nota: string; cor: 'verde' | 'amarelo' | 'vermelho' } | null;
  /** Onde a compra de fato acontece — corrige o palpite `link_plataforma`
   * da busca (o PNCP agrega todas as plataformas, ver docs/DOMINIO.md). */
  readonly plataforma: { id: string | null; nome: string | null; link: string } | null;
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
    InputTextComponent,
    SelectComponent,
    DatePickerComponent,
    ButtonComponent,
    IconComponent,
    EditalCardComponent,
    VoltarTopoComponent,
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
  protected readonly ufs = UFS;

  protected readonly form = this.fb.nonNullable.group(formInicial());

  protected readonly resultados = signal<OportunidadeResponse[]>([]);
  protected readonly buscando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly buscou = signal(false);

  protected readonly editais = computed(() => agruparPorEdital(this.resultados()));

  /** Documentos + CAPAG de cada card — carregados automaticamente assim que a
   * busca volta (um card não espera o outro; cada um mostra "carregando" até
   * a própria resposta chegar). Nada fica atrás de um clique. */
  private readonly detalhes = signal<ReadonlyMap<string, DetalheEstado>>(new Map());

  protected buscar(): void {
    this.buscando.set(true);
    this.erro.set(null);
    this.buscou.set(true);
    this.detalhes.set(new Map());

    this.buscaEmAndamento = this.licitacoes.buscarOportunidades(this.form.getRawValue()).subscribe({
      next: (resultados) => {
        this.resultados.set(resultados);
        this.buscando.set(false);
        for (const card of agruparPorEdital(resultados)) {
          this.carregarDetalhe(card);
        }
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
    this.form.reset(formInicial());
    this.resultados.set([]);
    this.erro.set(null);
    this.buscou.set(false);
    this.detalhes.set(new Map());
  }

  protected detalheDe(chave: string): DetalheEstado | undefined {
    return this.detalhes().get(chave);
  }

  /** Abre o arquivo principal do edital (1º documento) numa aba nova — o
   * botão fica desabilitado até o detalhe carregar (ver `carregarDetalhe`). */
  protected baixarEdital(chave: string): void {
    const url = this.detalheDe(chave)?.documentos[0]?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  private carregarDetalhe(card: EditalCard): void {
    const { contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra } =
      card.contratacao;
    if (!contratacao_cnpj_orgao || !contratacao_ano_compra || !contratacao_sequencial_compra)
      return;

    this.definirDetalhe(card.chave, {
      carregando: true,
      documentos: [],
      capag: null,
      plataforma: null,
      erro: false,
    });
    this.licitacoes
      .detalharCompra(contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra)
      .subscribe({
        next: (dados) =>
          this.definirDetalhe(card.chave, {
            carregando: false,
            documentos: dados.documentos,
            capag: dados.capag,
            plataforma: dados.plataforma,
            erro: false,
          }),
        error: () =>
          this.definirDetalhe(card.chave, {
            carregando: false,
            documentos: [],
            capag: null,
            plataforma: null,
            erro: true,
          }),
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
