import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  CotacaoItem,
  CotacaoRequest,
  CotacaoResponse,
} from '../../contracts/licitacoes/cotacao.contracts';
import { CotacoesService } from '../../services/licitacoes/cotacoes.service';
import { OportunidadesSalvasService } from '../../services/licitacoes/oportunidades-salvas.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { InputNumberComponent } from '../../shared/ui/input-number/input-number.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent, type SelectOption } from '../../shared/ui/select/select.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatarMoeda } from '../oportunidades/edital-card/edital-card.utils';
import {
  AvaliacaoLance,
  ITEM_VAZIO,
  ItemCalculado,
  PARAMETROS_PADRAO,
  ParametrosCotacao,
  SituacaoDegrau,
  StatusLance,
  avaliarLance,
  calcularItem,
  simularDegraus,
  totalizar,
} from './cotador.model';

const FORMATADOR_PERCENTUAL = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A tela guarda percentual como o usuário digita ("8"), o modelo trabalha
 * em fração (0,08) — ver `cotador.model.ts`. */
function emFracao(percentual: number): number {
  return percentual / 100;
}

/** Cor do status no painel de lances. `PODE BAIXAR` não é alerta: é a
 * situação normal no meio de um pregão, com folga sobrando. */
const TOM_POR_STATUS: Record<StatusLance, string> = {
  'DIGITE O LANCE': 'neutro',
  PREJUÍZO: 'perigo',
  'ABAIXO DO MÍNIMO': 'perigo',
  LIMITE: 'atencao',
  'PODE BAIXAR': 'ok',
  'LUCRO IDEAL': 'ok',
};

const TOM_POR_SITUACAO: Record<SituacaoDegrau, string> = {
  CONFORTÁVEL: 'ok',
  ATENÇÃO: 'atencao',
  LIMITE: 'perigo',
};

/**
 * "Cotador" — formação de preço para disputar um pregão.
 *
 * Porta da planilha "Lucro Sobre Custo" que a equipe usava no Excel: os
 * mesmos campos, as mesmas fórmulas (em `cotador.model.ts`, testadas
 * contra o exemplo documentado na planilha) e os mesmos dois painéis —
 * o de lances, pra usar com o pregão acontecendo, e o simulador, pra
 * saber de antemão até onde dá pra baixar.
 *
 * É tela de cálculo, não de cadastro: nada aqui vai para a API, e sair
 * da página descarta a cotação. Persistir depende de model no backend
 * (`apps/licitacoes`), que ainda não existe.
 */
@Component({
  selector: 'app-cotador-page',
  imports: [
    ReactiveFormsModule,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './cotador.page.html',
  styleUrl: './cotador.page.scss',
})
export class CotadorPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cotacoes = inject(CotacoesService);
  private readonly salvas = inject(OportunidadesSalvasService);
  private readonly toast = inject(ToastService);

  protected readonly form = this.fb.nonNullable.group({
    parametros: this.fb.nonNullable.group({
      transporte: [PARAMETROS_PADRAO.transporte * 100],
      garantia: [PARAMETROS_PADRAO.garantia * 100],
      icms: [PARAMETROS_PADRAO.icms * 100],
      pis: [PARAMETROS_PADRAO.pis * 100],
      cofins: [PARAMETROS_PADRAO.cofins * 100],
      ipi: [PARAMETROS_PADRAO.ipi * 100],
      iss: [PARAMETROS_PADRAO.iss * 100],
      lucroDesejado: [PARAMETROS_PADRAO.lucroDesejado * 100],
      lucroMinimo: [PARAMETROS_PADRAO.lucroMinimo * 100],
    }),
    itens: this.fb.array([this.criarItem()]),
  });

  /** Recalcular é de graça (é só aritmética em memória), então a tela
   * responde a cada tecla em vez de exigir um botão "calcular" — durante
   * um pregão ninguém tem tempo de clicar. */
  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly itemSelecionado = signal(0);

  /** Os percentuais já entram preenchidos com o padrão da operação, então
   * o card começa fechado: quem abre o Cotador quer digitar item, não
   * reconferir alíquota. */
  protected readonly parametrosAbertos = signal(false);

  /** Qual oportunidade salva esta cotação pertence. Fica fora do `form`
   * porque não é dado da cotação: é a chave de onde ela se grava. */
  protected readonly oportunidadeId = new FormControl<string>('', { nonNullable: true });

  /** O valor do `FormControl` como signal — em zoneless, ler `.value`
   * direto no template não re-renderiza quando ele muda. */
  protected readonly oportunidadeEscolhida = toSignal(this.oportunidadeId.valueChanges, {
    initialValue: '',
  });

  protected readonly oportunidades = signal<readonly SelectOption[]>([]);
  protected readonly salvando = signal(false);
  protected readonly carregandoCotacao = signal(false);
  protected readonly gravadaEm = signal<string | null>(null);

  protected readonly parametros = computed<ParametrosCotacao>(() => {
    const p = this.valores().parametros ?? {};
    return {
      transporte: emFracao(p.transporte ?? 0),
      garantia: emFracao(p.garantia ?? 0),
      icms: emFracao(p.icms ?? 0),
      pis: emFracao(p.pis ?? 0),
      cofins: emFracao(p.cofins ?? 0),
      ipi: emFracao(p.ipi ?? 0),
      iss: emFracao(p.iss ?? 0),
      lucroDesejado: emFracao(p.lucroDesejado ?? 0),
      lucroMinimo: emFracao(p.lucroMinimo ?? 0),
    };
  });

  protected readonly calculados = computed<readonly ItemCalculado[]>(() => {
    const parametros = this.parametros();
    return (this.valores().itens ?? []).map((linha) =>
      calcularItem(
        {
          fornecedor: linha?.fornecedor ?? '',
          quantidade: linha?.quantidade ?? 0,
          valorUnitarioProduto: linha?.valorUnitarioProduto ?? 0,
          freteFixoUnitario: linha?.freteFixoUnitario ?? 0,
          outrosCustosUnitarios: linha?.outrosCustosUnitarios ?? 0,
          valorReferenciaEdital: linha?.valorReferenciaEdital ?? 0,
        },
        parametros,
      ),
    );
  });

  protected readonly avaliacoes = computed<readonly AvaliacaoLance[]>(() => {
    const parametros = this.parametros();
    const itens = this.valores().itens ?? [];
    return this.calculados().map((calculado, i) =>
      avaliarLance(itens[i]?.lance ?? 0, calculado, parametros),
    );
  });

  protected readonly totais = computed(() => totalizar(this.calculados()));

  /** O simulador olha um item por vez: numa cotação com vários itens, a
   * disputa acontece item a item. */
  protected readonly degraus = computed(() => {
    const calculado = this.calculados()[this.itemSelecionado()];
    return calculado ? simularDegraus(calculado, this.parametros()) : [];
  });

  protected readonly lucroTotalNegativo = computed(() => this.totais().lucroLiquidoTotal < 0);

  /** Totais pelo lance que está na mesa, não pelo preço final calculado —
   * durante a disputa é esse o número que importa. `algumLance` distingue
   * "ninguém deu lance ainda" de "os lances somam zero". */
  protected readonly totaisLance = computed(() => {
    const itens = this.valores().itens ?? [];
    const avaliacoes = this.avaliacoes();

    return {
      valorTotal: avaliacoes.reduce(
        (soma, a, i) => soma + (itens[i]?.quantidade ?? 0) * a.lance,
        0,
      ),
      lucroTotal: avaliacoes.reduce((soma, a) => soma + a.lucroLiquidoTotal, 0),
      algumLance: avaliacoes.some((a) => a.lance > 0),
    };
  });

  /** Nome do item que o simulador está mostrando. */
  protected readonly nomeItemSelecionado = computed(() => {
    const i = this.itemSelecionado();
    return this.valores().itens?.[i]?.fornecedor || `Item ${i + 1}`;
  });

  ngOnInit(): void {
    this.carregarOportunidades();

    // Trocar de edital troca a cotação inteira — carrega a gravada, ou
    // deixa a tela nos padrões quando aquele edital ainda não foi cotado.
    this.oportunidadeId.valueChanges.subscribe((id) => this.aoTrocarOportunidade(id));
  }

  private carregarOportunidades(): void {
    // 100 é o teto do endpoint (`max_page_size` em `OportunidadesSalvasPaginacao`);
    // pedir mais é silenciosamente cortado. Passando disso, a equipe precisa
    // de um select com busca — não de um número maior aqui.
    this.salvas.listar({ page_size: 100 }).subscribe({
      next: (pagina) =>
        this.oportunidades.set(
          pagina.results.map((salva) => ({
            value: String(salva.id),
            label: [salva.objeto || 'Sem objeto', salva.uf]
              .filter(Boolean)
              .join(' — ')
              .slice(0, 120),
          })),
        ),
      error: () => this.toast.erro('Não foi possível carregar as oportunidades salvas.'),
    });
  }

  private aoTrocarOportunidade(id: string): void {
    this.gravadaEm.set(null);
    if (!id) return;

    this.carregandoCotacao.set(true);
    this.cotacoes.carregar(Number(id)).subscribe({
      next: (cotacao) => {
        this.aplicar(cotacao);
        this.carregandoCotacao.set(false);
        this.gravadaEm.set(cotacao.atualizada_em);
      },
      // 404 é o caso normal: edital ainda não cotado. Não é erro de tela.
      error: () => this.carregandoCotacao.set(false),
    });
  }

  /** Joga uma cotação vinda da API dentro do formulário. */
  private aplicar(cotacao: CotacaoResponse): void {
    this.itens.clear();
    for (const item of cotacao.itens) {
      const grupo = this.criarItem();
      grupo.patchValue({
        fornecedor: item.fornecedor ?? '',
        quantidade: item.quantidade ?? 0,
        valorUnitarioProduto: item.valor_unitario_produto ?? 0,
        freteFixoUnitario: item.frete_fixo_unitario ?? 0,
        outrosCustosUnitarios: item.outros_custos_unitarios ?? 0,
        valorReferenciaEdital: item.valor_referencia_edital ?? 0,
        lance: item.lance ?? 0,
      });
      this.itens.push(grupo);
    }
    if (this.itens.length === 0) this.itens.push(this.criarItem());

    const p = cotacao.parametros;
    this.form.controls.parametros.patchValue({
      transporte: p.transporte * 100,
      garantia: p.garantia * 100,
      icms: p.icms * 100,
      pis: p.pis * 100,
      cofins: p.cofins * 100,
      ipi: p.ipi * 100,
      iss: p.iss * 100,
      lucroDesejado: p.lucro_desejado * 100,
      lucroMinimo: p.lucro_minimo * 100,
    });

    this.itemSelecionado.set(0);
  }

  /** O formulário no formato que a API espera — percentual vira fração, e
   * os nomes viram snake_case. */
  private paraRequisicao(): CotacaoRequest {
    const parametros = this.parametros();

    return {
      parametros: {
        transporte: parametros.transporte,
        garantia: parametros.garantia,
        icms: parametros.icms,
        pis: parametros.pis,
        cofins: parametros.cofins,
        ipi: parametros.ipi,
        iss: parametros.iss,
        lucro_desejado: parametros.lucroDesejado,
        lucro_minimo: parametros.lucroMinimo,
      },
      itens: this.itens.controls.map((grupo): CotacaoItem => {
        const v = grupo.getRawValue();
        return {
          fornecedor: v.fornecedor,
          quantidade: v.quantidade,
          valor_unitario_produto: v.valorUnitarioProduto,
          frete_fixo_unitario: v.freteFixoUnitario,
          outros_custos_unitarios: v.outrosCustosUnitarios,
          valor_referencia_edital: v.valorReferenciaEdital,
          lance: v.lance,
        };
      }),
    };
  }

  protected salvarCotacao(): void {
    const id = this.oportunidadeId.value;
    if (!id) {
      this.toast.alerta('Escolha a oportunidade salva à qual esta cotação pertence.');
      return;
    }

    this.salvando.set(true);
    this.cotacoes.salvar(Number(id), this.paraRequisicao()).subscribe({
      next: (cotacao) => {
        this.salvando.set(false);
        this.gravadaEm.set(cotacao.atualizada_em);
        this.toast.sucesso('Cotação salva na oportunidade.');
      },
      error: () => {
        this.salvando.set(false);
        this.toast.erro('Não foi possível salvar a cotação agora.');
      },
    });
  }

  protected get itens() {
    return this.form.controls.itens;
  }

  private criarItem() {
    return this.fb.nonNullable.group({
      fornecedor: [ITEM_VAZIO.fornecedor],
      quantidade: [ITEM_VAZIO.quantidade],
      valorUnitarioProduto: [ITEM_VAZIO.valorUnitarioProduto],
      freteFixoUnitario: [ITEM_VAZIO.freteFixoUnitario],
      outrosCustosUnitarios: [ITEM_VAZIO.outrosCustosUnitarios],
      valorReferenciaEdital: [ITEM_VAZIO.valorReferenciaEdital],
      /** Lance corrente do pregão — só este campo muda durante a disputa. */
      lance: [0],
    });
  }

  protected alternarParametros(): void {
    this.parametrosAbertos.update((aberto) => !aberto);
  }

  /** Clicar numa linha do painel de lances é o que troca o item do
   * simulador — os dois painéis falam do mesmo item. */
  protected selecionarItem(indice: number): void {
    this.itemSelecionado.set(indice);
  }

  protected adicionarItem(): void {
    this.itens.push(this.criarItem());
  }

  protected removerItem(indice: number): void {
    // A cotação nunca fica sem linha nenhuma: some a tabela inteira e o
    // usuário fica sem saber como voltar.
    if (this.itens.length === 1) return;

    this.itens.removeAt(indice);
    if (this.itemSelecionado() >= this.itens.length) {
      this.itemSelecionado.set(this.itens.length - 1);
    }
  }

  /** Copia o lance sugerido pelo simulador para o campo de lance do item —
   * durante o pregão o valor vai daqui direto pro portal. */
  protected usarLance(valor: number): void {
    this.itens.at(this.itemSelecionado())?.controls.lance.setValue(Number(valor.toFixed(2)));
  }

  protected moeda(valor: number): string {
    return formatarMoeda(valor) ?? '—';
  }

  protected percentual(fracao: number): string {
    return FORMATADOR_PERCENTUAL.format(fracao);
  }

  protected tom(status: StatusLance): string {
    return TOM_POR_STATUS[status];
  }

  protected tomSituacao(situacao: SituacaoDegrau): string {
    return TOM_POR_SITUACAO[situacao];
  }
}
