import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CartaoCiclo, QuadroCiclo } from '../../../contracts/licitacoes/ciclo.contracts';
import { CotadorService } from '../../../services/cotador/cotador.service';
import { CicloService } from '../../../services/licitacoes/ciclo.service';
import { OportunidadesSalvasService } from '../../../services/licitacoes/oportunidades-salvas.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { CotadorModalComponent } from '../../oportunidades/cotador-modal/cotador-modal.component';
import { OportunidadeModalComponent } from '../../oportunidades/salvas/oportunidade-modal/oportunidade-modal.component';
import { QuadroPage, formatarMil } from './quadro.page';

const CARTAO: CartaoCiclo = {
  id: 7,
  etapa: 'oportunidade',
  uasg: '985412',
  municipio: 'Araraquara',
  uf: 'SP',
  objeto: 'Copos descartáveis 180 ml',
  data_encerramento_proposta: '2026-10-06',
  valor_total_estimado: 48600,
  cotacao_id: null,
  valor_cotado: null,
  pendencias: null,
  alerta: { nivel: 'aviso', texto: 'salva há 3 dias, sem cotação' },
  faltas: ['iniciar a cotação para saber se dá'],
  salva: {
    id: 7,
    objeto: 'Copos descartáveis 180 ml',
    itens: [{ numero_item: 1 }],
  } as unknown as CartaoCiclo['salva'],
};

const EM_COTACAO: CartaoCiclo = {
  ...CARTAO,
  id: 9,
  etapa: 'cotacao',
  objeto: 'Papel A4 75 g/m²',
  cotacao_id: 15,
  valor_cotado: 131900,
  pendencias: 0,
  alerta: { nivel: 'ok', texto: 'cotação completa' },
  faltas: [
    'item 3: reserva acima do estimado',
    'preço de fornecedor nos itens 4 e 5',
    'item 6: preço acima do estimado',
    'gerar a proposta',
  ],
  salva: null,
};

function quadro(): QuadroCiclo {
  return {
    hoje: '2026-09-26',
    resumo: {
      prazo_ate_amanha: 0,
      prazo_nesta_semana: 1,
      salvas_sem_cotacao: 1,
      cotacoes_com_pendencia: 0,
    },
    colunas: [
      {
        etapa: 'oportunidade',
        rotulo: 'Oportunidade',
        disponivel: true,
        total_estimado: 48600,
        cartoes: [CARTAO],
      },
      {
        etapa: 'cotacao',
        rotulo: 'Cotação',
        disponivel: true,
        total_estimado: 131900,
        cartoes: [EM_COTACAO],
      },
      { etapa: 'proposta', rotulo: 'Proposta', disponivel: false, total_estimado: 0, cartoes: [] },
      { etapa: 'disputa', rotulo: 'Disputa', disponivel: false, total_estimado: 0, cartoes: [] },
      { etapa: 'empenho', rotulo: 'Empenho', disponivel: false, total_estimado: 0, cartoes: [] },
    ],
    encerradas: { vencidas: 3, concluidas: 0 },
    dias_sem_cotacao: 2,
  };
}

describe('QuadroPage', () => {
  let fixture: ComponentFixture<QuadroPage>;
  let ciclo: { quadro: ReturnType<typeof vi.fn> };
  let modal: { abrir: ReturnType<typeof vi.fn>; confirmar: ReturnType<typeof vi.fn> };
  let salvas: { remover: ReturnType<typeof vi.fn> };
  let cotador: { remover: ReturnType<typeof vi.fn> };
  let fechou: Subject<unknown>;

  beforeEach(() => {
    fechou = new Subject();
    ciclo = { quadro: vi.fn(() => of(quadro())) };
    modal = { abrir: vi.fn(() => fechou), confirmar: vi.fn(() => of(true)) };
    salvas = { remover: vi.fn(() => of(undefined)) };
    cotador = { remover: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      imports: [QuadroPage],
      providers: [
        provideRouter([]),
        { provide: CicloService, useValue: ciclo },
        { provide: ModalService, useValue: modal },
        { provide: OportunidadesSalvasService, useValue: salvas },
        { provide: CotadorService, useValue: cotador },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(QuadroPage);
    fixture.detectChanges();
  });

  const texto = () => fixture.nativeElement.textContent as string;
  const cartoes = () => fixture.debugElement.queryAll(By.css('.cartao-abrir'));
  const acoes = () => fixture.debugElement.queryAll(By.css('.acao'));

  it('mostra as cinco colunas, com os cartões na coluna da etapa', () => {
    const nomes = fixture.debugElement
      .queryAll(By.css('.coluna-topo .n'))
      .map((n) => n.nativeElement.textContent.trim());
    expect(nomes).toEqual(['Oportunidade', 'Cotação', 'Proposta', 'Disputa', 'Empenho']);

    expect(cartoes()).toHaveLength(2);
    expect(texto()).toContain('UASG 985412 · Araraquara/SP');
    expect(texto()).toContain('salva há 3 dias, sem cotação');
    expect(texto()).toContain('iniciar a cotação para saber se dá');
  });

  it('etapa sem tela aparece vazia, avisando que ainda não está disponível', () => {
    expect(fixture.debugElement.queryAll(By.css('.coluna.indisponivel'))).toHaveLength(3);
    expect(texto()).toContain('Ainda não disponível.');
  });

  it('resumo do dia com a borda pelo nível: verde quando zerado, amarelo quando pede atenção', () => {
    expect(texto()).toContain('salvas há mais de 2 dias sem cotação');
    const niveis = fixture.debugElement
      .queryAll(By.css('.indicador:not(.pequeno)'))
      .map((i) => i.nativeElement.getAttribute('data-nivel'));
    expect(niveis).toEqual(['ok', 'aviso', 'aviso', 'ok']);
  });

  it('as encerradas viram dois cards menores no fim do resumo, e não rodapé', () => {
    const pequenos = fixture.debugElement.queryAll(By.css('.indicador.pequeno'));
    expect(pequenos).toHaveLength(2);
    expect(pequenos[0].nativeElement.textContent).toContain('3');
    expect(pequenos[0].nativeElement.textContent).toContain('vencidas');
    // Embaixo do quadro, não junto do resumo do dia.
    expect(pequenos[0].parent?.nativeElement.classList).toContain('encerradas');
    expect(fixture.debugElement.query(By.css('.rodape'))).toBeNull();
  });

  it('o cartão mostra o que falta, no máximo três, e o resto vira "+N"', () => {
    const faltas = fixture.debugElement
      .queryAll(By.css('.cartao'))[1]
      .queryAll(By.css('.falta li'))
      .map((li) => li.nativeElement.textContent.trim());
    expect(faltas).toEqual([
      'item 3: reserva acima do estimado',
      'preço de fornecedor nos itens 4 e 5',
      'item 6: preço acima do estimado',
      '+1',
    ]);
  });

  it('"Iniciar cotação" na Oportunidade abre o Cotador com os itens do edital', () => {
    acoes()[0].nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(
      CotadorModalComponent,
      expect.objectContaining({ oportunidadeId: 7, itens: [{ numero_item: 1 }] }),
    );
  });

  it('"Iniciar cotação" dentro do visualizador também abre o Cotador', () => {
    cartoes()[0].nativeElement.click();
    fechou.next('cotar');

    expect(modal.abrir).toHaveBeenLastCalledWith(
      CotadorModalComponent,
      expect.objectContaining({ oportunidadeId: 7 }),
    );
  });

  it('"Gerar proposta" aparece na Cotação, desabilitado até a tela existir', () => {
    const gerar = acoes()[1];
    expect(gerar.nativeElement.textContent).toContain('Gerar proposta');
    expect(gerar.nativeElement.disabled).toBe(true);
  });

  it('cartão em Oportunidade abre o visualizador da oportunidade salva, não o Cotador', () => {
    cartoes()[0].nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(OportunidadeModalComponent, CARTAO.salva);
  });

  it('"Buscar" leva para a busca de oportunidades', () => {
    const buscar = fixture.debugElement.query(By.css('.btn-buscar'));
    expect(buscar.nativeElement.getAttribute('href')).toBe('/oportunidades/buscar');
  });

  it('cartão em cotação abre o Cotador da oportunidade — o mesmo das Salvas', () => {
    cartoes()[1].nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(
      CotadorModalComponent,
      expect.objectContaining({ oportunidadeId: 9 }),
    );
  });

  it('fechar o Cotador (salvando ou não) recarrega o quadro', () => {
    cartoes()[1].nativeElement.click();
    expect(ciclo.quadro).toHaveBeenCalledTimes(1);

    fechou.next(undefined);
    fechou.complete();

    expect(ciclo.quadro).toHaveBeenCalledTimes(2);
  });

  it('falha ao carregar mostra o erro com "tentar de novo"', () => {
    ciclo.quadro.mockReturnValue(throwError(() => new Error('500')));
    fixture = TestBed.createComponent(QuadroPage);
    fixture.detectChanges();

    expect(texto()).toContain('Não foi possível carregar o quadro agora.');
  });

  it('formatarMil resume o valor da coluna', () => {
    expect(formatarMil(214_000)).toBe('R$ 214 mil');
    expect(formatarMil(1_250_000)).toBe('R$ 1,3 mi');
  });

  const lixeiras = () => fixture.debugElement.queryAll(By.css('.acao-excluir'));

  it('excluir a cotação apaga só a cotação — a licitação volta para Oportunidade', () => {
    lixeiras()[1].nativeElement.click();

    expect(cotador.remover).toHaveBeenCalledWith(15);
    expect(salvas.remover).not.toHaveBeenCalled();
    expect(ciclo.quadro).toHaveBeenCalledTimes(2);
  });

  it('excluir a oportunidade tira a salva do ciclo', () => {
    lixeiras()[0].nativeElement.click();

    expect(salvas.remover).toHaveBeenCalledWith(7);
    expect(cotador.remover).not.toHaveBeenCalled();
  });

  it('recusar a confirmação não apaga nada', () => {
    modal.confirmar.mockReturnValue(of(false));

    lixeiras()[1].nativeElement.click();

    expect(cotador.remover).not.toHaveBeenCalled();
  });
});
