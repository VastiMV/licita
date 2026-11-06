import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';

import { FornecedorResumo, PrecoResponse } from '../../../contracts/produtos/produto.contracts';
import { FornecedoresService } from '../../../services/fornecedores/fornecedores.service';
import { ProdutosService } from '../../../services/produtos/produtos.service';
import { ModalShellComponent } from '../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ComboboxComponent, OpcaoCombo } from '../../../shared/ui/combobox/combobox.component';
import { InputNumberComponent } from '../../../shared/ui/input-number/input-number.component';
import { InputTextComponent } from '../../../shared/ui/input-text/input-text.component';
import { formatarMoeda } from '../../oportunidades/edital-card/edital-card.utils';

/** Quem abre diz o fornecedor quando já sabe (a ficha do fornecedor); da
 * tela de Produtos ele vem vazio e é escolhido aqui. `base` preenche o
 * formulário com um preço existente — é o "atualizar preço". */
export interface PrecoModalData {
  readonly fornecedor: FornecedorResumo | null;
  readonly base?: PrecoResponse | null;
}

/** O preço registrado, ou `undefined` se cancelaram. */
export type PrecoModalResultado = PrecoResponse;

/**
 * Registrar o preço que um fornecedor passou — "caixa com 10 canetas a
 * R$ 34". O preço é o da embalagem, como o fornecedor fala; o custo por
 * unidade aparece na hora, que é o número que importa no edital.
 */
@Component({
  selector: 'app-preco-modal',
  imports: [
    ReactiveFormsModule,
    ModalShellComponent,
    ButtonComponent,
    ComboboxComponent,
    InputTextComponent,
    InputNumberComponent,
  ],
  templateUrl: './preco-modal.component.html',
  styleUrl: './preco-modal.component.scss',
})
export class PrecoModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<PrecoModalResultado>);
  private readonly service = inject(ProdutosService);
  private readonly fornecedoresService = inject(FornecedoresService);
  private readonly fb = inject(FormBuilder);
  protected readonly dados = inject<PrecoModalData>(DIALOG_DATA);

  protected readonly base = this.dados.base ?? null;

  /** Fixo quando veio de quem abriu; senão, escolhido no combobox. */
  protected readonly fornecedor = signal<FornecedorResumo | null>(
    this.dados.fornecedor ?? this.base?.fornecedor ?? null,
  );
  protected readonly fornecedorFixo = !!(this.dados.fornecedor ?? this.base);
  protected readonly erroFornecedor = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    descricao: [this.base?.produto ?? '', Validators.required],
    embalagem: [this.base?.embalagem ?? 'Caixa'],
    quantidade_embalagem: this.fb.control<number | null>(this.base?.quantidade_embalagem ?? 1),
    preco_embalagem: this.fb.control<number | null>(null),
    observacoes: [''],
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** "= R$ 3,40 por unidade" — atualiza enquanto se digita. */
  protected readonly unitario = computed(() => {
    const { quantidade_embalagem: qtd, preco_embalagem: preco } = this.valores();
    if (!qtd || qtd < 1 || !preco || preco <= 0) return null;
    return formatarMoeda(preco / qtd);
  });

  protected readonly precoAnterior = this.base
    ? `${formatarMoeda(Number(this.base.preco_embalagem))} por ${this.base.embalagem.toLowerCase()}`
    : null;

  private todos: readonly FornecedorResumo[] = [];

  protected readonly buscarFornecedor = (termo: string): Observable<readonly OpcaoCombo[]> => {
    const chave = termo.trim().toLowerCase();
    return of(
      this.todos
        .filter((f) => !chave || `${f.nome} ${f.fantasia}`.toLowerCase().includes(chave))
        .slice(0, 30)
        .map((f) => ({ id: f.id, nome: f.nome, detalhe: f.fantasia || null })),
    );
  };

  protected readonly opcaoFornecedor = computed<OpcaoCombo | null>(() => {
    const f = this.fornecedor();
    return f ? { id: f.id, nome: f.nome, detalhe: f.fantasia || null } : null;
  });

  ngOnInit(): void {
    if (this.fornecedorFixo) return;
    this.fornecedoresService.opcoes().subscribe((opcoes) => {
      this.todos = opcoes.map((f) => ({ id: f.id, nome: f.nome, fantasia: f.fantasia }));
    });
  }

  protected escolherFornecedor(opcao: OpcaoCombo | null): void {
    this.erroFornecedor.set(null);
    this.fornecedor.set(opcao ? (this.todos.find((f) => f.id === opcao.id) ?? null) : null);
  }

  protected erroDe(campo: 'descricao' | 'quantidade_embalagem' | 'preco_embalagem'): string | null {
    const controle = this.form.controls[campo];
    if (!controle.touched) return null;
    const valor = controle.value;
    if (campo === 'descricao') return valor ? null : 'Diga qual é o produto.';
    if (campo === 'quantidade_embalagem') {
      return typeof valor === 'number' && valor >= 1 && Number.isInteger(valor)
        ? null
        : 'Quantas unidades vêm na embalagem? (1 ou mais)';
    }
    return typeof valor === 'number' && valor > 0 ? null : 'Informe o preço.';
  }

  protected salvar(): void {
    this.form.markAllAsTouched();
    this.erroGeral.set(null);
    const fornecedor = this.fornecedor();
    if (!fornecedor) this.erroFornecedor.set('Escolha o fornecedor.');
    const temErro =
      !fornecedor ||
      this.erroDe('descricao') ||
      this.erroDe('quantidade_embalagem') ||
      this.erroDe('preco_embalagem');
    if (temErro || this.salvando()) return;

    const v = this.form.getRawValue();
    this.salvando.set(true);
    this.service
      .registrarPreco({
        fornecedor: fornecedor!.id,
        descricao: v.descricao.trim(),
        // Atualizar um preço de produto cadastrado mantém o vínculo com o modelo.
        modelo: this.base && v.descricao.trim() === this.base.produto ? this.base.modelo : null,
        embalagem: v.embalagem.trim() || 'Unidade',
        quantidade_embalagem: v.quantidade_embalagem!,
        preco_embalagem: v.preco_embalagem!,
        observacoes: v.observacoes.trim(),
      })
      .subscribe({
        next: (preco) => {
          this.salvando.set(false);
          this.dialogRef.close(preco);
        },
        error: () => {
          this.salvando.set(false);
          this.erroGeral.set('Não foi possível salvar o preço agora.');
        },
      });
  }

  protected fechar(): void {
    this.dialogRef.close();
  }
}
