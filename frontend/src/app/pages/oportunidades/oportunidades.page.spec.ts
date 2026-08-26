import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { OportunidadeResponse } from '../../contracts/licitacoes/oportunidade.contracts';
import { LicitacoesService } from '../../services/licitacoes/licitacoes.service';
import { OportunidadesPage } from './oportunidades.page';

const OPORTUNIDADE: OportunidadeResponse = {
  numero_item: '12',
  descricao_resumida: 'Notebook Intel i5 8GB 256GB SSD',
  descricao_detalhada: null,
  quantidade: 50,
  unidade_medida: 'UN',
  valor_unitario_estimado: 3200,
  valor_total: 160000,
  tipo_beneficio: null,
  contratacao_uf: 'SP',
  contratacao_modalidade: 'Pregão - Eletrônico',
  contratacao_srp: true,
  contratacao_situacao: null,
  situacao_item: 'Em andamento',
  contratacao_data_publicacao: null,
  contratacao_data_encerramento_proposta: '30/08/2026',
  contratacao_orgao_nome: 'Prefeitura Municipal de Campinas',
  contratacao_municipio: 'Campinas',
  contratacao_uasg: '925123',
  contratacao_objeto: 'Aquisição de equipamentos de informática',
  link_compras_gov: 'https://compras.gov.br/x',
  link_pncp: null,
};

describe('OportunidadesPage', () => {
  let fixture: ComponentFixture<OportunidadesPage>;
  let licitacoes: { buscarOportunidades: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    licitacoes = { buscarOportunidades: vi.fn() };
    TestBed.configureTestingModule({
      imports: [OportunidadesPage],
      providers: [{ provide: LicitacoesService, useValue: licitacoes }],
    });
    fixture = TestBed.createComponent(OportunidadesPage);
    fixture.detectChanges();
  });

  function buscar(): void {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    fixture.detectChanges();
  }

  it('antes de qualquer busca, não mostra mensagem de resultado', () => {
    expect(fixture.debugElement.query(By.css('.oportunidades'))).toBeNull();
  });

  it('em sucesso, lista os resultados com os dados do item', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));

    buscar();

    const card = fixture.debugElement.query(By.css('.oportunidade-card'));
    expect(card.nativeElement.textContent).toContain('Notebook Intel i5 8GB 256GB SSD');
    expect(card.nativeElement.getAttribute('href')).toBe('https://compras.gov.br/x');
  });

  it('sem resultados, mostra mensagem de nada encontrado', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([]));

    buscar();

    expect(fixture.debugElement.query(By.css('.oportunidades'))).toBeNull();
    expect(fixture.debugElement.nativeElement.textContent).toContain('Nenhum item encontrado');
  });

  it('em erro, mostra a mensagem de erro e não lista resultados', () => {
    licitacoes.buscarOportunidades.mockReturnValue(throwError(() => new Error('falhou')));

    buscar();

    expect(fixture.debugElement.query(By.css('.erro')).nativeElement.textContent).toContain(
      'Não foi possível buscar agora',
    );
    expect(fixture.debugElement.query(By.css('.oportunidades'))).toBeNull();
  });
});
