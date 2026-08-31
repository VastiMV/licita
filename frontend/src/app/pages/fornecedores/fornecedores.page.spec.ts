import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FornecedorResponse } from '../../contracts/fornecedores/fornecedor.contracts';
import { FornecedoresService } from '../../services/fornecedores/fornecedores.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FornecedorModalComponent } from './fornecedor-modal/fornecedor-modal.component';
import { FornecedoresPage } from './fornecedores.page';

const ATIVO: FornecedorResponse = {
  id: 1,
  nome: 'Marucci Distribuidora Ltda',
  fantasia: 'Marucci',
  tipo: 'pj',
  cnpj: '11222333000181',
  cnpj_formatado: '11.222.333/0001-81',
  inscricao_estadual: '',
  categoria: 'materiais',
  categoria_label: 'Materiais',
  cep: '13010000',
  logradouro: 'Rua das Flores',
  numero: '100',
  complemento: '',
  bairro: 'Centro',
  uf: 'SP',
  cidade: 'Campinas',
  cidade_uf: 'Campinas / SP',
  responsavel: 'Ana',
  email: 'compras@marucci.com.br',
  telefone: '',
  celular: '',
  condicao_pagamento: '30_dias',
  prazo_entrega_dias: 10,
  dados_bancarios: '',
  chave_pix: '',
  observacoes: '',
  situacao: 'ativo',
  situacao_label: 'Ativo',
  criado_em: '2026-08-25T12:00:00Z',
  atualizado_em: '2026-08-25T12:00:00Z',
};

const VENCIDO: FornecedorResponse = {
  ...ATIVO,
  id: 2,
  nome: 'Beta Tecnologia',
  fantasia: '',
  cnpj: '45723174000110',
  cnpj_formatado: '45.723.174/0001-10',
  categoria: 'tecnologia',
  categoria_label: 'Tecnologia',
  cidade: 'Recife',
  uf: 'PE',
  cidade_uf: 'Recife / PE',
  situacao: 'documentacao_vencida',
  situacao_label: 'Documentação vencida',
};

function pagina(results: FornecedorResponse[], vencidos = 0) {
  return {
    count: results.length,
    next: null,
    previous: null,
    documentacao_vencida: vencidos,
    results,
  };
}

describe('FornecedoresPage', () => {
  let fixture: ComponentFixture<FornecedoresPage>;
  let service: { listar: ReturnType<typeof vi.fn>; remover: ReturnType<typeof vi.fn> };
  let modal: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let toast: {
    sucesso: ReturnType<typeof vi.fn>;
    erro: ReturnType<typeof vi.fn>;
    alerta: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of(pagina([ATIVO, VENCIDO], 1))),
      remover: vi.fn(() => of(undefined)),
    };
    modal = { confirmar: vi.fn(() => of(true)), abrir: vi.fn(() => of(undefined)) };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };

    TestBed.configureTestingModule({
      imports: [FornecedoresPage],
      providers: [
        { provide: FornecedoresService, useValue: service },
        { provide: ModalService, useValue: modal },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(FornecedoresPage);
    fixture.detectChanges();
  });

  const linhas = () => fixture.debugElement.queryAll(By.css('tbody tr'));

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

  it('carrega o cadastro ordenado por nome — é assim que se procura fornecedor', () => {
    expect(service.listar).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: 'nome', page: 1 }),
    );
    expect(linhas()).toHaveLength(2);
  });

  it('mostra razão social com o nome fantasia embaixo', () => {
    const primeira = linhas()[0].queryAll(By.css('td'))[0].nativeElement as HTMLElement;

    expect(primeira.textContent).toContain('Marucci Distribuidora Ltda');
    expect(primeira.querySelector('.celula-secundaria')?.textContent?.trim()).toBe('Marucci');
  });

  it('documento e cidade saem formatados pelo backend, sem remontagem em JS', () => {
    const celulas = linhas()[0].queryAll(By.css('td'));

    expect(celulas[1].nativeElement.textContent).toContain('11.222.333/0001-81');
    expect(celulas[2].nativeElement.textContent).toContain('Campinas / SP');
  });

  it('a linha com documentação vencida fica destacada, com a situação em vermelho', () => {
    expect(linhas()[1].classes['destacada']).toBe(true);
    expect(linhas()[0].classes['destacada']).toBeFalsy();
    expect(linhas()[1].queryAll(By.css('td'))[4].nativeElement.className).toContain(
      'celula-perigo',
    );
  });

  it('avisa quantos estão com documentação vencida no cadastro inteiro', () => {
    const aviso = fixture.debugElement.query(By.css('.aviso')).nativeElement as HTMLElement;

    expect(aviso.textContent).toContain('1');
    expect(aviso.textContent).toContain('documentação vencida');
  });

  it('as ações ficam num menu por linha: editar e excluir', () => {
    const opcoes = abrirMenuDaLinha(0).map((botao) => botao.textContent?.trim());

    expect(opcoes).toEqual(['Editar', 'Excluir']);
  });

  it('"Adicionar fornecedor" abre o modal em modo de cadastro (sem registro)', () => {
    fixture.debugElement.query(By.css('app-button button')).nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(FornecedorModalComponent, null);
  });

  it('"Editar" abre o mesmo modal já com o registro da linha', () => {
    clicarAcao(0, 'Editar');

    expect(modal.abrir).toHaveBeenCalledWith(FornecedorModalComponent, ATIVO);
  });

  it('recarrega a lista depois que o modal salva', () => {
    modal.abrir.mockReturnValue(of(ATIVO));
    service.listar.mockClear();

    clicarAcao(0, 'Editar');

    expect(service.listar).toHaveBeenCalled();
    expect(toast.sucesso).toHaveBeenCalled();
  });

  it('fechar o modal sem salvar não recarrega nem avisa nada', () => {
    service.listar.mockClear();

    clicarAcao(0, 'Editar');

    expect(service.listar).not.toHaveBeenCalled();
    expect(toast.sucesso).not.toHaveBeenCalled();
  });

  it('excluir pede confirmação antes de chamar o endpoint', () => {
    clicarAcao(0, 'Excluir');

    expect(modal.confirmar).toHaveBeenCalled();
    expect(service.remover).toHaveBeenCalledWith(1);
    expect(toast.sucesso).toHaveBeenCalled();
  });

  it('cancelar a confirmação não exclui', () => {
    modal.confirmar.mockReturnValue(of(false));

    clicarAcao(0, 'Excluir');

    expect(service.remover).not.toHaveBeenCalled();
  });

  it('falha ao excluir vira aviso, não tela quebrada', () => {
    service.remover.mockReturnValue(throwError(() => new Error('500')));

    clicarAcao(0, 'Excluir');

    expect(toast.erro).toHaveBeenCalled();
  });

  it('falha ao carregar mostra a mensagem de erro e esvazia a tabela', () => {
    service.listar.mockReturnValue(throwError(() => new Error('500')));

    fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.erro'))).toBeTruthy();
    expect(linhas()).toHaveLength(1); // a linha de "nenhum registro"
  });
});
