import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';
import { DetalheEstado, EditalCard } from '../oportunidades.page';
import { EditalCardComponent } from './edital-card.component';

// Construído com componentes locais (não uma string ISO) pra não depender
// do fuso horário de quem roda o teste — ver o mesmo cuidado em `parseData`.
const HOJE = new Date(2026, 7, 27);

const OPORTUNIDADE: OportunidadeResponse = {
  numero_item: '1',
  descricao_resumida: 'Locação de máquina de café expresso',
  descricao_detalhada: null,
  quantidade: 4,
  unidade_medida: 'Diária',
  valor_unitario_estimado: 2370,
  valor_total: 9480,
  tipo_beneficio: null,
  criterio_julgamento: 'Menor preço',
  contratacao_uf: 'GO',
  contratacao_modalidade: 'Dispensa eletrônica',
  contratacao_srp: false,
  contratacao_situacao: 'Divulgada no PNCP',
  situacao_item: null,
  contratacao_data_publicacao: '2026-08-26',
  contratacao_data_encerramento_proposta: '2026-09-01',
  contratacao_orgao_nome: 'Prefeitura Municipal de Rio Verde',
  contratacao_municipio: 'Rio Verde',
  contratacao_uasg: '989571',
  contratacao_objeto: 'LOCAÇÃO DE 01 MÁQUINA PARA CAFÉ EXPRESSO PARA O ESTANDE EM GO, UASG 989571',
  contratacao_cnpj_orgao: '12345678000199',
  contratacao_ano_compra: '2026',
  contratacao_sequencial_compra: '1',
  link_compras_gov: 'https://compras.gov.br/x',
  link_pncp: 'https://pncp.gov.br/app/editais/12345678000199/2026/1',
};

function montarCard(itens: readonly OportunidadeResponse[] = [OPORTUNIDADE]): EditalCard {
  return { chave: 'edital-1', contratacao: itens[0], itens };
}

const DETALHE_CARREGADO: DetalheEstado = {
  carregando: false,
  erro: false,
  capag: { nota: 'B', cor: 'amarelo' },
  documentos: [
    {
      titulo: 'Aviso de dispensa.pdf',
      tipo_documento: 'Aviso de Contratação Direta',
      url: 'https://pncp.gov.br/x/1',
    },
  ],
};

@Component({
  imports: [EditalCardComponent],
  template: `<app-edital-card
    [card]="card()"
    [detalhe]="detalhe()"
    (baixarEdital)="baixarEdital.set(true)"
  />`,
})
class HostComponent {
  readonly card = signal<EditalCard>(montarCard());
  readonly detalhe = signal<DetalheEstado | undefined>(undefined);
  readonly baixarEdital = signal(false);
}

describe('EditalCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(HOJE);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function texto(): string {
    return fixture.debugElement.nativeElement.textContent;
  }

  function clicarBotao(seletor: string): void {
    fixture.debugElement.query(By.css(seletor)).nativeElement.click();
    fixture.detectChanges();
  }

  it('normaliza o objeto em CAIXA ALTA do PNCP pra sentence case, preservando siglas', () => {
    const titulo = fixture.debugElement.query(By.css('.titulo')).nativeElement.textContent;
    expect(titulo).toBe(
      'Locação de 01 máquina para café expresso para o estande em GO, UASG 989571',
    );
  });

  it('mostra os dados do edital, com o valor estimado somado dos itens', () => {
    expect(texto()).toContain('Rio Verde / GO');
    expect(texto()).toContain('Dispensa eletrônica');
    expect(texto()).toContain('R$ 9.480,00');
  });

  it('aba "Itens" é a padrão, com a tabela desktop e os cartões mobile preenchidos', () => {
    expect(
      fixture.debugElement.query(By.css('.aba.aba-ativa')).nativeElement.textContent,
    ).toContain('Itens');
    expect(fixture.debugElement.query(By.css('.tabela-linha')).nativeElement.textContent).toContain(
      'Locação de máquina de café expresso',
    );
  });

  it('clicar em "Documentos" troca de painel', () => {
    host.detalhe.set(DETALHE_CARREGADO);
    fixture.detectChanges();

    clicarBotao('.aba:nth-child(2)');

    expect(fixture.debugElement.query(By.css('.painel-documentos'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.painel-itens'))).toBeNull();
    expect(texto()).toContain('Aviso de dispensa.pdf');
  });

  it('painel "Documentos" mostra carregando/erro/vazio conforme o detalhe', () => {
    host.detalhe.set({ carregando: true, erro: false, capag: null, documentos: [] });
    fixture.detectChanges();
    clicarBotao('.aba:nth-child(2)');
    expect(texto()).toContain('Buscando os documentos no PNCP');

    host.detalhe.set({ carregando: false, erro: true, capag: null, documentos: [] });
    fixture.detectChanges();
    expect(texto()).toContain('Não foi possível buscar os documentos agora');

    host.detalhe.set({ carregando: false, erro: false, capag: null, documentos: [] });
    fixture.detectChanges();
    expect(texto()).toContain('Nenhum documento informado');
  });

  it('selo CAPAG aparece com a cor certa quando carrega, e "CAPAG…" enquanto isso', () => {
    host.detalhe.set({ carregando: true, erro: false, capag: null, documentos: [] });
    fixture.detectChanges();
    expect(texto()).toContain('CAPAG…');

    host.detalhe.set(DETALHE_CARREGADO);
    fixture.detectChanges();
    const selo = fixture.debugElement.query(By.css('.selo-capag'));
    expect(selo.nativeElement.textContent).toContain('CAPAG B');
    expect(selo.nativeElement.className).toContain('capag-amarelo');
  });

  it('"Baixar edital" só aparece quando há documento, e avisa o pai ao clicar', () => {
    expect(fixture.debugElement.query(By.css('.btn-baixar'))).toBeNull();

    host.detalhe.set(DETALHE_CARREGADO);
    fixture.detectChanges();

    clicarBotao('.btn-baixar');
    expect(host.baixarEdital()).toBe(true);
  });

  it('"Selecionar licitação" alterna pro estado selecionado e "Remover da seleção" volta', () => {
    expect(texto()).toContain('Selecionar licitação');

    clicarBotao('.btn-selecionar');
    expect(texto()).toContain('Licitação selecionada');

    clicarBotao('.link-remover');
    expect(texto()).toContain('Selecionar licitação');
  });

  it('licitação encerrada esconde o botão de selecionar e mostra "Encerrada"', () => {
    host.card.set(
      montarCard([{ ...OPORTUNIDADE, contratacao_data_encerramento_proposta: '2026-08-01' }]),
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.btn-selecionar'))).toBeNull();
    expect(texto()).toContain('Encerrada');
  });
});
