import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { InputNumberComponent } from '../../shared/ui/input-number/input-number.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
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
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './cotador.page.html',
  styleUrl: './cotador.page.scss',
})
export class CotadorPage {
  private readonly fb = inject(FormBuilder);

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
