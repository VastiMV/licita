import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, of, throwError } from 'rxjs';

import { CotacaoRequest } from '../../../contracts/cotador/cotacao.contracts';
import { FornecedorOpcao } from '../../../contracts/fornecedores/fornecedor.contracts';
import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';
import { CotadorService } from '../../../services/cotador/cotador.service';
import { FornecedoresService } from '../../../services/fornecedores/fornecedores.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CotadorModalComponent, CotadorModalData } from './cotador-modal.component';

const ITEM_DO_EDITAL = {
  numero_item: '1',
  descricao_resumida: 'Papel A4 75g — resma 500fl',
  descricao_detalhada: null,
  quantidade: 120,
  unidade_medida: 'RESMA',
  valor_unitario_estimado: 30,
  valor_total: 3600,
  tipo_beneficio: null,
  criterio_julgamento: null,
  contratacao_uf: 'SP',
  contratacao_modalidade: 'Pregão Eletrônico',
  contratacao_srp: false,
  contratacao_situacao: null,
  situacao_item: null,
  contratacao_data_publicacao: '2026-08-20',
  contratacao_data_encerramento_proposta: '2026-09-10',
  contratacao_orgao_nome: 'Prefeitura de Campinas',
  contratacao_municipio: 'Campinas',
  contratacao_uasg: '925997',
  contratacao_objeto: 'Aquisição de papel',
  contratacao_cnpj_orgao: '12345678000199',
  contratacao_ano_compra: '2026',
  contratacao_sequencial_compra: '42',
  plataforma_id: 'compras_gov',
  link_plataforma: 'https://compras.gov.br/compra/1',
  link_pncp: null,
  capag: null,
} as OportunidadeResponse;

const FORNECEDOR: FornecedorOpcao = {
  id: 3,
  nome: 'Distribuidora Sul',
  fantasia: '',
  cnpj: '11222333000181',
  cnpj_formatado: '11.222.333/0001-81',
  categoria: 'materiais',
  cidade: 'Campinas',
  uf: 'SP',
  situacao: 'ativo',
  situacao_label: 'Ativo',
  condicao_pagamento: '30_dias',
  prazo_entrega_dias: 10,
};

const DA_BUSCA: CotadorModalData = {
  titulo: 'Aquisição de papel',
  itens: [ITEM_DO_EDITAL],
  oportunidadeId: null,
  oportunidade: { itens: [ITEM_DO_EDITAL], capag: null, plataforma: null },
};

const DA_SALVA: CotadorModalData = {
  titulo: 'Aquisição de papel',
  itens: [ITEM_DO_EDITAL],
  oportunidadeId: 7,
  oportunidade: null,
};

/** A resposta de uma cotação já gravada — o caminho "Abrir cotação". */
const COTACAO_SALVA = {
  id: 15,
  oportunidade_id: 7,
  oportunidade_objeto: 'Aquisição de papel',
  titulo: 'Cotação de papel',
  transporte: '8.00',
  garantia: '0.00',
  lucro_minimo: '10.00',
  lucro_maximo: '35.00',
  impostos: '10.00',
  itens: [
    {
      id: 1,
      numero_item: '1',
      descricao: 'Papel A4 75g',
      unidade: 'RESMA',
      quantidade: '120.0000',
      valor_referencia: '30.0000',
      margem_minima: null,
      margem_maxima: null,
      impostos: null,
      ofertas: [
        {
          id: 1,
          fornecedor: 3,
          nome: 'Distribuidora Sul',
          custo_produto: '24.9000',
          frete: '1.2000',
          outros: '0.0000',
          escolhida: true,
          custo_unitario: '26.1000',
        },
      ],
    },
  ],
  valor_cotado: '4976.40',
  preco_reserva: '4106.40',
  lucro_total: '1096.20',
  capital: '3132.00',
  impostos_embutidos: '497.64',
  custo_produtos: '2988.00',
  totais: {} as never,
  itens_calculados: [],
  atualizada_por_nome: 'Gustavo',
  criada_em: '2026-08-25T12:00:00Z',
  atualizada_em: '2026-08-25T12:00:00Z',
};

function montar(
  dados: CotadorModalData,
  // O padrão é 404: "oportunidade ainda não cotada", que é o caso mais
  // comum e o que o modal precisa tratar como abertura em branco.
  carregar: Observable<unknown> = throwError(() => ({ status: 404 })),
) {
  // Os parâmetros são declarados (mesmo sem uso) para `mock.calls` ficar
  // tipado — sem eles o TS trata cada chamada como tupla vazia.
  const cotador = {
    carregarDaOportunidade: vi.fn((_id: number) => carregar),
    salvar: vi.fn((_payload: CotacaoRequest) =>
      of({ ...COTACAO_SALVA, oportunidade_criada: true }),
    ),
    exportar: vi.fn((_id: number) => of({ conteudo: new Blob(['x']), nome: 'proposta.xlsx' })),
  };
  const fornecedores = { opcoes: vi.fn((_todos?: boolean) => of([FORNECEDOR])) };
  const modal = { abrir: vi.fn(() => of(undefined)), confirmar: vi.fn(() => of(true)) };
  const toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CotadorModalComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: dialogRef },
      { provide: CotadorService, useValue: cotador },
      { provide: FornecedoresService, useValue: fornecedores },
      { provide: ModalService, useValue: modal },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(CotadorModalComponent);
  fixture.detectChanges();
  return { fixture, cotador, fornecedores, modal, toast, dialogRef };
}

/** Acesso ao estado protegido do componente — é o que o teste precisa para
 * simular a digitação sem depender do DOM de cada campo. */
function interno(fixture: ComponentFixture<CotadorModalComponent>) {
  return fixture.componentInstance as never as {
    itens: () => readonly { id: string; ofertas: readonly { id: string }[] }[];
    totais: () => { valorCotado: number; pendencias: number; lucroTotal: number };
    alterarCusto: (item: unknown, oferta: unknown, campo: string, valor: string) => void;
    vincularFornecedor: (item: unknown, oferta: unknown, valor: string) => void;
    adicionarOferta: (item: unknown) => void;
    escolherOferta: (item: unknown, oferta: unknown) => void;
    aplicarMelhores: () => void;
    adicionarItem: (depoisDe?: string) => void;
    removerItem: (item: unknown) => void;
    duplicarItem: (item: unknown) => void;
    alternarImposto: (item: unknown) => void;
    alterarMarkupMinimo: (item: unknown, valor: string) => void;
    alterarMarkupAlvo: (item: unknown, valor: string) => void;
    padroes: () => { markupMinimo: number; markupAlvo: number };
    salvar: () => void;
    exportar: () => void;
  };
}

function precificar(fixture: ComponentFixture<CotadorModalComponent>, custo = '24,90') {
  const api = interno(fixture);
  const item = api.itens()[0];
  api.alterarCusto(item, item.ofertas[0], 'custoProduto', custo);
  api.alterarCusto(item, item.ofertas[0], 'frete', '1,20');
  fixture.detectChanges();
}

describe('CotadorModalComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('abertura pela busca', () => {
    it('nasce com os itens do edital preenchidos — o operador só amarra o fornecedor', () => {
      const { fixture, cotador } = montar(DA_BUSCA);

      expect(cotador.carregarDaOportunidade).not.toHaveBeenCalled();
      expect(interno(fixture).itens()).toHaveLength(1);
      // A descrição é campo editável, então está no `value` — não no texto.
      const descricao = fixture.debugElement.query(By.css('.item-descricao input'));
      expect(descricao.nativeElement.value).toBe('Papel A4 75g — resma 500fl');
    });

    it('não persiste nada só por abrir', () => {
      const { cotador } = montar(DA_BUSCA);

      expect(cotador.salvar).not.toHaveBeenCalled();
    });

    it('avisa que ainda não está salva', () => {
      const { fixture } = montar(DA_BUSCA);

      expect(fixture.nativeElement.textContent).toContain('Ainda não salva');
    });

    it('o seletor de fornecedor traz só os disponíveis numa cotação nova', () => {
      const { fornecedores } = montar(DA_BUSCA);

      expect(fornecedores.opcoes).toHaveBeenCalledWith(false);
    });

    it('salvar manda o payload da oportunidade junto — é o que a põe na lista', () => {
      const { fixture, cotador } = montar(DA_BUSCA);
      precificar(fixture);

      interno(fixture).salvar();

      expect(cotador.salvar).toHaveBeenCalledWith(
        expect.objectContaining({ oportunidade: DA_BUSCA.oportunidade }),
      );
    });

    it('depois de salvar, avisa que a oportunidade também entrou nas salvas', () => {
      const { fixture, toast, dialogRef } = montar(DA_BUSCA);
      precificar(fixture);

      interno(fixture).salvar();

      expect(toast.sucesso).toHaveBeenCalledWith(expect.stringContaining('Oportunidades / Salvas'));
      expect(dialogRef.close).toHaveBeenCalledWith({ cotacaoId: 15, oportunidadeCriada: true });
    });

    it('falha ao salvar não fecha o modal — o trabalho não pode sumir', () => {
      const { fixture, cotador, toast, dialogRef } = montar(DA_BUSCA);
      cotador.salvar.mockReturnValue(throwError(() => new Error('500')));
      precificar(fixture);

      interno(fixture).salvar();

      expect(toast.erro).toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('o estimado do edital na linha do item', () => {
    it('mostra o unitário estimado junto da descrição', () => {
      const { fixture } = montar(DA_BUSCA);

      expect(fixture.nativeElement.textContent).toContain('Estimado R$ 30,00/un');
    });

    it('item ainda sem preço não é comparado com o estimado', () => {
      const { fixture } = montar(DA_BUSCA);

      expect(fixture.nativeElement.textContent).not.toContain('do estimado');
    });

    it('proposta abaixo do estimado aparece como folga', () => {
      const { fixture } = montar(DA_BUSCA);
      precificar(fixture, '15,00');

      const chip = fixture.debugElement.query(By.css('.chip-abaixo'));
      // 16,20 × 1,53 ÷ 0,9 = 27,54 contra o estimado de 30,00.
      expect(chip.nativeElement.textContent).toContain('8,2% abaixo do estimado');
      expect(fixture.debugElement.query(By.css('.chip-acima'))).toBeNull();
    });

    it('proposta acima do estimado aparece como alerta', () => {
      const { fixture } = montar(DA_BUSCA);
      precificar(fixture);

      const chip = fixture.debugElement.query(By.css('.chip-acima'));
      // 26,10 × 1,53 ÷ 0,9 = 44,37 contra o estimado de 30,00.
      expect(chip.nativeElement.textContent).toContain('47,9% acima do estimado');
    });

    it('item criado à mão não inventa estimado', () => {
      const { fixture } = montar(DA_BUSCA);

      interno(fixture).adicionarItem();
      fixture.detectChanges();

      const chips = fixture.debugElement.queryAll(By.css('.chip-sem-estimado'));
      expect(chips).toHaveLength(1);
      expect(chips[0].nativeElement.textContent).toContain('sem valor estimado');
    });

    it('a cotação gravada também mostra o estimado que veio do edital', () => {
      const { fixture } = montar(DA_SALVA, of(COTACAO_SALVA));

      expect(fixture.nativeElement.textContent).toContain('Estimado R$ 30,00/un');
    });
  });

  describe('markup do item', () => {
    /** Os dois campos numéricos do card "Markup deste item", na ordem em
     * que aparecem: mínimo (reserva) e alvo (proposta). */
    function campos(fixture: ComponentFixture<CotadorModalComponent>) {
      return fixture.debugElement
        .queryAll(By.css('.item-detalhe .markup-campo input'))
        .map((campo) => campo.nativeElement as HTMLInputElement);
    }

    it('o item abre com o markup padrão da cotação', () => {
      const { fixture } = montar(DA_BUSCA);

      expect(campos(fixture).map((campo) => campo.value)).toEqual(['12', '45']);
    });

    it('markup acima de 100% é aceito — o campo não tem teto', () => {
      const { fixture } = montar(DA_BUSCA);
      precificar(fixture);

      interno(fixture).alterarMarkupAlvo(interno(fixture).itens()[0], '250');
      fixture.detectChanges();

      expect(campos(fixture)[1].value).toBe('250');
      expect(fixture.nativeElement.textContent).toContain('markup 250%');
    });

    it('a régua do slider cresce junto, em vez de travar o valor', () => {
      const { fixture } = montar(DA_BUSCA);
      const regua = () =>
        fixture.debugElement.queryAll(By.css('.item-detalhe .markup input[type=range]'))[1]
          .nativeElement as HTMLInputElement;

      expect(regua().max).toBe('100');

      interno(fixture).alterarMarkupAlvo(interno(fixture).itens()[0], '250');
      fixture.detectChanges();

      expect(Number(regua().max)).toBeGreaterThan(250);
    });

    it('baixar o alvo abaixo do mínimo arrasta o mínimo junto', () => {
      const { fixture } = montar(DA_BUSCA);

      interno(fixture).alterarMarkupAlvo(interno(fixture).itens()[0], '5');
      fixture.detectChanges();

      expect(campos(fixture).map((campo) => campo.value)).toEqual(['5', '5']);
    });

    it('subir o mínimo acima do alvo empurra o alvo', () => {
      const { fixture } = montar(DA_BUSCA);

      interno(fixture).alterarMarkupMinimo(interno(fixture).itens()[0], '80');
      fixture.detectChanges();

      expect(campos(fixture).map((campo) => campo.value)).toEqual(['80', '80']);
    });

    it('markup negativo é zerado', () => {
      const { fixture } = montar(DA_BUSCA);

      interno(fixture).alterarMarkupMinimo(interno(fixture).itens()[0], '-40');
      fixture.detectChanges();

      expect(campos(fixture)[0].value).toBe('0');
    });

    it('o chip de alvo rápido aplica o markup e fica marcado', () => {
      const { fixture } = montar(DA_BUSCA);
      const chips = () => fixture.debugElement.queryAll(By.css('.alvo'));

      expect(chips()).toHaveLength(6);
      // 25 / 50 / 75 / 100 / 150 / 200 — o quarto é o de 100%.
      chips()[3].nativeElement.click();
      fixture.detectChanges();

      expect(campos(fixture)[1].value).toBe('100');
      expect(chips()[3].nativeElement.classList).toContain('ativo');
      expect(chips()[0].nativeElement.classList).not.toContain('ativo');
    });

    it('a linha do item mostra margem (da venda) ao lado do lucro e markup ao lado do total', () => {
      const { fixture } = montar(DA_BUSCA);
      precificar(fixture);

      const notas = fixture.debugElement
        .queryAll(By.css('.metrica-nota'))
        .map((nota) => nota.nativeElement.textContent.trim());

      // Markup 45% sobre o custo de R$ 26,10 é margem de 26,5% da venda.
      expect(notas).toContain('margem 26,5%');
      expect(notas).toContain('markup 45%');
    });

    it('o resumo dos padrões fala em markup, não em lucro', () => {
      const { fixture } = montar(DA_BUSCA);

      const resumo = fixture.debugElement.query(By.css('.padroes-resumo'));
      expect(resumo.nativeElement.textContent).toContain('Markup 12%–45%');
    });
  });

  describe('abertura por uma oportunidade salva', () => {
    it('carrega a cotação gravada e aplica os padrões e itens dela', () => {
      const { fixture, cotador } = montar(DA_SALVA, of(COTACAO_SALVA));

      expect(cotador.carregarDaOportunidade).toHaveBeenCalledWith(7);
      expect(fixture.nativeElement.textContent).toContain('Cotação salva');
      expect(interno(fixture).totais().valorCotado).toBeCloseTo(4976.4, 2);
    });

    it('404 abre em branco com os itens do snapshot — não é erro para o usuário', () => {
      const { fixture, toast } = montar(DA_SALVA);

      expect(interno(fixture).itens()).toHaveLength(1);
      expect(toast.erro).not.toHaveBeenCalled();
    });

    it('numa cotação salva o seletor lista todos, para não sumir o já escolhido', () => {
      const { fornecedores } = montar(DA_SALVA, of(COTACAO_SALVA));

      expect(fornecedores.opcoes).toHaveBeenCalledWith(true);
    });

    it('salvar manda o id da oportunidade, sem repetir o payload dela', () => {
      const { fixture, cotador } = montar(DA_SALVA, of(COTACAO_SALVA));

      interno(fixture).salvar();

      const payload = cotador.salvar.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(payload['oportunidade_id']).toBe(7);
      expect(payload['oportunidade']).toBeUndefined();
    });
  });

  describe('conta e comparação', () => {
    it('o total responde à digitação do custo, sem ir ao servidor', () => {
      const { fixture, cotador } = montar(DA_BUSCA);

      precificar(fixture);

      // 26,10 × (1 + 8% de transporte + 45% de markup) ÷ 90% × 120 = 5.324,40
      expect(interno(fixture).totais().valorCotado).toBeCloseTo(5324.4, 2);
      expect(cotador.salvar).not.toHaveBeenCalled();
    });

    it('item sem preço conta como pendência', () => {
      const { fixture } = montar(DA_BUSCA);

      expect(interno(fixture).totais().pendencias).toBe(1);
    });

    it('"usar o mais barato em tudo" troca o fornecedor escolhido de todos os itens', () => {
      const { fixture } = montar(DA_BUSCA);
      const api = interno(fixture);
      precificar(fixture, '30,00');

      api.adicionarOferta(api.itens()[0]);
      fixture.detectChanges();
      const item = api.itens()[0];
      api.alterarCusto(item, item.ofertas[1], 'custoProduto', '20,00');
      fixture.detectChanges();

      api.aplicarMelhores();
      fixture.detectChanges();

      expect(interno(fixture).totais().valorCotado).toBeLessThan(4976.4);
    });

    it('vincular um fornecedor do cadastro copia o nome dele para a oferta', () => {
      const { fixture, cotador } = montar(DA_BUSCA);
      const api = interno(fixture);
      precificar(fixture);
      const item = api.itens()[0];

      api.vincularFornecedor(item, item.ofertas[0], '3');
      fixture.detectChanges();
      api.salvar();

      const payload = cotador.salvar.mock.calls[0][0] as unknown as {
        itens: { ofertas: { fornecedor: number | null; nome: string }[] }[];
      };
      expect(payload.itens[0].ofertas[0]).toMatchObject({
        fornecedor: 3,
        nome: 'Distribuidora Sul',
      });
    });

    it('adicionar, duplicar e remover item mexem só na lista local', () => {
      const { fixture, cotador } = montar(DA_BUSCA);
      const api = interno(fixture);

      api.adicionarItem();
      fixture.detectChanges();
      expect(api.itens()).toHaveLength(2);

      api.duplicarItem(api.itens()[0]);
      fixture.detectChanges();
      expect(api.itens()).toHaveLength(3);

      api.removerItem(api.itens()[0]);
      fixture.detectChanges();
      expect(api.itens()).toHaveLength(2);
      expect(cotador.salvar).not.toHaveBeenCalled();
    });

    it('imposto próprio do item vai como número; sem ele, vai nulo (usa o padrão)', () => {
      const { fixture, cotador } = montar(DA_BUSCA);
      const api = interno(fixture);
      precificar(fixture);

      api.salvar();
      let payload = cotador.salvar.mock.calls[0][0] as unknown as {
        itens: { impostos: number | null }[];
      };
      expect(payload.itens[0].impostos).toBeNull();

      api.alternarImposto(api.itens()[0]);
      fixture.detectChanges();
      api.salvar();

      payload = cotador.salvar.mock.calls[1][0] as unknown as {
        itens: { impostos: number | null }[];
      };
      expect(payload.itens[0].impostos).toBe(10);
    });
  });

  describe('exportar', () => {
    it('cotação já salva exporta direto', () => {
      const { fixture, cotador, modal } = montar(DA_SALVA, of(COTACAO_SALVA));

      interno(fixture).exportar();

      expect(modal.confirmar).not.toHaveBeenCalled();
      expect(cotador.exportar).toHaveBeenCalledWith(15);
    });

    it('cotação não salva pergunta antes — exportar implicaria salvar a oportunidade', () => {
      const { fixture, cotador, modal } = montar(DA_BUSCA);
      precificar(fixture);

      interno(fixture).exportar();

      expect(modal.confirmar).toHaveBeenCalled();
      expect(cotador.salvar).toHaveBeenCalled();
      expect(cotador.exportar).toHaveBeenCalledWith(15);
    });

    it('recusar a confirmação não salva nem exporta', () => {
      const { fixture, cotador, modal } = montar(DA_BUSCA);
      modal.confirmar.mockReturnValue(of(false));
      precificar(fixture);

      interno(fixture).exportar();

      expect(cotador.salvar).not.toHaveBeenCalled();
      expect(cotador.exportar).not.toHaveBeenCalled();
    });
  });
});
