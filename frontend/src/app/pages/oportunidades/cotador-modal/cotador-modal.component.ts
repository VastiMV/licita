import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import {
  CotacaoRequest,
  CotacaoResponse,
  ItemCotacaoRequest,
} from '../../../contracts/cotador/cotacao.contracts';
import { FornecedorOpcao } from '../../../contracts/fornecedores/fornecedor.contracts';
import { OportunidadeSalvaRequest } from '../../../contracts/licitacoes/oportunidade-salva.contracts';
import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';
import { CotadorService } from '../../../services/cotador/cotador.service';
import { FornecedoresService } from '../../../services/fornecedores/fornecedores.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ModalShellComponent } from '../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { parseNumero } from '../../../shared/ui/input-number/input-number.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { FornecedorModalComponent } from '../../fornecedores/fornecedor-modal/fornecedor-modal.component';
import {
  ItemCalculado,
  ItemCotador,
  OfertaCotador,
  PADROES_INICIAIS,
  PadroesCotador,
  calcularItem,
  custoUnitarioDa,
  formatarMoeda,
  formatarPercentual,
  formatarQuantidade,
  melhorOferta,
  ofertaEscolhida,
  totalizar,
} from './cotador.model';

/**
 * O que o modal precisa receber. Um dos dois caminhos, nunca os dois:
 *
 * - **da busca** — `itens` (do card) e `oportunidade` (o payload para
 *   salvá-la). Nada está persistido ainda.
 * - **das salvas** — `oportunidadeId`, e `itens` do snapshot para o caso de
 *   ainda não haver cotação.
 */
export interface CotadorModalData {
  readonly titulo: string;
  readonly itens: readonly OportunidadeResponse[];
  readonly oportunidadeId: number | null;
  readonly oportunidade: OportunidadeSalvaRequest | null;
}

/** O que o modal devolve ao fechar — `undefined` quando nada foi salvo. */
export interface CotadorModalResultado {
  readonly cotacaoId: number;
  /** A oportunidade acabou de entrar na lista de salvas. */
  readonly oportunidadeCriada: boolean;
}

let proximoId = 0;
const novoId = () => `l${++proximoId}`;

/** Quantidade padrão de um item criado à mão (o do edital vem com a dele). */
const QUANTIDADE_PADRAO = 1;

function ofertaVazia(): OfertaCotador {
  return {
    id: novoId(),
    fornecedorId: null,
    nome: '',
    custoProduto: 0,
    frete: 0,
    outros: 0,
  };
}

/**
 * O Cotador — a tela de formação de preço de uma oportunidade, aberta como
 * modal a partir do card da busca ("Cotar") ou da lista de salvas ("Abrir
 * cotação").
 *
 * **Nada é persistido enquanto se mexe.** Os itens vêm preenchidos do
 * edital e a cotação vive na memória desta tela; quem abre, olha e desiste
 * não deixa rastro. É o clique em "Salvar cotação" que grava — e é ele
 * também que põe a oportunidade na lista de salvas, para a equipe voltar a
 * ela depois. Por isso não há botão separado de "salvar oportunidade".
 *
 * **A conta roda aqui, a gravação confere lá.** `cotador.model.ts` recalcula
 * a cada tecla; o backend refaz a mesma conta ao gravar (`formulas.py`),
 * porque total não pode vir do cliente.
 *
 * O operador não digita o nome do fornecedor: escolhe um do cadastro
 * (módulo Fornecedores) no seletor de cada oferta — e pode cadastrar um
 * novo sem sair daqui.
 */
@Component({
  selector: 'app-cotador-modal',
  imports: [ModalShellComponent, ButtonComponent, IconComponent],
  templateUrl: './cotador-modal.component.html',
  styleUrl: './cotador-modal.component.scss',
})
export class CotadorModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<CotadorModalResultado>);
  private readonly cotador = inject(CotadorService);
  private readonly fornecedoresService = inject(FornecedoresService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly dados = inject<CotadorModalData>(DIALOG_DATA);

  protected readonly moeda = formatarMoeda;
  protected readonly percentual = formatarPercentual;
  protected readonly quantidade = formatarQuantidade;

  /** Um número dentro de um `<input>`: vírgula decimal, como se digita em
   * pt-BR (mesma escolha do `InputNumberComponent`, que não serve aqui
   * porque esta tela não usa Reactive Forms). */
  protected readonly texto = (valor: number | null) =>
    valor === null ? '' : String(valor).replace('.', ',');

  protected readonly titulo = signal('');
  protected readonly padroes = signal<PadroesCotador>(PADROES_INICIAIS);
  protected readonly itens = signal<readonly ItemCotador[]>([]);

  /** Um item expandido por vez (acordeão): dois painéis abertos deixam a
   * lista impossível de varrer. */
  protected readonly expandido = signal<string | null>(null);
  protected readonly mostrarPadroes = signal(false);
  protected readonly mostrarAjuda = signal(false);

  /** Id da cotação gravada — nulo enquanto ela só existe nesta tela. */
  protected readonly cotacaoId = signal<number | null>(null);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly exportando = signal(false);

  protected readonly fornecedores = signal<readonly FornecedorOpcao[]>([]);

  /** Um cálculo por item, na ordem da lista. Recalculado a cada mudança de
   * `itens` ou `padroes` — é o que faz a tela responder a cada tecla. */
  protected readonly calculados = computed(() =>
    this.itens().map((item) => calcularItem(item, this.padroes())),
  );
  protected readonly totais = computed(() => totalizar(this.itens(), this.padroes()));

  protected readonly temEconomia = computed(() => this.totais().economia > 0.01);

  /** A carga tributária efetiva da cotação inteira — o imposto embutido
   * como % do valor cotado. Não é o percentual do padrão: itens com tributo
   * próprio puxam a média para cima ou para baixo. */
  protected readonly impostosPercentual = computed(() => {
    const { impostos, valorCotado } = this.totais();
    return valorCotado === 0 ? 0 : (impostos / valorCotado) * 100;
  });

  protected readonly resumoPadroes = computed(() => {
    const p = this.padroes();
    return (
      `Transporte ${formatarPercentual(p.transporte)} · ` +
      `Lucro ${formatarPercentual(p.lucroMinimo)}–${formatarPercentual(p.lucroMaximo)} · ` +
      `Tributos ${formatarPercentual(p.impostos)}`
    );
  });

  ngOnInit(): void {
    this.titulo.set(this.dados.titulo);
    this.carregarFornecedores();
    this.carregarCotacao();
  }

  // ---------- carga ----------

  private carregarCotacao(): void {
    if (this.dados.oportunidadeId === null) {
      this.montarDoEdital();
      this.carregando.set(false);
      return;
    }

    this.cotador.carregarDaOportunidade(this.dados.oportunidadeId).subscribe({
      next: (cotacao) => {
        this.aplicar(cotacao);
        this.carregando.set(false);
      },
      // 404 = oportunidade ainda não cotada. Não é erro: é o sinal de abrir
      // em branco, com os itens do snapshot do edital.
      error: () => {
        this.montarDoEdital();
        this.carregando.set(false);
      },
    });
  }

  /** Uma cotação nova já nasce com os itens do edital — o operador só
   * amarra o fornecedor e ajusta o que precisar. */
  private montarDoEdital(): void {
    this.itens.set(
      this.dados.itens.map((item, indice) => ({
        id: novoId(),
        numeroItem: item.numero_item ?? String(indice + 1),
        descricao: item.descricao_resumida ?? '',
        unidade: item.unidade_medida ?? '',
        quantidade: item.quantidade ?? QUANTIDADE_PADRAO,
        valorReferencia: item.valor_unitario_estimado,
        margemMinima: null,
        margemMaxima: null,
        impostos: null,
        ofertas: [ofertaVazia()],
        escolhida: '',
      })),
    );
    // Cada item nasce com uma oferta em branco; `escolhida` aponta pra ela.
    this.itens.update((itens) => itens.map((item) => ({ ...item, escolhida: item.ofertas[0].id })));
    this.expandido.set(this.itens()[0]?.id ?? null);
  }

  private aplicar(cotacao: CotacaoResponse): void {
    this.cotacaoId.set(cotacao.id);
    this.titulo.set(cotacao.titulo || this.dados.titulo);
    this.padroes.set({
      transporte: Number(cotacao.transporte),
      garantia: Number(cotacao.garantia),
      lucroMinimo: Number(cotacao.lucro_minimo),
      lucroMaximo: Number(cotacao.lucro_maximo),
      impostos: Number(cotacao.impostos),
    });

    this.itens.set(
      cotacao.itens.map((item) => {
        const ofertas = item.ofertas.map((oferta) => ({
          id: novoId(),
          fornecedorId: oferta.fornecedor,
          nome: oferta.nome,
          custoProduto: Number(oferta.custo_produto),
          frete: Number(oferta.frete),
          outros: Number(oferta.outros),
        }));
        const marcada = item.ofertas.findIndex((oferta) => oferta.escolhida);
        return {
          id: novoId(),
          numeroItem: item.numero_item,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: Number(item.quantidade),
          valorReferencia: item.valor_referencia === null ? null : Number(item.valor_referencia),
          margemMinima: item.margem_minima === null ? null : Number(item.margem_minima),
          margemMaxima: item.margem_maxima === null ? null : Number(item.margem_maxima),
          impostos: item.impostos === null ? null : Number(item.impostos),
          ofertas,
          escolhida: ofertas[Math.max(marcada, 0)]?.id ?? '',
        };
      }),
    );
    this.expandido.set(null);
  }

  /** Numa cotação já salva o seletor precisa listar **todos** os
   * fornecedores, inclusive inativos: o que já estava escolhido nela não
   * pode sumir da lista. */
  private carregarFornecedores(): void {
    this.fornecedoresService.opcoes(this.dados.oportunidadeId !== null).subscribe({
      next: (opcoes) => this.fornecedores.set(opcoes),
      // Falhar aqui não pode travar a cotação: o operador ainda consegue
      // trabalhar, só não tem o cadastro à mão.
      error: () => this.toast.alerta('Não foi possível carregar o cadastro de fornecedores.'),
    });
  }

  // ---------- leitura para o template ----------

  protected calculoDe(indice: number): ItemCalculado {
    return this.calculados()[indice];
  }

  protected estaExpandido(item: ItemCotador): boolean {
    return this.expandido() === item.id;
  }

  protected indice(posicao: number): string {
    return String(posicao + 1).padStart(2, '0');
  }

  protected nomeDaOferta(oferta: OfertaCotador): string {
    if (oferta.nome) return oferta.nome;
    return this.fornecedores().find((f) => f.id === oferta.fornecedorId)?.nome ?? '';
  }

  protected rotuloDoFornecedor(item: ItemCotador): string {
    const escolhida = ofertaEscolhida(item);
    return escolhida ? this.nomeDaOferta(escolhida) || 'escolher fornecedor' : 'sem fornecedor';
  }

  protected eMelhor(item: ItemCotador, oferta: OfertaCotador): boolean {
    return melhorOferta(item)?.id === oferta.id;
  }

  protected custoDa(oferta: OfertaCotador): number {
    return custoUnitarioDa(oferta);
  }

  /** O item usa tributo próprio (e não o padrão da cotação). */
  protected temImpostoProprio(item: ItemCotador): boolean {
    return item.impostos !== null;
  }

  // ---------- edição de item ----------

  protected alternar(item: ItemCotador): void {
    this.expandido.update((atual) => (atual === item.id ? null : item.id));
  }

  protected adicionarItem(depoisDe?: string): void {
    const oferta = ofertaVazia();
    const novo: ItemCotador = {
      id: novoId(),
      numeroItem: '',
      descricao: '',
      unidade: '',
      quantidade: QUANTIDADE_PADRAO,
      valorReferencia: null,
      margemMinima: null,
      margemMaxima: null,
      impostos: null,
      ofertas: [oferta],
      escolhida: oferta.id,
    };

    this.itens.update((itens) => {
      const posicao = depoisDe ? itens.findIndex((i) => i.id === depoisDe) : -1;
      if (posicao < 0) return [...itens, novo];
      return [...itens.slice(0, posicao + 1), novo, ...itens.slice(posicao + 1)];
    });
    this.expandido.set(novo.id);
  }

  protected duplicarItem(item: ItemCotador): void {
    // Os ids das ofertas são refeitos (são locais), e o escolhido é
    // remapeado pela posição — copiar o id apontaria para a oferta do
    // original.
    const posicaoEscolhida = Math.max(
      item.ofertas.findIndex((o) => o.id === item.escolhida),
      0,
    );
    const ofertas = item.ofertas.map((oferta) => ({ ...oferta, id: novoId() }));
    const copia: ItemCotador = {
      ...item,
      id: novoId(),
      ofertas,
      escolhida: ofertas[posicaoEscolhida]?.id ?? '',
    };

    this.itens.update((itens) => {
      const posicao = itens.findIndex((i) => i.id === item.id);
      return [...itens.slice(0, posicao + 1), copia, ...itens.slice(posicao + 1)];
    });
  }

  protected removerItem(item: ItemCotador): void {
    this.itens.update((itens) => itens.filter((i) => i.id !== item.id));
    if (this.expandido() === item.id) this.expandido.set(null);
  }

  protected alterarDescricao(item: ItemCotador, valor: string): void {
    this.atualizarItem(item.id, (atual) => ({ ...atual, descricao: valor }));
  }

  protected alterarQuantidade(item: ItemCotador, valor: string): void {
    this.atualizarItem(item.id, (atual) => ({
      ...atual,
      quantidade: Math.max(parseNumero(valor) ?? 0, 0),
    }));
  }

  // ---------- fornecedores do item ----------

  protected adicionarOferta(item: ItemCotador): void {
    this.atualizarItem(item.id, (atual) => ({
      ...atual,
      ofertas: [...atual.ofertas, ofertaVazia()],
    }));
  }

  /** Remover é bloqueado quando resta uma só: um item sem nenhuma linha de
   * fornecedor não teria onde receber preço. Se sair a escolhida, a
   * primeira assume. */
  protected removerOferta(item: ItemCotador, oferta: OfertaCotador): void {
    if (item.ofertas.length <= 1) return;
    this.atualizarItem(item.id, (atual) => {
      const ofertas = atual.ofertas.filter((o) => o.id !== oferta.id);
      return {
        ...atual,
        ofertas,
        escolhida: atual.escolhida === oferta.id ? ofertas[0].id : atual.escolhida,
      };
    });
  }

  protected escolherOferta(item: ItemCotador, oferta: OfertaCotador): void {
    this.atualizarItem(item.id, (atual) => ({ ...atual, escolhida: oferta.id }));
  }

  protected vincularFornecedor(item: ItemCotador, oferta: OfertaCotador, valor: string): void {
    const id = valor ? Number(valor) : null;
    const fornecedor = this.fornecedores().find((f) => f.id === id);
    this.atualizarOferta(item.id, oferta.id, (atual) => ({
      ...atual,
      fornecedorId: id,
      // O nome vem do cadastro — é o que a planilha imprime e o que
      // sobrevive se o fornecedor for excluído depois.
      nome: fornecedor?.nome ?? '',
    }));
  }

  protected alterarCusto(
    item: ItemCotador,
    oferta: OfertaCotador,
    campo: 'custoProduto' | 'frete' | 'outros',
    valor: string,
  ): void {
    this.atualizarOferta(item.id, oferta.id, (atual) => ({
      ...atual,
      [campo]: Math.max(parseNumero(valor) ?? 0, 0),
    }));
  }

  /** Cadastrar sem sair da cotação: o fornecedor novo entra na lista e já
   * fica vinculado à oferta que motivou o cadastro. */
  protected cadastrarFornecedor(item: ItemCotador, oferta: OfertaCotador): void {
    this.modal.abrir<FornecedorOpcao, null>(FornecedorModalComponent, null).subscribe((novo) => {
      if (!novo) return;
      this.fornecedores.update((atuais) =>
        [...atuais, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      this.atualizarOferta(item.id, oferta.id, (atual) => ({
        ...atual,
        fornecedorId: novo.id,
        nome: novo.nome,
      }));
      this.toast.sucesso(`"${novo.nome}" entrou no cadastro e foi vinculado ao item.`);
    });
  }

  protected usarMelhor(item: ItemCotador): void {
    const melhor = melhorOferta(item);
    if (melhor) this.escolherOferta(item, melhor);
  }

  /** Aplica o fornecedor mais barato em todos os itens de uma vez — o botão
   * verde do topo da lista. */
  protected aplicarMelhores(): void {
    this.itens.update((itens) =>
      itens.map((item) => {
        const melhor = melhorOferta(item);
        return melhor ? { ...item, escolhida: melhor.id } : item;
      }),
    );
  }

  // ---------- margens e tributos ----------

  protected alterarMargemMinima(item: ItemCotador, valor: string): void {
    const minima = Number(valor);
    this.atualizarItem(item.id, (atual) => {
      const maxima = atual.margemMaxima ?? this.padroes().lucroMaximo;
      // Os dois sliders se travam entre si: subir o mínimo empurra o máximo.
      return {
        ...atual,
        margemMinima: minima,
        margemMaxima: maxima < minima ? minima : atual.margemMaxima,
      };
    });
  }

  protected alterarMargemMaxima(item: ItemCotador, valor: string): void {
    const maxima = Number(valor);
    this.atualizarItem(item.id, (atual) => {
      const minima = atual.margemMinima ?? this.padroes().lucroMinimo;
      return {
        ...atual,
        margemMaxima: maxima,
        margemMinima: minima > maxima ? maxima : atual.margemMinima,
      };
    });
  }

  /** Liga/desliga o tributo próprio do item. Ao ligar, começa no valor que
   * já estava valendo (o padrão), pra não dar um salto no preço. */
  protected alternarImposto(item: ItemCotador): void {
    this.atualizarItem(item.id, (atual) => ({
      ...atual,
      impostos: atual.impostos === null ? this.padroes().impostos : null,
    }));
  }

  protected alterarImposto(item: ItemCotador, valor: string): void {
    this.atualizarItem(item.id, (atual) => ({
      ...atual,
      impostos: Math.min(Math.max(parseNumero(valor) ?? 0, 0), 100),
    }));
  }

  protected alterarPadrao(campo: keyof PadroesCotador, valor: string): void {
    const numero = Number(valor);
    this.padroes.update((atuais) => {
      const proximos = { ...atuais, [campo]: numero };
      // Mesmo travamento dos sliders do item, agora no padrão da cotação.
      if (campo === 'lucroMinimo' && proximos.lucroMaximo < numero) proximos.lucroMaximo = numero;
      if (campo === 'lucroMaximo' && proximos.lucroMinimo > numero) proximos.lucroMinimo = numero;
      return proximos;
    });
  }

  // ---------- gravação ----------

  protected salvar(): void {
    if (this.salvando()) return;
    if (this.itens().length === 0) {
      this.toast.alerta('Uma cotação precisa de pelo menos um item.');
      return;
    }

    this.salvando.set(true);
    this.cotador.salvar(this.montarPayload()).subscribe({
      next: (cotacao) => {
        this.salvando.set(false);
        this.cotacaoId.set(cotacao.id);
        this.toast.sucesso(
          cotacao.oportunidade_criada
            ? 'Cotação salva — a oportunidade também entrou em Oportunidades / Salvas.'
            : 'Cotação salva.',
        );
        this.dialogRef.close({
          cotacaoId: cotacao.id,
          oportunidadeCriada: !!cotacao.oportunidade_criada,
        });
      },
      error: () => {
        this.salvando.set(false);
        this.toast.erro('Não foi possível salvar a cotação agora.');
      },
    });
  }

  /**
   * Exportar precisa de uma cotação gravada (a planilha é montada no
   * servidor, a partir dela). Como salvar também põe a oportunidade na
   * lista da equipe, o modal pergunta antes em vez de fazer isso escondido.
   */
  protected exportar(): void {
    const id = this.cotacaoId();
    if (id !== null) {
      this.baixar(id);
      return;
    }

    this.modal
      .confirmar({
        titulo: 'Exportar proposta',
        mensagem:
          'A planilha é gerada a partir da cotação salva. Salvar agora também coloca esta ' +
          'oportunidade na lista de salvas da equipe. Deseja continuar?',
        confirmarLabel: 'Salvar e exportar',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.salvando.set(true);
        this.cotador.salvar(this.montarPayload()).subscribe({
          next: (cotacao) => {
            this.salvando.set(false);
            this.cotacaoId.set(cotacao.id);
            this.baixar(cotacao.id);
          },
          error: () => {
            this.salvando.set(false);
            this.toast.erro('Não foi possível salvar a cotação agora.');
          },
        });
      });
  }

  private baixar(id: number): void {
    this.exportando.set(true);
    this.cotador.exportar(id).subscribe({
      next: ({ conteudo, nome }) => {
        this.exportando.set(false);
        // A planilha vem por fetch autenticado (o token vai no header), então
        // o download é montado aqui a partir do blob.
        const url = URL.createObjectURL(conteudo);
        const link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportando.set(false);
        this.toast.erro('Não foi possível gerar a planilha agora.');
      },
    });
  }

  protected fechar(): void {
    this.dialogRef.close();
  }

  private montarPayload(): CotacaoRequest {
    const padroes = this.padroes();
    const itens: ItemCotacaoRequest[] = this.itens().map((item) => ({
      numero_item: item.numeroItem,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valor_referencia: item.valorReferencia,
      margem_minima: item.margemMinima,
      margem_maxima: item.margemMaxima,
      impostos: item.impostos,
      ofertas: item.ofertas.map((oferta) => ({
        fornecedor: oferta.fornecedorId,
        nome: this.nomeDaOferta(oferta),
        custo_produto: oferta.custoProduto,
        frete: oferta.frete,
        outros: oferta.outros,
        escolhida: oferta.id === item.escolhida,
      })),
    }));

    return {
      titulo: this.titulo(),
      transporte: padroes.transporte,
      garantia: padroes.garantia,
      lucro_minimo: padroes.lucroMinimo,
      lucro_maximo: padroes.lucroMaximo,
      impostos: padroes.impostos,
      itens,
      // Um dos dois, nunca os dois — ver `CotadorModalData`.
      ...(this.dados.oportunidadeId !== null
        ? { oportunidade_id: this.dados.oportunidadeId }
        : { oportunidade: this.dados.oportunidade! }),
    };
  }

  // ---------- helpers de estado ----------

  private atualizarItem(id: string, mudar: (item: ItemCotador) => ItemCotador): void {
    this.itens.update((itens) => itens.map((item) => (item.id === id ? mudar(item) : item)));
  }

  private atualizarOferta(
    itemId: string,
    ofertaId: string,
    mudar: (oferta: OfertaCotador) => OfertaCotador,
  ): void {
    this.atualizarItem(itemId, (item) => ({
      ...item,
      ofertas: item.ofertas.map((oferta) => (oferta.id === ofertaId ? mudar(oferta) : oferta)),
    }));
  }
}
