/**
 * Contratos do Cotador — a formação de preço de uma oportunidade, item a
 * item, com comparação de fornecedores. Ver `apps/cotador/` no backend.
 *
 * Não confundir com `contracts/licitacoes/cotacao.contracts.ts`: aquele é o
 * cotador antigo (um fornecedor implícito, cinco alíquotas, lance de
 * disputa), que continua no menu até ser extinto. Os dois convivem em
 * tabelas separadas.
 *
 * Três coisas do domínio aparecem no formato:
 *
 * - **Percentual é percentual** (35 = 35%), não fração — é o número do
 *   slider. Quem divide por 100 são as fórmulas, num lugar só.
 * - **Nulo no item significa "usa o padrão da cotação"**, e não zero: zero
 *   é a decisão de vender no custo.
 * - **Dinheiro chega como string.** O DRF serializa `Decimal` como string
 *   para não perder centavo no `double` do JSON; a tela converte na borda
 *   (ver `numero()` em `cotador.model.ts`).
 */

import type { OportunidadeSalvaRequest } from '../licitacoes/oportunidade-salva.contracts';

export interface OfertaRequest {
  /** Id do fornecedor cadastrado. Nulo = digitado à mão nesta cotação. */
  readonly fornecedor: number | null;
  readonly nome: string;
  readonly custo_produto: number;
  readonly frete: number;
  readonly outros: number;
  /** A oferta que entra no cálculo — no máximo uma por item. */
  readonly escolhida: boolean;
}

export interface ItemCotacaoRequest {
  readonly numero_item: string;
  readonly descricao: string;
  readonly unidade: string;
  readonly quantidade: number;
  /** O unitário estimado do edital — base do desconto na planilha. */
  readonly valor_referencia: number | null;
  readonly margem_minima: number | null;
  readonly margem_maxima: number | null;
  readonly impostos: number | null;
  readonly ofertas: readonly OfertaRequest[];
}

/** Os percentuais que valem para a cotação inteira. */
export interface PadroesCotacao {
  readonly transporte: number;
  readonly garantia: number;
  readonly lucro_minimo: number;
  readonly lucro_maximo: number;
  readonly impostos: number;
}

export interface CotacaoRequest extends PadroesCotacao {
  readonly titulo: string;
  readonly itens: readonly ItemCotacaoRequest[];
  /** Quando a cotação nasce de uma oportunidade **pesquisada**: o payload
   * dela vai junto e ela entra na lista de salvas ao salvar a cotação. */
  readonly oportunidade?: OportunidadeSalvaRequest;
  /** Quando a oportunidade já está salva (o caminho "Abrir cotação"). */
  readonly oportunidade_id?: number;
}

export interface OfertaResponse extends Omit<OfertaRequest, 'custo_produto' | 'frete' | 'outros'> {
  readonly id: number;
  readonly custo_produto: string;
  readonly frete: string;
  readonly outros: string;
  readonly custo_unitario: string;
}

export interface ItemCotacaoResponse extends Omit<
  ItemCotacaoRequest,
  'quantidade' | 'valor_referencia' | 'ofertas'
> {
  readonly id: number;
  readonly quantidade: string;
  readonly valor_referencia: string | null;
  readonly ofertas: readonly OfertaResponse[];
}

/** Os derivados de um item, na mesma ordem de `itens`. Vêm do servidor para
 * a tela abrir já com os números certos — e para conferir contra a própria
 * conta, que roda a cada tecla. */
export interface ItemCalculadoResponse {
  readonly custo_unitario: string;
  readonly preco_final_unitario: string;
  readonly preco_reserva_unitario: string;
  readonly lucro_unitario: string;
  readonly imposto_unitario: string;
  readonly folga_unitaria: string;
  readonly preco_final_total: string;
  readonly lucro_total: string;
  readonly margem_minima: string;
  readonly margem_maxima: string;
  readonly incompleto: boolean;
  readonly economia_unitaria: string;
}

export interface TotaisResponse {
  readonly itens: number;
  readonly unidades: string;
  readonly custo_produtos: string;
  readonly capital: string;
  readonly transporte: string;
  readonly garantia: string;
  readonly impostos: string;
  readonly valor_cotado: string;
  readonly preco_reserva: string;
  readonly folga: string;
  readonly lucro_total: string;
  readonly lucro_percentual: string;
  readonly margem_media: string;
  readonly economia: string;
  readonly pendencias: number;
}

export interface CotacaoResponse {
  readonly id: number;
  readonly oportunidade_id: number;
  readonly oportunidade_objeto: string;
  readonly titulo: string;
  readonly transporte: string;
  readonly garantia: string;
  readonly lucro_minimo: string;
  readonly lucro_maximo: string;
  readonly impostos: string;
  readonly itens: readonly ItemCotacaoResponse[];
  readonly valor_cotado: string;
  readonly preco_reserva: string;
  readonly lucro_total: string;
  readonly capital: string;
  readonly impostos_embutidos: string;
  readonly custo_produtos: string;
  readonly totais: TotaisResponse;
  readonly itens_calculados: readonly ItemCalculadoResponse[];
  readonly atualizada_por_nome: string | null;
  readonly criada_em: string;
  readonly atualizada_em: string;
  /** Só no POST: a oportunidade acabou de entrar na lista de salvas. É o
   * que o aviso ao usuário precisa saber. */
  readonly oportunidade_criada?: boolean;
}
