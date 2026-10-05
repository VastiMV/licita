import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { EmPropostaResponse } from '../../../contracts/propostas/proposta.contracts';
import { PropostasService } from '../../../services/propostas/propostas.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { CotadorModalComponent } from '../../oportunidades/cotador-modal/cotador-modal.component';
import { PropostasPage } from './propostas.page';
import { PropostaModalComponent } from './proposta-modal/proposta-modal.component';

const LINHA: EmPropostaResponse = {
  id: 4,
  chave: '95422986000102-2026-222',
  cnpj_orgao: '95422986000102',
  ano_compra: '2026',
  sequencial_compra: '222',
  objeto: 'Equipamentos médico hospitalares',
  orgao_nome: 'Prefeitura de Fazenda Rio Grande',
  uasg: '989983',
  uf: 'PR',
  municipio: 'Fazenda Rio Grande',
  modalidade: 'Pregão Eletrônico',
  situacao: 'Divulgada no PNCP',
  data_publicacao: '2026-08-20',
  data_encerramento_proposta: '2026-10-14',
  valor_total_estimado: 400000,
  plataforma_id: 'compras_gov',
  plataforma_nome: 'Compras.gov.br',
  link_plataforma: '',
  link_pncp: '',
  capag: null,
  itens: [],
  expirada: false,
  salva_por: 'Vasti',
  criada_em: '2026-08-31T12:00:00Z',
  proposta: {
    id: 8,
    oportunidade_id: 4,
    valor: 351296.23,
    validade_dias: 60,
    empresa: null,
    gerada_por: 'Vasti',
    gerada_em: '2026-10-01T12:00:00Z',
    arquivos: 0,
    documento_gerado: false,
  },
};

describe('PropostasPage', () => {
  let fixture: ComponentFixture<PropostasPage>;
  let service: { listar: ReturnType<typeof vi.fn> };
  let modal: { abrir: ReturnType<typeof vi.fn> };

  function montar() {
    TestBed.configureTestingModule({
      imports: [PropostasPage],
      providers: [
        { provide: PropostasService, useValue: service },
        { provide: ModalService, useValue: modal },
      ],
    });
    fixture = TestBed.createComponent(PropostasPage);
    fixture.detectChanges();
  }

  function pagina() {
    return fixture.componentInstance as never as {
      acoesDe: (l: EmPropostaResponse) => { rotulo: string; executar: () => void }[];
    };
  }

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of({ count: 1, next: null, previous: null, results: [LINHA] })),
    };
    modal = { abrir: vi.fn(() => of(true)) };
  });

  it('lista com o prazo mais próximo primeiro e mostra o que falta', () => {
    montar();

    expect(service.listar.mock.calls[0][0].ordering).toBe('prazo');
    expect(fixture.debugElement.queryAll(By.css('tbody tr'))).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('gerar o Word');
  });

  it('abrir proposta abre o modal e recarrega se algo mudou', () => {
    montar();

    pagina().acoesDe(LINHA)[0].executar();

    expect(modal.abrir).toHaveBeenCalledWith(PropostaModalComponent, { propostaId: 8 });
    expect(service.listar).toHaveBeenCalledTimes(2);
  });

  it('ver cotação abre o Cotador só para leitura', () => {
    montar();

    pagina().acoesDe(LINHA)[1].executar();

    expect(modal.abrir.mock.calls[0][0]).toBe(CotadorModalComponent);
    expect(modal.abrir.mock.calls[0][1]).toEqual(
      expect.objectContaining({ oportunidadeId: 4, somenteLeitura: true }),
    );
  });

  it('erro ao carregar mostra a mensagem', () => {
    service.listar.mockReturnValue(throwError(() => new Error('falhou')));
    montar();

    expect(fixture.debugElement.query(By.css('.erro'))).not.toBeNull();
  });
});
