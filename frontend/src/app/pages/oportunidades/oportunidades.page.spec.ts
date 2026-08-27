import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';

import {
  CompraDetalheResponse,
  OportunidadeResponse,
} from '../../contracts/licitacoes/oportunidade.contracts';
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
  contratacao_cnpj_orgao: '12345678000199',
  contratacao_ano_compra: '2026',
  contratacao_sequencial_compra: '5',
  link_compras_gov: 'https://compras.gov.br/x',
  link_pncp: 'https://pncp.gov.br/app/editais/12345678000199/2026/5',
};

// Segundo item do MESMO edital — casa por cnpj+ano+sequencial (ver
// `chaveEdital` em oportunidades.page.ts).
const OPORTUNIDADE_2: OportunidadeResponse = {
  ...OPORTUNIDADE,
  numero_item: '13',
  descricao_resumida: 'Mouse óptico USB',
};

const DETALHE: CompraDetalheResponse = {
  documentos: [{ titulo: 'Edital.pdf', tipo_documento: 'Edital', url: 'https://pncp.gov.br/x/1' }],
  capag: { nota: 'A', cor: 'verde' },
};

// Ações do card (Baixar edital / Ver itens / Site oficial) são segmentos de
// `.edital-navtab`, não `app-button` — ver oportunidades.page.html.
function botaoDoCard(fixture: ComponentFixture<OportunidadesPage>, texto: string): HTMLButtonElement {
  return fixture.debugElement
    .queryAll(By.css('.edital-navtab-item'))
    .find((el) => el.nativeElement.textContent.includes(texto))!.nativeElement;
}

describe('OportunidadesPage', () => {
  let fixture: ComponentFixture<OportunidadesPage>;
  let licitacoes: {
    buscarOportunidades: ReturnType<typeof vi.fn>;
    detalharCompra: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    licitacoes = { buscarOportunidades: vi.fn(), detalharCompra: vi.fn(() => of(DETALHE)) };
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

  it('em sucesso, lista 1 card por edital com órgão/objeto visíveis', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));

    buscar();

    const card = fixture.debugElement.query(By.css('.edital-card'));
    expect(card.nativeElement.textContent).toContain('Prefeitura Municipal de Campinas');
    expect(card.nativeElement.textContent).toContain('Aquisição de equipamentos de informática');
    const siteOficial = fixture.debugElement.query(By.css('.edital-navtab-item--link'));
    expect(siteOficial.nativeElement.getAttribute('href')).toBe(
      'https://pncp.gov.br/app/editais/12345678000199/2026/5',
    );
  });

  it('itens do mesmo edital (mesmo cnpj+ano+sequencial) agrupam num card só', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE, OPORTUNIDADE_2]));

    buscar();

    expect(fixture.debugElement.queryAll(By.css('.edital-card')).length).toBe(1);
    expect(fixture.debugElement.nativeElement.textContent).toContain('Ver itens (2)');
  });

  it('"Ver itens" expande a tabela de itens já carregada, sem novo request', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    buscar();

    expect(fixture.debugElement.query(By.css('.edital-tabela-itens'))).toBeNull();

    botaoDoCard(fixture, 'Ver itens').click();
    fixture.detectChanges();

    const tabela = fixture.debugElement.query(By.css('.edital-tabela-itens'));
    expect(tabela.nativeElement.textContent).toContain('Notebook Intel i5 8GB 256GB SSD');
    // "Ver itens" não busca nada — só o request automático de documentos rodou.
    expect(licitacoes.detalharCompra).toHaveBeenCalledTimes(1);
  });

  it('busca documentos + CAPAG automaticamente, sem precisar clicar em nada', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    buscar();

    expect(licitacoes.detalharCompra).toHaveBeenCalledWith('12345678000199', '2026', '5');
    const selo = fixture.debugElement.query(By.css('.capag-selo'));
    expect(selo.nativeElement.textContent).toContain('A');
    expect(selo.nativeElement.className).toContain('capag-verde');
    const doc = fixture.debugElement.query(By.css('.edital-tabela-documentos .edital-tabela-abrir'));
    expect(doc.nativeElement.getAttribute('href')).toBe('https://pncp.gov.br/x/1');
  });

  it('"Baixar edital" abre o primeiro documento numa aba nova, só depois de carregado', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    const abrirSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    buscar();

    botaoDoCard(fixture, 'Baixar edital').click();

    expect(abrirSpy).toHaveBeenCalledWith('https://pncp.gov.br/x/1', '_blank', 'noopener');
  });

  it('"Baixar edital" fica desabilitado enquanto os documentos não chegam', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    licitacoes.detalharCompra.mockReturnValue(new Subject()); // nunca resolve
    buscar();

    expect(botaoDoCard(fixture, 'Baixar edital').disabled).toBe(true);
  });

  it('falha ao buscar documentos mostra mensagem de erro, sem derrubar a tela', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    licitacoes.detalharCompra.mockReturnValue(throwError(() => new Error('falhou')));
    buscar();

    expect(fixture.debugElement.query(By.css('.edital-documentos-status.erro')).nativeElement.textContent).toContain(
      'Não foi possível buscar os documentos',
    );
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

  it('enquanto busca, mostra o overlay de carregamento com o aviso de demora', () => {
    licitacoes.buscarOportunidades.mockReturnValue(new Subject()); // nunca emite — fica "buscando" pra sempre

    buscar();

    const overlay = fixture.debugElement.query(By.css('.loading-overlay'));
    expect(overlay).not.toBeNull();
    expect(overlay.nativeElement.textContent).toContain('Acessando servidores gov.br');
  });

  it('"Cancelar busca" desfaz a inscrição (aborta a requisição) e esconde o overlay', () => {
    const chamada = new Subject<OportunidadeResponse[]>();
    licitacoes.buscarOportunidades.mockReturnValue(chamada);

    buscar();
    fixture.debugElement.query(By.css('.loading-cancelar')).triggerEventHandler('click');
    fixture.detectChanges();

    expect(chamada.observed).toBe(false); // ninguém mais escutando -> unsubscribe aconteceu de verdade
    expect(fixture.debugElement.query(By.css('.loading-overlay'))).toBeNull();
  });

  it('"Limpar" volta a tela ao estado inicial', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    buscar();
    expect(fixture.debugElement.query(By.css('.edital-card'))).not.toBeNull();

    fixture.debugElement
      .queryAll(By.css('app-button'))
      .find((el) => el.nativeElement.textContent.includes('Limpar'))!
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.oportunidades'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.erro'))).toBeNull();
    expect(fixture.debugElement.nativeElement.textContent).not.toContain('Nenhum item encontrado');
  });
});
