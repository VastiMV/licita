import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CartaoCiclo, QuadroCiclo } from '../../../contracts/licitacoes/ciclo.contracts';
import { CicloService } from '../../../services/licitacoes/ciclo.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { CotadorModalComponent } from '../../oportunidades/cotador-modal/cotador-modal.component';
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
  falta: 'cotar para saber se dá',
  itens: [],
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
  falta: 'gerar a proposta',
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
    encerradas: 3,
    dias_sem_cotacao: 2,
  };
}

describe('QuadroPage', () => {
  let fixture: ComponentFixture<QuadroPage>;
  let ciclo: { quadro: ReturnType<typeof vi.fn> };
  let modal: { abrir: ReturnType<typeof vi.fn> };
  let fechou: Subject<unknown>;

  beforeEach(() => {
    fechou = new Subject();
    ciclo = { quadro: vi.fn(() => of(quadro())) };
    modal = { abrir: vi.fn(() => fechou) };
    TestBed.configureTestingModule({
      imports: [QuadroPage],
      providers: [
        provideRouter([]),
        { provide: CicloService, useValue: ciclo },
        { provide: ModalService, useValue: modal },
      ],
    });
    fixture = TestBed.createComponent(QuadroPage);
    fixture.detectChanges();
  });

  const texto = () => fixture.nativeElement.textContent as string;
  const cartoes = () => fixture.debugElement.queryAll(By.css('.cartao'));

  it('mostra as cinco colunas, com os cartões na coluna da etapa', () => {
    const nomes = fixture.debugElement
      .queryAll(By.css('.coluna-topo .n'))
      .map((n) => n.nativeElement.textContent.trim());
    expect(nomes).toEqual(['Oportunidade', 'Cotação', 'Proposta', 'Disputa', 'Empenho']);

    expect(cartoes()).toHaveLength(2);
    expect(texto()).toContain('UASG 985412 · Araraquara/SP');
    expect(texto()).toContain('salva há 3 dias, sem cotação');
    expect(texto()).toContain('cotar para saber se dá');
  });

  it('etapa sem tela aparece vazia, avisando que ainda não está disponível', () => {
    expect(fixture.debugElement.queryAll(By.css('.coluna.indisponivel'))).toHaveLength(3);
    expect(texto()).toContain('Ainda não disponível.');
  });

  it('mostra o resumo do dia e quantas ficaram em Encerradas', () => {
    expect(texto()).toContain('salvas há mais de 2 dias sem cotação');
    expect(texto()).toContain('Fora do quadro, em Encerradas: 3');
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
});
