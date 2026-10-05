import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  FabricanteResponse,
  FornecedorResumo,
  MarcaResponse,
} from '../../../contracts/produtos/produto.contracts';
import { FornecedoresService } from '../../../services/fornecedores/fornecedores.service';
import { ProdutosService } from '../../../services/produtos/produtos.service';
import { ModalShellComponent } from '../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ComboboxComponent, OpcaoCombo } from '../../../shared/ui/combobox/combobox.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/** O que a página passa: o fabricante a editar, ou `null` para um novo. */
export type FabricanteModalData = FabricanteResponse | null;

/** `true` quando algo mudou e a tabela precisa recarregar. */
export type FabricanteModalResultado = boolean;

/**
 * Um fabricante inteiro: o nome, quem vende (afinidade) e a árvore de
 * marcas e modelos. Nome e fornecedores gravam no "Salvar"; marcas e
 * modelos gravam na hora — são muitos e editados um a um.
 */
@Component({
  selector: 'app-fabricante-modal',
  imports: [ModalShellComponent, ButtonComponent, ComboboxComponent, IconComponent],
  templateUrl: './fabricante-modal.component.html',
  styleUrl: './fabricante-modal.component.scss',
})
export class FabricanteModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<FabricanteModalResultado>);
  private readonly service = inject(ProdutosService);
  private readonly fornecedoresService = inject(FornecedoresService);
  private readonly toast = inject(ToastService);
  private readonly dados = inject<FabricanteModalData>(DIALOG_DATA);

  protected readonly id = signal<number | null>(this.dados?.id ?? null);
  protected readonly nome = signal(this.dados?.nome ?? '');
  protected readonly fornecedores = signal<readonly FornecedorResumo[]>(
    this.dados?.fornecedores ?? [],
  );
  protected readonly marcas = signal<readonly MarcaResponse[]>(this.dados?.marcas ?? []);
  protected readonly salvando = signal(false);
  protected readonly erroNome = signal<string | null>(null);
  protected readonly novaMarca = signal('');

  private alterou = false;
  private todosFornecedores: readonly FornecedorResumo[] = [];

  protected readonly buscarFornecedor = (termo: string): Observable<readonly OpcaoCombo[]> => {
    const chave = termo.trim().toLowerCase();
    const ja = new Set(this.fornecedores().map((f) => f.id));
    return of(
      this.todosFornecedores
        .filter((f) => !ja.has(f.id))
        .filter((f) => !chave || `${f.nome} ${f.fantasia}`.toLowerCase().includes(chave))
        .slice(0, 30)
        .map((f) => ({ id: f.id, nome: f.nome, detalhe: f.fantasia || null })),
    );
  };

  ngOnInit(): void {
    this.fornecedoresService.opcoes(true).subscribe((opcoes) => {
      this.todosFornecedores = opcoes.map((f) => ({
        id: f.id,
        nome: f.nome,
        fantasia: f.fantasia,
      }));
    });
  }

  protected adicionarFornecedor(opcao: OpcaoCombo | null): void {
    if (!opcao) return;
    const fornecedor = this.todosFornecedores.find((f) => f.id === opcao.id);
    if (fornecedor) this.fornecedores.update((lista) => [...lista, fornecedor]);
  }

  protected removerFornecedor(id: number): void {
    this.fornecedores.update((lista) => lista.filter((f) => f.id !== id));
  }

  protected salvar(): void {
    const nome = this.nome().trim();
    if (!nome) {
      this.erroNome.set('Informe o nome do fabricante.');
      return;
    }
    this.erroNome.set(null);
    this.salvando.set(true);
    const dados = { nome, fornecedor_ids: this.fornecedores().map((f) => f.id) };
    const id = this.id();
    const pedido = id
      ? this.service.atualizarFabricante(id, dados)
      : this.service.criarFabricante(dados);
    pedido.subscribe({
      next: (fabricante) => {
        this.salvando.set(false);
        this.alterou = true;
        const eraNovo = id === null;
        this.aplicar(fabricante);
        if (eraNovo) {
          this.toast.sucesso('Fabricante salvo. Agora cadastre as marcas e os modelos.');
        } else {
          this.toast.sucesso('Fabricante salvo.');
          this.fechar();
        }
      },
      error: (erro) => {
        this.salvando.set(false);
        this.erroNome.set(erro?.error?.nome ?? 'Não foi possível salvar o fabricante agora.');
      },
    });
  }

  protected adicionarMarca(): void {
    const id = this.id();
    const nome = this.novaMarca().trim();
    if (!id || !nome) return;
    this.service.criarMarca(id, nome).subscribe({
      next: (marca) => {
        this.novaMarca.set('');
        this.alterou = true;
        if (!this.marcas().some((m) => m.id === marca.id)) {
          this.marcas.update((lista) => [...lista, { ...marca, modelos: marca.modelos ?? [] }]);
        } else {
          this.toast.alerta(`A marca “${marca.nome}” já existe neste fabricante.`);
        }
      },
      error: () => this.toast.erro('Não foi possível criar a marca agora.'),
    });
  }

  protected renomearMarca(marca: MarcaResponse, nome: string): void {
    nome = nome.trim();
    if (!nome || nome === marca.nome) return;
    this.service.renomearMarca(marca.id, nome).subscribe({
      next: (salva) => {
        this.alterou = true;
        this.trocarMarca(marca.id, (m) => ({ ...m, nome: salva.nome }));
      },
      error: (erro) => {
        this.toast.erro(erro?.error?.nome ?? 'Não foi possível renomear a marca.');
        this.trocarMarca(marca.id, (m) => ({ ...m }));
      },
    });
  }

  protected removerMarca(marca: MarcaResponse): void {
    this.service.removerMarca(marca.id).subscribe({
      next: () => {
        this.alterou = true;
        this.marcas.update((lista) => lista.filter((m) => m.id !== marca.id));
      },
      error: () => this.toast.erro('Não foi possível remover a marca agora.'),
    });
  }

  protected adicionarModelo(marca: MarcaResponse, campo: HTMLInputElement): void {
    const nome = campo.value.trim();
    if (!nome) return;
    this.service.criarModelo(marca.id, nome).subscribe({
      next: (modelo) => {
        campo.value = '';
        this.alterou = true;
        if (marca.modelos.some((m) => m.id === modelo.id)) {
          this.toast.alerta(`O modelo “${modelo.nome}” já existe nesta marca.`);
          return;
        }
        this.trocarMarca(marca.id, (m) => ({ ...m, modelos: [...m.modelos, modelo] }));
      },
      error: () => this.toast.erro('Não foi possível criar o modelo agora.'),
    });
  }

  protected removerModelo(marca: MarcaResponse, modeloId: number): void {
    this.service.removerModelo(modeloId).subscribe({
      next: () => {
        this.alterou = true;
        this.trocarMarca(marca.id, (m) => ({
          ...m,
          modelos: m.modelos.filter((x) => x.id !== modeloId),
        }));
      },
      error: () => this.toast.erro('Não foi possível remover o modelo agora.'),
    });
  }

  protected fechar(): void {
    this.dialogRef.close(this.alterou);
  }

  private aplicar(fabricante: FabricanteResponse): void {
    this.id.set(fabricante.id);
    this.nome.set(fabricante.nome);
    this.fornecedores.set(fabricante.fornecedores);
    this.marcas.set(fabricante.marcas);
  }

  private trocarMarca(id: number, mudar: (m: MarcaResponse) => MarcaResponse): void {
    this.marcas.update((lista) => lista.map((m) => (m.id === id ? mudar(m) : m)));
  }
}

/** Para a página: o fabricante "vende" (afinidade) num texto curto. */
export function resumoFornecedores(fornecedores: readonly FornecedorResumo[]): string {
  return fornecedores.map((f) => f.fantasia || f.nome).join(', ');
}
