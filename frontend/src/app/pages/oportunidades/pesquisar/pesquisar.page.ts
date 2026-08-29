import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MODALIDADES } from '../../../contracts/licitacoes/modalidade';
import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';
import { UFS } from '../../../contracts/localidades/uf';
import { LicitacoesService } from '../../../services/licitacoes/licitacoes.service';
import { OportunidadesSalvasService } from '../../../services/licitacoes/oportunidades-salvas.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { hojeIso, somarDias } from '../../../shared/ui/date-picker/date-picker.utils';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { InputTextComponent } from '../../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../../shared/ui/select/select.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { VoltarTopoComponent } from '../../../shared/ui/voltar-topo/voltar-topo.component';
import { EditalCardComponent } from '../edital-card/edital-card.component';
import {
  DetalheEstado,
  EditalCard,
  agruparPorEdital,
} from '../edital-card/edital-card.model';

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

/** Busca de oportunidades — o módulo "Oportunidades / Pesquisar". Consulta
 * ao vivo, não persiste nada (ver docs/DOMINIO.md); o que persiste é o que
 * o usuário salva daqui, e isso vive em "Oportunidades / Salvas". */
@Component({
  selector: 'app-pesquisar-page',
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
  templateUrl: './pesquisar.page.html',
  styleUrl: './pesquisar.page.scss',
})
export class PesquisarPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly licitacoes = inject(LicitacoesService);
  private readonly salvasService = inject(OportunidadesSalvasService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

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

  /** Chaves (`cnpj-ano-seq`) do que já está na lista de salvas — é o que
   * marca o card como salvo. Salvar deixou de ser um toggle: quem sai da
   * lista sai pelo módulo de salvas (ver `salvar`). */
  private readonly salvas = signal<ReadonlySet<string>>(new Set());
  private readonly salvando = signal<string | null>(null);

  /** Documentos + CAPAG de cada card — carregados automaticamente assim que a
   * busca volta (um card não espera o outro; cada um mostra "carregando" até
   * a própria resposta chegar). Nada fica atrás de um clique. */
  private readonly detalhes = signal<ReadonlyMap<string, DetalheEstado>>(new Map());

  ngOnInit(): void {
    this.carregarSalvas();
  }

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

  protected estaSalva(chave: string): boolean {
    return this.salvas().has(chave);
  }

  protected estaSalvando(chave: string): boolean {
    return this.salvando() === chave;
  }

  /**
   * Salvar pede confirmação e é **só de ida**: a lista de salvas é
   * compartilhada pela equipe e cada salvamento abre um histórico (ver
   * docs/DOMINIO.md). Um toggle aqui viraria log de cria/apaga/cria — por
   * isso o caminho de volta é o módulo de salvas, com a exclusão dele.
   */
  protected salvar(card: EditalCard): void {
    if (this.estaSalva(card.chave) || this.estaSalvando(card.chave)) return;

    this.modal
      .confirmar({
        titulo: 'Salvar oportunidade',
        mensagem:
          'Esta oportunidade ficará na lista de salvas de toda a equipe, com histórico próprio. ' +
          'Para tirá-la depois, use o módulo Oportunidades / Salvas.',
        confirmarLabel: 'Salvar',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.salvando.set(card.chave);
        const detalhe = this.detalheDe(card.chave);
        this.salvasService
          .salvar({
            itens: card.itens,
            capag: card.contratacao.capag ?? detalhe?.capag ?? null,
            plataforma: detalhe?.plataforma ?? null,
          })
          .subscribe({
            next: () => {
              this.salvando.set(null);
              this.salvas.update((atual) => new Set(atual).add(card.chave));
              this.toast.sucesso('Oportunidade salva.');
            },
            error: () => {
              this.salvando.set(null);
              this.toast.erro('Não foi possível salvar a oportunidade agora.');
            },
          });
      });
  }

  /** Abre o arquivo principal do edital (1º documento) numa aba nova — o
   * botão fica desabilitado até o detalhe carregar (ver `carregarDetalhe`). */
  protected baixarEdital(chave: string): void {
    const url = this.detalheDe(chave)?.documentos[0]?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  /** Só as chaves, não a lista inteira: a lista é paginada e pode ser
   * grande, e aqui só interessa "este card já está salvo?". */
  private carregarSalvas(): void {
    this.salvasService.chaves().subscribe({
      next: (chaves) => this.salvas.set(new Set(chaves)),
      // Falhar aqui não pode atrapalhar a busca: no pior caso o card
      // aparece como não salvo, e o backend é idempotente se salvarem de novo.
      error: () => this.salvas.set(new Set()),
    });
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
