import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PrecoResponse } from '../../../contracts/produtos/produto.contracts';
import { FornecedoresService } from '../../../services/fornecedores/fornecedores.service';
import { ProdutosService } from '../../../services/produtos/produtos.service';
import { descreverEmbalagem } from '../precos-tabela/precos-tabela.component';
import { PrecoModalComponent, PrecoModalData } from './preco-modal.component';

const WOLOLO = { id: 3, nome: 'Wololo Ltda', fantasia: 'Wololo' };

const SALVO = {
  id: 1,
  fornecedor: WOLOLO,
  produto: 'Caneta azul',
  descricao: 'Caneta azul',
  modelo: null,
  embalagem: 'Caixa',
  quantidade_embalagem: 10,
  preco_embalagem: '34.0000',
  custo: '3.4000',
  observacoes: '',
  origem: 'manual',
  registrado_em: '2026-11-06T12:00:00Z',
  registrado_por: 'Vasti',
} as PrecoResponse;

type Interno = {
  form: {
    patchValue: (v: object) => void;
    markAllAsTouched: () => void;
  };
  unitario: () => string | null;
  salvar: () => void;
  erroFornecedor: () => string | null;
};

function montar(dados: PrecoModalData) {
  const produtos = { registrarPreco: vi.fn(() => of(SALVO)) };
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PrecoModalComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: dialogRef },
      { provide: ProdutosService, useValue: produtos },
      { provide: FornecedoresService, useValue: { opcoes: () => of([]) } },
    ],
  });
  const fixture = TestBed.createComponent(PrecoModalComponent);
  fixture.detectChanges();
  return { modal: fixture.componentInstance as never as Interno, produtos, dialogRef };
}

describe('PrecoModalComponent', () => {
  it('mostra o preço por unidade a partir da embalagem', () => {
    const { modal } = montar({ fornecedor: WOLOLO });

    modal.form.patchValue({ quantidade_embalagem: 10, preco_embalagem: 34 });

    expect(modal.unitario()).toBe('R$ 3,40');
  });

  it('sem quantidade válida não calcula', () => {
    const { modal } = montar({ fornecedor: WOLOLO });

    modal.form.patchValue({ quantidade_embalagem: 0, preco_embalagem: 34 });

    expect(modal.unitario()).toBeNull();
  });

  it('envia a embalagem e o preço dela, sem o custo unitário', () => {
    const { modal, produtos, dialogRef } = montar({ fornecedor: WOLOLO });

    modal.form.patchValue({
      descricao: ' Caneta azul ',
      quantidade_embalagem: 10,
      preco_embalagem: 34,
    });
    modal.salvar();

    expect(produtos.registrarPreco).toHaveBeenCalledWith({
      fornecedor: 3,
      descricao: 'Caneta azul',
      modelo: null,
      embalagem: 'Caixa',
      quantidade_embalagem: 10,
      preco_embalagem: 34,
      observacoes: '',
    });
    expect(dialogRef.close).toHaveBeenCalledWith(SALVO);
  });

  it('sem fornecedor não salva', () => {
    const { modal, produtos } = montar({ fornecedor: null });

    modal.form.patchValue({ descricao: 'Caneta', quantidade_embalagem: 1, preco_embalagem: 2 });
    modal.salvar();

    expect(produtos.registrarPreco).not.toHaveBeenCalled();
    expect(modal.erroFornecedor()).toBe('Escolha o fornecedor.');
  });

  it('atualizar preço parte do preço atual', () => {
    const { modal, produtos } = montar({ fornecedor: null, base: SALVO });

    modal.form.patchValue({ preco_embalagem: 36 });
    modal.salvar();

    expect(produtos.registrarPreco).toHaveBeenCalledWith(
      expect.objectContaining({ fornecedor: 3, quantidade_embalagem: 10, preco_embalagem: 36 }),
    );
  });
});

describe('descreverEmbalagem', () => {
  it('mostra a quantidade só quando há mais de uma unidade', () => {
    expect(descreverEmbalagem(SALVO)).toBe('Caixa c/ 10');
    expect(descreverEmbalagem({ ...SALVO, embalagem: 'Unidade', quantidade_embalagem: 1 })).toBe(
      'Unidade',
    );
  });
});
