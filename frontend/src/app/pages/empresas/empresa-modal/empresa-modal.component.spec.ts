import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { EmpresaResponse } from '../../../contracts/empresas/empresa.contracts';
import { DocumentosService } from '../../../services/documentos/documentos.service';
import { EmpresasService } from '../../../services/empresas/empresas.service';
import { EmpresaModalComponent } from './empresa-modal.component';

const EMPRESA: EmpresaResponse = {
  id: 1,
  nome: 'Inside Solutions Ltda',
  fantasia: 'Inside',
  cnpj: '11222333000181',
  cnpj_formatado: '11.222.333/0001-81',
  porte: 'epp',
  porte_label: 'Empresa de pequeno porte (EPP)',
  inscricao_estadual: '123456',
  inscricao_municipal: '',
  cnae_principal: '4789-0/99',
  cep: '01310000',
  logradouro: 'Av. Paulista',
  numero: '1000',
  complemento: '',
  bairro: 'Bela Vista',
  uf: 'SP',
  cidade: 'São Paulo',
  cidade_uf: 'São Paulo / SP',
  responsavel_legal: 'Gustavo Marucci',
  email: 'licitacoes@inside.com.br',
  telefone: '1133334444',
  observacoes: '',
  padrao: true,
  ativa: true,
  criado_em: '2026-09-01T12:00:00Z',
  atualizado_em: '2026-09-01T12:00:00Z',
};

/** No modo edição o modal monta o painel de documentos, que busca a lista e
 * o catálogo ao abrir. Sem este dublê o `DocumentosService` real iria à rede
 * — e o que se testa aqui é o formulário da empresa, não o dossiê (esse tem
 * o spec dele). */
const DOCUMENTOS_VAZIOS = {
  listar: () => of({ results: [], validos: 0, a_vencer: 0, vencidos: 0, pendentes: 0 }),
  tipos: () => of([]),
};

function montar(empresa: EmpresaResponse | null, service: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [EmpresaModalComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: empresa },
      { provide: DialogRef, useValue: { close: vi.fn() } },
      { provide: EmpresasService, useValue: service },
      { provide: DocumentosService, useValue: DOCUMENTOS_VAZIOS },
    ],
  });
  const fixture = TestBed.createComponent(EmpresaModalComponent);
  fixture.detectChanges();
  return fixture;
}

function digitar(fixture: ComponentFixture<EmpresaModalComponent>, campo: string, valor: string) {
  fixture.componentInstance['form'].get(campo)!.setValue(valor);
  fixture.detectChanges();
}

describe('EmpresaModalComponent', () => {
  let service: {
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = { criar: vi.fn(() => of(EMPRESA)), atualizar: vi.fn(() => of(EMPRESA)) };
  });

  it('abre em branco no modo cadastro', () => {
    const fixture = montar(null, service);

    expect(fixture.nativeElement.textContent).toContain('Cadastrar empresa');
    expect(fixture.componentInstance['form'].get('nome')!.value).toBe('');
  });

  it('abre preenchido no modo edição, com o CNPJ mascarado', () => {
    const fixture = montar(EMPRESA, service);

    expect(fixture.componentInstance['form'].get('cnpj')!.value).toBe('11.222.333/0001-81');
    expect(fixture.nativeElement.textContent).toContain('empresa padrão');
  });

  it('manda o CNPJ só com dígitos — a máscara é da tela', () => {
    const fixture = montar(null, service);
    digitar(fixture, 'nome', 'Inside Solutions Ltda');
    digitar(fixture, 'cnpj', '11.222.333/0001-81');
    digitar(fixture, 'cep', '01310-000');

    fixture.componentInstance['salvar']();

    const payload = service.criar.mock.calls[0][0];
    expect(payload.cnpj).toBe('11222333000181');
    expect(payload.cep).toBe('01310000');
  });

  it('não salva com CNPJ de dígito verificador errado', () => {
    const fixture = montar(null, service);
    digitar(fixture, 'nome', 'Empresa X');
    digitar(fixture, 'cnpj', '11.222.333/0001-00');

    fixture.componentInstance['salvar']();

    expect(service.criar).not.toHaveBeenCalled();
    expect(fixture.componentInstance['erroDe']('cnpj')).toContain('confira os dígitos');
  });

  it('preserva padrão e ativa na edição — quem muda esses dois é a lista', () => {
    const fixture = montar({ ...EMPRESA, padrao: true, ativa: true }, service);
    fixture.componentInstance['salvar']();

    const payload = service.atualizar.mock.calls[0][1];
    expect(payload.padrao).toBe(true);
    expect(payload.ativa).toBe(true);
  });

  it('erro por campo do backend aparece embaixo do campo certo', () => {
    service.criar.mockReturnValue(
      throwError(() => ({
        error: { cnpj: ['Já existe uma empresa cadastrada com este CNPJ: "Outra".'] },
      })),
    );
    const fixture = montar(null, service);
    digitar(fixture, 'nome', 'Inside Solutions Ltda');
    digitar(fixture, 'cnpj', '11.222.333/0001-81');

    fixture.componentInstance['salvar']();
    fixture.detectChanges();

    expect(fixture.componentInstance['erroDe']('cnpj')).toContain('Já existe uma empresa');
  });

  it('erro sem campo vira aviso no rodapé, em vez de um modal que só não salva', () => {
    service.criar.mockReturnValue(throwError(() => ({ error: { detail: 'Indisponível.' } })));
    const fixture = montar(null, service);
    digitar(fixture, 'nome', 'Inside Solutions Ltda');
    digitar(fixture, 'cnpj', '11.222.333/0001-81');

    fixture.componentInstance['salvar']();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.erro')).nativeElement.textContent).toContain(
      'Indisponível.',
    );
  });
});
