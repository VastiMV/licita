import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { EmpresaResponse } from '../../contracts/empresas/empresa.contracts';
import { EmpresasService } from '../../services/empresas/empresas.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { EmpresaModalComponent } from './empresa-modal/empresa-modal.component';
import { EmpresasPage } from './empresas.page';

const PADRAO: EmpresaResponse = {
  id: 1,
  nome: 'Inside Solutions Ltda',
  fantasia: 'Inside',
  cnpj: '11222333000181',
  cnpj_formatado: '11.222.333/0001-81',
  porte: 'epp',
  porte_label: 'Empresa de pequeno porte (EPP)',
  inscricao_estadual: '',
  inscricao_municipal: '',
  cnae_principal: '',
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
  telefone: '',
  observacoes: '',
  padrao: true,
  ativa: true,
  criado_em: '2026-09-01T12:00:00Z',
  atualizado_em: '2026-09-01T12:00:00Z',
};

const SEGUNDA: EmpresaResponse = {
  ...PADRAO,
  id: 2,
  nome: 'Inside Log Transportes Ltda',
  fantasia: '',
  cnpj: '45723174000110',
  cnpj_formatado: '45.723.174/0001-10',
  porte: 'me',
  porte_label: 'Microempresa (ME)',
  cidade: 'Guarulhos',
  cidade_uf: 'Guarulhos / SP',
  padrao: false,
};

function pagina(results: EmpresaResponse[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe('EmpresasPage', () => {
  let fixture: ComponentFixture<EmpresasPage>;
  let service: {
    listar: ReturnType<typeof vi.fn>;
    inativar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
  };
  let modal: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let toast: {
    sucesso: ReturnType<typeof vi.fn>;
    erro: ReturnType<typeof vi.fn>;
    alerta: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of(pagina([PADRAO, SEGUNDA]))),
      inativar: vi.fn(() => of({ ...SEGUNDA, ativa: false })),
      atualizar: vi.fn(() => of(SEGUNDA)),
    };
    modal = { confirmar: vi.fn(() => of(true)), abrir: vi.fn(() => of(undefined)) };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };

    TestBed.configureTestingModule({
      imports: [EmpresasPage],
      providers: [
        { provide: EmpresasService, useValue: service },
        { provide: ModalService, useValue: modal },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(EmpresasPage);
    fixture.detectChanges();
  });

  /** Só as linhas de dado: a tabela usa `tr.linha-status` para "carregando"
   * e para a mensagem de lista vazia. */
  const linhas = () => fixture.debugElement.queryAll(By.css('tbody tr:not(.linha-status)'));

  function abrirMenuDaLinha(indice: number): HTMLButtonElement[] {
    linhas()[indice].query(By.css('app-menu .gatilho')).nativeElement.click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-item'));
  }

  function clicarAcao(indice: number, rotulo: string): void {
    const item = abrirMenuDaLinha(indice).find((botao) => botao.textContent?.includes(rotulo));
    item!.click();
    fixture.detectChanges();
  }

  it('carrega o cadastro ordenado por nome', () => {
    expect(service.listar).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: 'nome', page: 1 }),
    );
    expect(linhas()).toHaveLength(2);
  });

  it('marca na lista qual é a empresa padrão — é a que já vem na proposta', () => {
    const primeira = linhas()[0].queryAll(By.css('td'))[0].nativeElement as HTMLElement;

    expect(primeira.querySelector('.celula-secundaria')?.textContent).toContain('empresa padrão');
  });

  it('CNPJ e cidade saem formatados pelo backend, sem remontagem em JS', () => {
    const celulas = linhas()[0].queryAll(By.css('td'));

    expect(celulas[1].nativeElement.textContent).toContain('11.222.333/0001-81');
    expect(celulas[2].nativeElement.textContent).toContain('São Paulo / SP');
  });

  it('a empresa padrão não oferece "Inativar" — a proposta ficaria sem CNPJ', () => {
    const rotulos = abrirMenuDaLinha(0).map((botao) => botao.textContent?.trim());

    expect(rotulos.some((rotulo) => rotulo?.includes('Inativar'))).toBe(false);
    expect(rotulos.some((rotulo) => rotulo?.includes('Definir como padrão'))).toBe(false);
  });

  it('inativar confirma antes, e o texto diz que não é exclusão', () => {
    clicarAcao(1, 'Inativar');

    expect(modal.confirmar).toHaveBeenCalled();
    expect(modal.confirmar.mock.calls[0][0].mensagem).toContain('reativada');
    expect(service.inativar).toHaveBeenCalledWith(SEGUNDA.id);
    expect(toast.sucesso).toHaveBeenCalled();
  });

  it('desistir da confirmação não inativa nada', () => {
    modal.confirmar.mockReturnValue(of(false));
    clicarAcao(1, 'Inativar');

    expect(service.inativar).not.toHaveBeenCalled();
  });

  it('definir como padrão manda o registro inteiro com o campo trocado', () => {
    clicarAcao(1, 'Definir como padrão');

    const [id, payload] = service.atualizar.mock.calls[0];
    expect(id).toBe(SEGUNDA.id);
    expect(payload.padrao).toBe(true);
    // Derivados do backend não voltam no PUT — o serializer os recusaria.
    expect(payload).not.toHaveProperty('cnpj_formatado');
    expect(payload).not.toHaveProperty('id');
  });

  it('empresa inativa oferece reativar em vez de inativar', () => {
    service.listar.mockReturnValue(of(pagina([PADRAO, { ...SEGUNDA, ativa: false }])));
    fixture.componentInstance['carregar']();
    fixture.detectChanges();

    const rotulos = abrirMenuDaLinha(1).map((botao) => botao.textContent?.trim());
    expect(rotulos.some((rotulo) => rotulo?.includes('Reativar'))).toBe(true);
    expect(rotulos.some((rotulo) => rotulo?.includes('Inativar'))).toBe(false);
  });

  it('mostra a explicação do backend quando ele recusa a ação', () => {
    service.inativar.mockReturnValue(
      throwError(() => ({ error: { detail: 'Esta é a empresa padrão.' } })),
    );
    clicarAcao(1, 'Inativar');

    expect(toast.erro).toHaveBeenCalledWith('Esta é a empresa padrão.');
  });

  it('adicionar abre o modal em branco e recarrega quando ele salva', () => {
    modal.abrir.mockReturnValue(of({ ...PADRAO, nome: 'Nova Empresa Ltda' }));
    (fixture.nativeElement.querySelector('app-button button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(modal.abrir).toHaveBeenCalledWith(EmpresaModalComponent, null);
    expect(service.listar).toHaveBeenCalledTimes(2);
    expect(toast.sucesso).toHaveBeenCalledWith('"Nova Empresa Ltda" entrou no cadastro.');
  });

  it('erro na carga não deixa a tabela com dados velhos', () => {
    service.listar.mockReturnValue(throwError(() => new Error('falhou')));
    fixture.componentInstance['carregar']();
    fixture.detectChanges();

    expect(linhas()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar');
  });
});
