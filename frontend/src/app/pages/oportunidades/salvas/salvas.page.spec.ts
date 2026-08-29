import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { OportunidadeSalvaResponse } from '../../../contracts/licitacoes/oportunidade-salva.contracts';
import { OportunidadesSalvasService } from '../../../services/licitacoes/oportunidades-salvas.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { OportunidadeModalComponent } from './oportunidade-modal/oportunidade-modal.component';
import { SalvasPage } from './salvas.page';

const SALVA: OportunidadeSalvaResponse = {
  id: 1,
  chave: '12345678000199-2026-42',
  cnpj_orgao: '12345678000199',
  ano_compra: '2026',
  sequencial_compra: '42',
  objeto: 'Aquisição de café e açúcar',
  orgao_nome: 'Prefeitura de Campinas',
  uasg: '925997',
  uf: 'SP',
  municipio: 'Campinas',
  modalidade: 'Pregão Eletrônico',
  situacao: 'Divulgada no PNCP',
  data_publicacao: '2026-08-20',
  data_encerramento_proposta: '2026-09-10',
  valor_total_estimado: 1850,
  plataforma_id: 'compras_gov',
  plataforma_nome: '',
  link_plataforma: 'https://compras.gov.br/compra/1',
  link_pncp: 'https://pncp.gov.br/app/editais/12345678000199/2026/42',
  capag: null,
  itens: [],
  expirada: false,
  salva_por: 'Gustavo',
  criada_em: '2026-08-25T12:00:00Z',
};

const VENCIDA: OportunidadeSalvaResponse = {
  ...SALVA,
  id: 2,
  chave: '12345678000199-2026-43',
  sequencial_compra: '43',
  objeto: 'Serviço de limpeza predial',
  data_encerramento_proposta: '2026-08-01',
  expirada: true,
};

function pagina(results: OportunidadeSalvaResponse[], expiradas = 0) {
  return { count: results.length, next: null, previous: null, expiradas, results };
}

describe('SalvasPage', () => {
  let fixture: ComponentFixture<SalvasPage>;
  let service: {
    listar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
    removerExpiradas: ReturnType<typeof vi.fn>;
  };
  let modal: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let toast: {
    sucesso: ReturnType<typeof vi.fn>;
    erro: ReturnType<typeof vi.fn>;
    alerta: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of(pagina([SALVA, VENCIDA]))),
      remover: vi.fn(() => of(undefined)),
      removerExpiradas: vi.fn(() => of({ removidas: 1 })),
    };
    modal = { confirmar: vi.fn(() => of(true)), abrir: vi.fn(() => of(undefined)) };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SalvasPage],
      providers: [
        { provide: OportunidadesSalvasService, useValue: service },
        { provide: ModalService, useValue: modal },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(SalvasPage);
    fixture.detectChanges();
  });

  function linhas() {
    return fixture.debugElement.queryAll(By.css('tbody tr'));
  }

  function acoesDaLinha(indice: number) {
    return linhas()[indice].queryAll(By.css('app-button'));
  }

  it('carrega a lista ao abrir, mais recentes primeiro', () => {
    expect(service.listar).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      ordering: '-criada_em',
      busca: '',
    });
    expect(linhas()).toHaveLength(2);
  });

  it('mostra os campos da tabela já formatados', () => {
    const celulas = linhas()[0]
      .queryAll(By.css('td'))
      .map((td) => td.nativeElement.textContent.trim());

    expect(celulas[0]).toBe('Aquisição de café e açúcar');
    // Plataforma pelo id registrado, mesmo nome que o card da busca usa.
    expect(celulas[1]).toBe('Compras.gov.br');
    expect(celulas[2]).toBe('Pregão Eletrônico');
    expect(celulas[3]).toBe('Campinas / SP');
    expect(celulas[4]).toBe('20/08/2026');
    expect(celulas[5]).toBe('10/09/2026');
    expect(celulas[6]).toBe('R$ 1.850,00');
  });

  it('a que perdeu o prazo fica destacada, com o prazo em vermelho', () => {
    expect(linhas()[1].classes['destacada']).toBe(true);
    expect(linhas()[0].classes['destacada']).toBeFalsy();
    expect(linhas()[1].queryAll(By.css('td'))[5].nativeElement.className).toContain(
      'celula-perigo',
    );
  });

  it('visualizar abre o modal com a oportunidade salva', () => {
    acoesDaLinha(0)[0].nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(OportunidadeModalComponent, SALVA);
  });

  it('excluir avisa que a ação não pode ser desfeita e só exclui se confirmado', () => {
    acoesDaLinha(0)[1].nativeElement.click();

    expect(modal.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ mensagem: expect.stringContaining('não poderá ser desfeita') }),
    );
    expect(service.remover).toHaveBeenCalledWith(1);
    expect(toast.sucesso).toHaveBeenCalled();
    // Recarrega a lista depois de excluir.
    expect(service.listar).toHaveBeenCalledTimes(2);
  });

  it('excluir cancelado não chama o serviço', () => {
    modal.confirmar.mockReturnValue(of(false));

    acoesDaLinha(0)[1].nativeElement.click();

    expect(service.remover).not.toHaveBeenCalled();
  });

  it('falha ao excluir avisa e não some com a linha', () => {
    service.remover.mockReturnValue(throwError(() => new Error('falhou')));

    acoesDaLinha(0)[1].nativeElement.click();

    expect(toast.erro).toHaveBeenCalled();
    expect(linhas()).toHaveLength(2);
  });

  it('avisa em toast amarelo quantas perderam o prazo, com link pra apagar', () => {
    expect(toast.alerta).not.toHaveBeenCalled(); // a carga inicial não tinha expiradas

    service.listar.mockReturnValue(of(pagina([SALVA, VENCIDA], 3)));
    fixture = TestBed.createComponent(SalvasPage);
    fixture.detectChanges();

    expect(toast.alerta).toHaveBeenCalledWith(
      '3 oportunidades salvas não têm mais prazo para gerar proposta.',
      expect.objectContaining({ acao: expect.objectContaining({ rotulo: 'Apagar as vencidas' }) }),
    );

    // O link do toast também confirma antes de apagar em lote.
    toast.alerta.mock.calls[0][1].acao.executar();
    expect(modal.confirmar).toHaveBeenCalled();
    expect(service.removerExpiradas).toHaveBeenCalled();
  });

  it('não repete o aviso a cada consulta enquanto o número não muda', () => {
    service.listar.mockReturnValue(of(pagina([VENCIDA], 1)));
    fixture = TestBed.createComponent(SalvasPage);
    fixture.detectChanges();
    expect(toast.alerta).toHaveBeenCalledTimes(1);
    service.listar.mockClear();

    // Ordenar por uma coluna refaz a consulta — sem novo aviso.
    fixture.debugElement.queryAll(By.css('thead th .ordenar'))[0].nativeElement.click();
    fixture.detectChanges();

    expect(service.listar).toHaveBeenCalledTimes(1);
    expect(toast.alerta).toHaveBeenCalledTimes(1);
  });

  it('ordenar por uma coluna refaz a consulta com o `ordering` do backend', () => {
    fixture.debugElement.queryAll(By.css('thead th .ordenar'))[0].nativeElement.click();

    expect(service.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ ordering: 'descricao', page: 1 }),
    );
  });

  it('erro ao carregar mostra a mensagem e esvazia a tabela', () => {
    service.listar.mockReturnValue(throwError(() => new Error('falhou')));
    fixture = TestBed.createComponent(SalvasPage);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.erro')).nativeElement.textContent).toContain(
      'Não foi possível carregar',
    );
    expect(linhas()).toHaveLength(1); // a linha de "nenhum registro"
  });
});
