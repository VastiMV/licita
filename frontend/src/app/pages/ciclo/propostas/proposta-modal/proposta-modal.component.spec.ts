import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PropostaDetalhe } from '../../../../contracts/propostas/proposta.contracts';
import { DocumentosService } from '../../../../services/documentos/documentos.service';
import { PropostasService } from '../../../../services/propostas/propostas.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { PropostaModalComponent, formatarCnpj } from './proposta-modal.component';

const EMPRESA = { id: 1, nome: 'Inside Solutions Ltda', cnpj: '11222333000181' };

function detalhe(extra: Partial<PropostaDetalhe> = {}): PropostaDetalhe {
  return {
    id: 8,
    oportunidade_id: 4,
    valor: 1000,
    validade_dias: 60,
    empresa: EMPRESA,
    gerada_por: 'Vasti',
    gerada_em: '2026-10-01T12:00:00Z',
    oportunidade: {
      objeto: 'Papel A4',
      uasg: '989983',
      orgao_nome: 'Prefeitura',
      data_encerramento_proposta: '2026-10-14',
    } as PropostaDetalhe['oportunidade'],
    empresas: [EMPRESA],
    arquivos: [],
    modelo: { padrao: true, nome: 'Modelo padrão do sistema', enviado_por: null, enviado_em: null },
    ...extra,
  };
}

describe('PropostaModalComponent', () => {
  let fixture: ComponentFixture<PropostaModalComponent>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let documentos: { listar: ReturnType<typeof vi.fn>; urlDeDownload: ReturnType<typeof vi.fn> };

  function montar(proposta = detalhe(), docs: unknown[] = []) {
    service = {
      detalhe: vi.fn(() => of(proposta)),
      atualizar: vi.fn(() => of(proposta)),
      documento: vi.fn(() => of({ conteudo: new Blob(['x']), nome: 'p.docx' })),
      enviarArquivo: vi.fn(),
      removerArquivo: vi.fn(() => of(undefined)),
      urlDoArquivo: vi.fn(),
      baixarModelo: vi.fn(),
      enviarModelo: vi.fn(),
      removerModelo: vi.fn(),
    };
    documentos = {
      listar: vi.fn(() => of({ results: docs })),
      urlDeDownload: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [PropostaModalComponent],
      providers: [
        { provide: PropostasService, useValue: service },
        { provide: DocumentosService, useValue: documentos },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn() } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DIALOG_DATA, useValue: { propostaId: 8 } },
      ],
    });
    fixture = TestBed.createComponent(PropostaModalComponent);
    fixture.detectChanges();
  }

  const texto = () => fixture.nativeElement.textContent as string;

  it('carrega a proposta e os documentos da empresa escolhida', () => {
    montar(detalhe(), [
      {
        id: 1,
        nome: 'CRF do FGTS',
        situacao: 'vencido',
        situacao_label: 'Vencido',
        validade: '2026-09-01',
        exige_validade: true,
        versao_atual: null,
      },
    ]);

    expect(service['detalhe']).toHaveBeenCalledWith(8);
    expect(documentos.listar).toHaveBeenCalledWith(1);
    expect(texto()).toContain('CRF do FGTS');
    expect(texto()).toContain('1 vencido(s) ou pendente(s)');
    expect(texto()).toContain('Gerar a proposta comercial (Word)');
  });

  it('sem empresa não busca documentos e avisa no checklist', () => {
    montar(detalhe({ empresa: null, empresas: [] }));

    expect(documentos.listar).not.toHaveBeenCalled();
    expect(texto()).toContain('Escolher a empresa (CNPJ)');
  });

  it('gerar o Word baixa o arquivo e recarrega', () => {
    montar();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    (fixture.componentInstance as never as { gerarWord: () => void }).gerarWord();

    expect(service['documento']).toHaveBeenCalledWith(8);
    expect(service['detalhe']).toHaveBeenCalledTimes(2);
  });

  it('formata o CNPJ', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});
