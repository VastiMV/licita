import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import {
  DocumentoResponse,
  DocumentosResposta,
  TipoDocumento,
} from '../../../contracts/documentos/documento.contracts';
import { DocumentosService } from '../../../services/documentos/documentos.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { EmpresaResponse } from '../../../contracts/empresas/empresa.contracts';
import { DocumentosModalComponent } from './documentos-modal.component';

const BASE: DocumentoResponse = {
  id: 1,
  empresa: 7,
  tipo: 10,
  tipo_nome: 'Certificado de Regularidade do FGTS (CRF)',
  titulo: '',
  nome: 'Certificado de Regularidade do FGTS (CRF)',
  orgao_emissor: 'Caixa Econômica Federal',
  bloco: 'fiscal',
  bloco_label: 'Fiscal, social e trabalhista',
  exige_validade: true,
  link_emissor: 'https://consulta-crf.caixa.gov.br/',
  observacoes: '',
  situacao: 'a_vencer',
  situacao_label: 'Vence em 4 dias',
  validade: '2026-09-24',
  dias_para_vencer: 4,
  versao_atual: {
    id: 100,
    versao: 12,
    numero: '2026082501',
    emissao: '2026-08-25',
    validade: '2026-09-24',
    nome_original: 'crf.pdf',
    extensao: 'pdf',
    tamanho: 2048,
    nota: 'Renovação de agosto',
    enviado_por_nome: 'Gustavo',
    enviado_em: '2026-08-25T12:00:00Z',
  },
  total_versoes: 12,
  arquivado_em: null,
};

const VENCIDO: DocumentoResponse = {
  ...BASE,
  id: 2,
  tipo: 11,
  tipo_nome: 'Certidão de tributos municipais',
  nome: 'Certidão de tributos municipais',
  orgao_emissor: 'Prefeitura da sede',
  link_emissor: '',
  situacao: 'vencido',
  situacao_label: 'Vencido há 20 dias',
  validade: '2026-08-31',
  dias_para_vencer: -20,
};

const PENDENTE: DocumentoResponse = {
  ...BASE,
  id: 3,
  tipo: 12,
  tipo_nome: 'Contrato social consolidado',
  nome: 'Contrato social consolidado',
  orgao_emissor: 'Junta Comercial',
  bloco: 'juridica',
  bloco_label: 'Habilitação jurídica',
  exige_validade: false,
  link_emissor: '',
  situacao: 'pendente',
  situacao_label: 'Pendente',
  validade: null,
  dias_para_vencer: null,
  versao_atual: null,
  total_versoes: 0,
};

const TIPOS: TipoDocumento[] = [
  {
    id: 99,
    bloco: 'outros',
    bloco_label: 'Outros',
    nome: 'Outro documento',
    orgao_emissor: '',
    exige_validade: true,
    obrigatorio: false,
    link_emissor: '',
    ordem: 99,
  },
  {
    id: 10,
    bloco: 'fiscal',
    bloco_label: 'Fiscal, social e trabalhista',
    nome: 'Certificado de Regularidade do FGTS (CRF)',
    orgao_emissor: 'Caixa',
    exige_validade: true,
    obrigatorio: true,
    link_emissor: '',
    ordem: 20,
  },
];

function resposta(results = [BASE, VENCIDO, PENDENTE]): DocumentosResposta {
  return { results, validos: 0, a_vencer: 1, vencidos: 1, pendentes: 1 };
}

const EMPRESA = {
  id: 7,
  nome: 'Inside Solutions Ltda',
  cnpj_formatado: '11.222.333/0001-81',
  porte_label: 'Empresa de pequeno porte (EPP)',
  cidade_uf: 'São Paulo / SP',
} as EmpresaResponse;

describe('DocumentosModalComponent', () => {
  let fixture: ComponentFixture<DocumentosModalComponent>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;

  function montar() {
    TestBed.configureTestingModule({
      imports: [DocumentosModalComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: EMPRESA },
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DocumentosService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(DocumentosModalComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of(resposta())),
      tipos: vi.fn(() => of(TIPOS)),
      versoes: vi.fn(() => of([BASE.versao_atual])),
      enviarVersao: vi.fn(() =>
        of({ pct: 100, resultado: { versao: { versao: 13 }, documento: BASE } }),
      ),
      arquivar: vi.fn(() => of({ ...BASE, arquivado_em: 'x' })),
      abrirVaga: vi.fn(() => of(BASE)),
      urlDeDownload: vi.fn(() => of({ url: 'https://bucket/assinada', nome: 'crf.pdf' })),
    };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };
    montar();
  });

  const linhas = () => fixture.debugElement.queryAll(By.css('.linha'));
  const blocos = () =>
    fixture.debugElement
      .queryAll(By.css('.bloco h4'))
      .map((h) => h.nativeElement.textContent.trim());

  it('o cabeçalho diz de quem é a papelada', () => {
    // O modal abre por fora do cadastro: sem razão social e CNPJ no topo,
    // quem abriu não sabe qual empresa está vendo.
    expect(fixture.nativeElement.textContent).toContain('Inside Solutions Ltda');
    expect(fixture.nativeElement.textContent).toContain('11.222.333/0001-81');
  });

  it('a validade aparece no dia certo — data pura não pode voltar um dia no fuso', () => {
    // "2026-09-24" interpretado como meia-noite UTC vira 23/09 em
    // America/Sao_Paulo. É o mesmo motivo de `parseData` existir no card de
    // oportunidade.
    const validades = fixture.debugElement
      .queryAll(By.css('.validade'))
      .map((v) => v.nativeElement.textContent.trim());

    expect(validades).toContain('24/09/2026');
    expect(validades).toContain('31/08/2026');
  });

  it('agrupa pelos blocos da Lei 14.133, na ordem em que os editais pedem', () => {
    expect(blocos()).toEqual(['Habilitação jurídica', 'Fiscal, social e trabalhista']);
  });

  it('a situação vem pronta do backend — a tela não recalcula data', () => {
    const pilulas = fixture.debugElement
      .queryAll(By.css('.pilula'))
      .map((p) => p.nativeElement.textContent.trim());

    expect(pilulas).toContain('Vence em 4 dias');
    expect(pilulas).toContain('Vencido há 20 dias');
  });

  it('documento vencido recebe o destaque da linha', () => {
    const vencida = linhas().filter((l) => l.nativeElement.classList.contains('vencida'));

    expect(vencida).toHaveLength(1);
  });

  it('avisa que o kit de habilitação não fecha com documento vencido', () => {
    expect(fixture.nativeElement.textContent).toContain('não está apta a assinar contrato');
  });

  it('os contadores são disjuntos e vêm do backend', () => {
    const numeros = fixture.debugElement
      .queryAll(By.css('.contador .numero'))
      .map((n) => n.nativeElement.textContent.trim());

    expect(numeros).toEqual(['0', '1', '1', '1']);
  });

  it('filtrar por vencidos deixa só a linha vencida', () => {
    fixture.componentInstance['trocarFiltro']('vencidos');
    fixture.detectChanges();

    expect(linhas()).toHaveLength(1);
    expect(blocos()).toEqual(['Fiscal, social e trabalhista']);
  });

  it('oferece o link do emissor só para quem precisa renovar', () => {
    const emitir = fixture.debugElement.queryAll(By.css('a.link'));

    expect(emitir).toHaveLength(1);
    expect(emitir[0].nativeElement.href).toContain('consulta-crf.caixa.gov.br');
  });

  it('a linha sem versão convida a enviar, a com versão a renovar', () => {
    const rotulos = linhas().map((l) =>
      l.queryAll(By.css('button.link')).map((b) => b.nativeElement.textContent.trim()),
    );

    expect(rotulos[0]).toContain('Enviar');
    expect(rotulos[1]).toContain('+ versão');
  });

  it('enviar manda os campos da certidão junto do arquivo', () => {
    fixture.componentInstance['alternarEnvio'](BASE);
    fixture.componentInstance['validade'].set('2026-10-24');
    fixture.componentInstance['numero'].set('2026092501');
    fixture.detectChanges();

    const arquivo = new File([new Blob(['x'])], 'crf.pdf', { type: 'application/pdf' });
    fixture.componentInstance['enviar'](BASE, arquivo);

    expect(service['enviarVersao']).toHaveBeenCalledWith(
      BASE.id,
      expect.objectContaining({ validade: '2026-10-24', numero: '2026092501' }),
    );
    expect(toast['sucesso']).toHaveBeenCalled();
    expect(service['listar']).toHaveBeenCalledTimes(2);
  });

  it('avisa quando o tipo exige validade e ela ficou em branco', () => {
    fixture.componentInstance['alternarEnvio'](BASE);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('aparece como válido para sempre');
  });

  it('as datas usam o date-picker do app, não input nativo', () => {
    // O mesmo componente da busca de oportunidades: máscara pt-BR, calendário
    // e valor em ISO.
    fixture.componentInstance['alternarEnvio'](BASE);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.envio app-date-picker'))).toHaveLength(2);
    expect(fixture.debugElement.queryAll(By.css('.envio input[type=date]'))).toHaveLength(0);
  });

  it('documento que não vence pede só a emissão', () => {
    fixture.componentInstance['alternarEnvio'](PENDENTE);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.envio app-date-picker'))).toHaveLength(1);
  });

  it('a recusa do backend aparece como está — é a única informação útil', () => {
    service['enviarVersao'].mockReturnValue(
      throwError(() => ({ error: { arquivo: ['Arquivo de 62.0 MB — o limite é 50 MB.'] } })),
    );
    fixture.componentInstance['enviar'](BASE, new File([''], 'grande.pdf'));

    expect(toast['erro']).toHaveBeenCalledWith('Arquivo de 62.0 MB — o limite é 50 MB.');
  });

  it('abrir o histórico busca as versões daquela vaga', () => {
    fixture.componentInstance['alternarVersoes'](BASE);
    fixture.detectChanges();

    expect(service['versoes']).toHaveBeenCalledWith(BASE.id);
    expect(fixture.nativeElement.textContent).toContain('Renovação de agosto');
  });

  it('baixar pede a URL assinada — não existe link fixo para o arquivo', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    fixture.componentInstance['baixar'](100);

    expect(service['urlDeDownload']).toHaveBeenCalledWith(100);
    expect(abrir).toHaveBeenCalledWith('https://bucket/assinada', '_blank');
  });

  it('o seletor de documento novo não repete vaga já aberta, mas repete o tipo livre', () => {
    const opcoes = fixture.componentInstance['opcoesTipo']().map((o) => o.label);

    expect(opcoes).toEqual(['Outro documento']);
  });
});
