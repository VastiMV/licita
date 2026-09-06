import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';

import {
  CompraDetalheResponse,
  OportunidadeResponse,
} from '../../../contracts/licitacoes/oportunidade.contracts';
import { LicitacoesService } from '../../../services/licitacoes/licitacoes.service';
import { OportunidadesSalvasService } from '../../../services/licitacoes/oportunidades-salvas.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { CotadorModalComponent } from '../cotador-modal/cotador-modal.component';
import { formatarBr, hojeIso, somarDias } from '../../../shared/ui/date-picker/date-picker.utils';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PesquisarPage } from './pesquisar.page';

const OPORTUNIDADE: OportunidadeResponse = {
  numero_item: '12',
  descricao_resumida: 'Notebook Intel i5 8GB 256GB SSD',
  descricao_detalhada: null,
  quantidade: 50,
  unidade_medida: 'UN',
  valor_unitario_estimado: 3200,
  valor_total: 160000,
  tipo_beneficio: null,
  criterio_julgamento: 'Menor preço',
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
  plataforma_id: 'compras_gov',
  link_plataforma:
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=92512305000052026',
  link_pncp: 'https://pncp.gov.br/app/editais/12345678000199/2026/5',
  capag: null,
};

// Segundo item do MESMO edital — casa por cnpj+ano+sequencial (ver
// `chaveEdital` em edital-card/edital-card.model.ts).
const OPORTUNIDADE_2: OportunidadeResponse = {
  ...OPORTUNIDADE,
  numero_item: '13',
  descricao_resumida: 'Mouse óptico USB',
};

// Prazo lá na frente: os testes de salvar dependem do botão existir, e o
// card esconde "Salvar" em oportunidade encerrada (data fixa venceria).
const OPORTUNIDADE_ABERTA: OportunidadeResponse = {
  ...OPORTUNIDADE,
  contratacao_data_encerramento_proposta: '31/12/2099',
};

const OPORTUNIDADE_ABERTA_2: OportunidadeResponse = {
  ...OPORTUNIDADE_2,
  contratacao_data_encerramento_proposta: '31/12/2099',
};

const DETALHE: CompraDetalheResponse = {
  documentos: [{ titulo: 'Edital.pdf', tipo_documento: 'Edital', url: 'https://pncp.gov.br/x/1' }],
  capag: { nota: 'A', cor: 'verde' },
  plataforma: {
    id: 'compras_gov',
    nome: 'Compras.gov.br',
    link: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/landing?destino=acompanhamento-compra&compra=92512305000052026',
  },
};

describe('PesquisarPage', () => {
  let fixture: ComponentFixture<PesquisarPage>;
  let licitacoes: {
    buscarOportunidades: ReturnType<typeof vi.fn>;
    detalharCompra: ReturnType<typeof vi.fn>;
  };
  let salvas: { chaves: ReturnType<typeof vi.fn>; salvar: ReturnType<typeof vi.fn> };
  let modal: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let toast: { sucesso: ReturnType<typeof vi.fn>; erro: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    licitacoes = { buscarOportunidades: vi.fn(), detalharCompra: vi.fn(() => of(DETALHE)) };
    salvas = { chaves: vi.fn(() => of([])), salvar: vi.fn(() => of({})) };
    modal = { confirmar: vi.fn(() => of(true)), abrir: vi.fn(() => of(undefined)) };
    toast = { sucesso: vi.fn(), erro: vi.fn() };

    TestBed.configureTestingModule({
      imports: [PesquisarPage],
      providers: [
        { provide: LicitacoesService, useValue: licitacoes },
        { provide: OportunidadesSalvasService, useValue: salvas },
        { provide: ModalService, useValue: modal },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(PesquisarPage);
    fixture.detectChanges();
  });

  function buscar(): void {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    fixture.detectChanges();
  }

  it('antes de qualquer busca, não mostra mensagem de resultado', () => {
    expect(fixture.debugElement.query(By.css('.oportunidades'))).toBeNull();
  });

  it('abre com a janela da última semana já preenchida, não em branco', () => {
    const campos = fixture.debugElement.queryAll(By.css('app-date-picker input'));

    expect(campos[0].nativeElement.value).toBe(formatarBr(somarDias(hojeIso(), -7)));
    expect(campos[1].nativeElement.value).toBe(formatarBr(hojeIso()));
  });

  it('manda a janela preenchida na busca, sem o usuário digitar data', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([]));

    buscar();

    expect(licitacoes.buscarOportunidades).toHaveBeenCalledWith(
      expect.objectContaining({
        data_inicial: somarDias(hojeIso(), -7),
        data_final: hojeIso(),
      }),
    );
  });

  it('UF é um select das 27 unidades federativas, começando em "Todas"', () => {
    const uf = fixture.debugElement
      .queryAll(By.css('app-select'))
      .find((el) => el.nativeElement.textContent.includes('UF'))!;
    const options = uf.queryAll(By.css('option'));

    expect(options).toHaveLength(28); // 27 UFs + "Todas"
    expect(options[0].nativeElement.textContent.trim()).toBe('Todas');
    expect(options[0].nativeElement.value).toBe('');
    expect(options.some((o) => o.nativeElement.value === 'SP')).toBe(true);
    expect(uf.query(By.css('select')).nativeElement.value).toBe('');
  });

  it('em sucesso, lista 1 card por edital com órgão/objeto visíveis', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));

    buscar();

    const card = fixture.debugElement.query(By.css('.edital-card'));
    expect(card.nativeElement.textContent).toContain('Prefeitura Municipal de Campinas');
    expect(card.nativeElement.textContent).toContain('Aquisição de equipamentos de informática');
    const linkPncp = fixture.debugElement.query(By.css('.link-pncp'));
    expect(linkPncp.nativeElement.getAttribute('href')).toBe(
      'https://pncp.gov.br/app/editais/12345678000199/2026/5',
    );
  });

  it('itens do mesmo edital (mesmo cnpj+ano+sequencial) agrupam num card só', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE, OPORTUNIDADE_2]));

    buscar();

    expect(fixture.debugElement.queryAll(By.css('.edital-card')).length).toBe(1);
    // Aba "Itens" já mostra os dois de cara — ver EditalCardComponent.
    expect(fixture.debugElement.nativeElement.textContent).toContain('Mouse óptico USB');
    expect(
      fixture.debugElement.query(By.css('.aba-contador')).nativeElement.textContent.trim(),
    ).toBe('2');
  });

  it('busca documentos + CAPAG automaticamente, sem precisar clicar em nada', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    buscar();

    expect(licitacoes.detalharCompra).toHaveBeenCalledWith('12345678000199', '2026', '5');
    const selo = fixture.debugElement.query(By.css('.selo-capag'));
    expect(selo.nativeElement.textContent).toContain('A');
    expect(selo.nativeElement.className).toContain('capag-verde');
  });

  it('"Baixar edital" abre o primeiro documento numa aba nova, só depois de carregado', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    const abrirSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    buscar();

    fixture.debugElement.query(By.css('.btn-baixar')).nativeElement.click();

    expect(abrirSpy).toHaveBeenCalledWith('https://pncp.gov.br/x/1', '_blank', 'noopener');
  });

  it('"Baixar edital" fica escondido enquanto os documentos não chegam (sem botão cinza)', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    licitacoes.detalharCompra.mockReturnValue(new Subject()); // nunca resolve
    buscar();

    expect(fixture.debugElement.query(By.css('.btn-baixar'))).toBeNull();
  });

  it('falha ao buscar documentos mostra mensagem de erro na aba Documentos, sem derrubar a tela', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE]));
    licitacoes.detalharCompra.mockReturnValue(throwError(() => new Error('falhou')));
    buscar();

    fixture.debugElement.queryAll(By.css('.aba'))[1].nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('.painel-status-erro')).nativeElement.textContent,
    ).toContain('Não foi possível buscar os documentos');
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
    // "Limpar" devolve a janela padrão, não deixa as datas vazias.
    const campos = fixture.debugElement.queryAll(By.css('app-date-picker input'));
    expect(campos[0].nativeElement.value).toBe(formatarBr(somarDias(hojeIso(), -7)));
  });
  it('salvar pede confirmação antes de persistir', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE_ABERTA]));
    modal.confirmar.mockReturnValue(of(false));
    buscar();

    fixture.debugElement.query(By.css('.btn-salvar')).nativeElement.click();
    fixture.detectChanges();

    expect(modal.confirmar).toHaveBeenCalled();
    expect(salvas.salvar).not.toHaveBeenCalled();
  });

  it('confirmado, salva o edital inteiro (itens + plataforma do detalhe) e avisa', () => {
    licitacoes.buscarOportunidades.mockReturnValue(
      of([OPORTUNIDADE_ABERTA, OPORTUNIDADE_ABERTA_2]),
    );
    buscar();

    fixture.debugElement.query(By.css('.btn-salvar')).nativeElement.click();
    fixture.detectChanges();

    expect(salvas.salvar).toHaveBeenCalledWith({
      itens: [OPORTUNIDADE_ABERTA, OPORTUNIDADE_ABERTA_2],
      capag: DETALHE.capag,
      plataforma: DETALHE.plataforma,
    });
    expect(toast.sucesso).toHaveBeenCalled();
    // Salvou: vira estado, não botão de desfazer (ver docs/DOMINIO.md).
    expect(fixture.debugElement.query(By.css('.btn-salvar'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.btn-salva'))).not.toBeNull();
  });

  it('"Cotar" abre o Cotador com os itens do edital, sem salvar nada antes', () => {
    licitacoes.buscarOportunidades.mockReturnValue(
      of([OPORTUNIDADE_ABERTA, OPORTUNIDADE_ABERTA_2]),
    );
    buscar();

    fixture.debugElement.query(By.css('.btn-cotar')).nativeElement.click();
    fixture.detectChanges();

    expect(modal.abrir).toHaveBeenCalledWith(
      CotadorModalComponent,
      expect.objectContaining({
        oportunidadeId: null,
        itens: [OPORTUNIDADE_ABERTA, OPORTUNIDADE_ABERTA_2],
        oportunidade: {
          itens: [OPORTUNIDADE_ABERTA, OPORTUNIDADE_ABERTA_2],
          capag: DETALHE.capag,
          plataforma: DETALHE.plataforma,
        },
      }),
    );
    // Abrir o Cotador não persiste: quem salva é o botão de dentro dele.
    expect(salvas.salvar).not.toHaveBeenCalled();
  });

  it('salvar a cotação marca o card como salvo — a oportunidade foi junto', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE_ABERTA]));
    modal.abrir.mockReturnValue(of({ cotacaoId: 1, oportunidadeCriada: true }));
    buscar();

    fixture.debugElement.query(By.css('.btn-cotar')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.btn-salvar'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.btn-salva'))).not.toBeNull();
  });

  it('fechar o Cotador sem salvar deixa o card como estava', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE_ABERTA]));
    buscar();

    fixture.debugElement.query(By.css('.btn-cotar')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.btn-salvar'))).not.toBeNull();
  });

  it('o que já está na lista de salvas abre marcado, sem botão de salvar', () => {
    salvas.chaves.mockReturnValue(of(['12345678000199-2026-5']));
    fixture = TestBed.createComponent(PesquisarPage);
    fixture.detectChanges();
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE_ABERTA]));
    buscar();

    expect(fixture.debugElement.query(By.css('.btn-salvar'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.btn-salva'))).not.toBeNull();
  });

  it('falha ao salvar avisa e mantém o botão disponível pra tentar de novo', () => {
    licitacoes.buscarOportunidades.mockReturnValue(of([OPORTUNIDADE_ABERTA]));
    salvas.salvar.mockReturnValue(throwError(() => new Error('falhou')));
    buscar();

    fixture.debugElement.query(By.css('.btn-salvar')).nativeElement.click();
    fixture.detectChanges();

    expect(toast.erro).toHaveBeenCalled();
    expect(fixture.debugElement.query(By.css('.btn-salvar'))).not.toBeNull();
  });
});
