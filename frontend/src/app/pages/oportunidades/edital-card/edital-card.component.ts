import { Component, computed, input, output, signal } from '@angular/core';

import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { DetalheEstado, EditalCard } from '../oportunidades.page';
import {
  diasRestantes as calcularDiasRestantes,
  estaEncerrada,
  formatarData,
  formatarMoeda,
  normalizarTitulo,
  progressoPercentual,
} from './edital-card.utils';

type Aba = 'itens' | 'documentos';

/** Nome e ícone das plataformas que o backend registra
 * (`apps/integracoes/plataformas.py`) — o `id` é o contrato entre os dois.
 * Plataforma nova no backend = uma entrada aqui (com o favicon dela em
 * `public/plataformas/`). Plataforma fora desta tabela ainda abre: o botão
 * usa o nome que o PNCP deu e um ícone genérico. */
const PLATAFORMAS: Record<string, { nome: string; icone: string }> = {
  compras_gov: { nome: 'Compras.gov.br', icone: 'plataformas/compras_gov.png' },
};

/** Card de uma oportunidade (= um edital) na busca — layout desktop (6a) e
 * mobile (7a) do handoff em `docs/Mockups/card_oportunidades/README.md`.
 * As duas versões compartilham o mesmo template; a troca é só CSS
 * (`@media` no breakpoint de 880px que o handoff define), não dois DOMs
 * escolhidos em runtime — mais simples de manter e não depende de JS pra
 * saber a largura da tela. */
@Component({
  selector: 'app-edital-card',
  imports: [IconComponent],
  templateUrl: './edital-card.component.html',
  styleUrl: './edital-card.component.scss',
})
export class EditalCardComponent {
  readonly card = input.required<EditalCard>();
  readonly detalhe = input<DetalheEstado | undefined>(undefined);

  /** A página é quem sabe abrir arquivo (`window.open`) — o card só avisa. */
  readonly baixarEdital = output<void>();

  protected readonly abaAtiva = signal<Aba>('itens');

  // "Salvar oportunidade" ainda não persiste nada — o módulo "Minhas
  // oportunidades" (lista de salvas, com exclusão e status de expirada) está
  // especificado em docs/DOMINIO.md ("OportunidadeSalva") mas não existe.
  // Por enquanto é só o estado visual local, pra deixar a interação e os
  // dois visuais prontos; quando o módulo existir, isto vira uma chamada de
  // serviço (POST/DELETE em /api/licitacoes/salvas/).
  protected readonly salva = signal(false);

  // Helpers de formatação expostos pro template (ver edital-card.utils.ts).
  protected readonly moeda = formatarMoeda;
  protected readonly data = formatarData;

  protected readonly contratacao = computed(() => this.card().contratacao);

  protected readonly titulo = computed(() =>
    normalizarTitulo(this.contratacao().contratacao_objeto),
  );

  protected readonly eyebrow = computed(() => {
    const { contratacao_orgao_nome, contratacao_uf, contratacao_uasg } = this.contratacao();
    const orgao = contratacao_orgao_nome ?? '—';
    const uf = contratacao_uf ? ` — ${contratacao_uf}` : '';
    const uasg = contratacao_uasg ? ` · UASG ${contratacao_uasg}` : '';
    return `${orgao}${uf}${uasg}`;
  });

  protected readonly cidade = computed(() => {
    const { contratacao_municipio, contratacao_uf } = this.contratacao();
    if (!contratacao_municipio) return contratacao_uf ?? '—';
    return contratacao_uf ? `${contratacao_municipio} / ${contratacao_uf}` : contratacao_municipio;
  });

  /** Mesmo número do rodapé da tabela de itens (spec: "Valor estimado" do
   * cabeçalho é o total do edital) — `null` se algum item não tiver valor,
   * em vez de somar parcial e fingir que é o total. */
  protected readonly valorTotalEdital = computed(() => {
    const valores = this.card().itens.map((item) => item.valor_total);
    if (valores.length === 0 || valores.some((valor) => valor == null)) return null;
    return (valores as number[]).reduce((soma, valor) => soma + valor, 0);
  });

  protected readonly diasRestantes = computed(() =>
    calcularDiasRestantes(this.contratacao().contratacao_data_encerramento_proposta),
  );

  protected readonly encerrada = computed(() =>
    estaEncerrada(this.contratacao().contratacao_data_encerramento_proposta),
  );

  protected readonly urgente = computed(() => {
    const dias = this.diasRestantes();
    return !this.encerrada() && dias !== null && dias <= 2;
  });

  protected readonly progresso = computed(() =>
    progressoPercentual(
      this.contratacao().contratacao_data_publicacao,
      this.contratacao().contratacao_data_encerramento_proposta,
    ),
  );

  protected readonly rotuloContagem = computed(() => {
    if (this.encerrada()) return 'Encerrada';
    const dias = this.diasRestantes();
    if (dias === null) return null;
    if (dias === 0) return 'Encerra hoje';
    if (dias === 1) return 'Falta 1 dia';
    return `Faltam ${dias} dias`;
  });

  /** `null` esconde o botão de baixar (spec: nada de botão cinza
   * desabilitado quando não há arquivo). */
  protected readonly urlEditalPrincipal = computed(
    () => this.detalhe()?.documentos[0]?.url ?? null,
  );

  /** O botão dourado "Abrir na plataforma". O link do detalhe
   * (`linkSistemaOrigem` do PNCP) é a verdade e tem prioridade; o da busca é
   * o palpite da plataforma padrão — certo pro que veio do compras.gov.br,
   * chute pro que veio da busca textual do PNCP (que agrega todas as
   * plataformas, ver docs/DOMINIO.md). `null` esconde o botão: link nenhum é
   * melhor que um link que abre 404. */
  protected readonly plataforma = computed(() => {
    const doDetalhe = this.detalhe()?.plataforma ?? null;
    const contratacao = this.contratacao();
    const link = doDetalhe?.link ?? contratacao.link_plataforma;
    if (!link) return null;

    const id = doDetalhe ? doDetalhe.id : contratacao.plataforma_id;
    const registrada = id ? PLATAFORMAS[id] : undefined;
    return {
      link,
      nome: registrada?.nome ?? doDetalhe?.nome ?? null,
      icone: registrada?.icone ?? null,
    };
  });

  protected mudarAba(aba: Aba): void {
    this.abaAtiva.set(aba);
  }

  protected salvar(): void {
    this.salva.set(true);
  }

  protected removerDasSalvas(): void {
    this.salva.set(false);
  }

  /** Chips sob a descrição do item — só com dados reais do PNCP; CATSER e
   * "Ampla concorrência" do mockup eram fictícios (README do handoff) e a
   * API não devolve isso hoje, então ficam de fora em vez de inventados. */
  protected chipsDoItem(item: OportunidadeResponse): readonly string[] {
    const chips: string[] = [];
    if (item.criterio_julgamento) chips.push(item.criterio_julgamento);
    if (item.tipo_beneficio) chips.push(item.tipo_beneficio);
    if (item.contratacao_srp) chips.push('Registro de preços');
    return chips;
  }
}
