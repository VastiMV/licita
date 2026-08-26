import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FiltroResponse } from '../../contracts/filtros/filtro.contracts';
import { MODALIDADES } from '../../contracts/licitacoes/modalidade';
import { FiltrosService } from '../../services/filtros/filtros.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { CheckboxComponent } from '../../shared/ui/checkbox/checkbox.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../shared/ui/select/select.component';

@Component({
  selector: 'app-filtros-page',
  imports: [ReactiveFormsModule, InputTextComponent, SelectComponent, CheckboxComponent, ButtonComponent],
  templateUrl: './filtros.page.html',
  styleUrl: './filtros.page.scss',
})
export class FiltrosPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly filtrosService = inject(FiltrosService);
  private readonly modal = inject(ModalService);

  protected readonly modalidades = MODALIDADES;
  protected readonly filtros = signal<FiltroResponse[]>([]);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    palavras_chave: [''],
    uf: [''],
    modalidade: [''],
    uasg: [''],
    email_notificacao: ['', Validators.email],
    ativo: [true],
  });

  ngOnInit(): void {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.filtrosService.listar().subscribe({
      next: (filtros) => {
        this.filtros.set(filtros);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.modal.aviso({ mensagem: 'Não foi possível carregar seus filtros agora.' }).subscribe();
      },
    });
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.salvando.set(true);
    this.filtrosService.criar(this.form.getRawValue()).subscribe({
      next: (novo) => {
        this.filtros.update((atual) => [novo, ...atual]);
        this.form.reset({ ativo: true });
        this.salvando.set(false);
      },
      error: () => {
        this.salvando.set(false);
        this.modal.aviso({ mensagem: 'Não foi possível salvar o filtro. Tente de novo.' }).subscribe();
      },
    });
  }

  protected remover(filtro: FiltroResponse): void {
    this.modal
      .confirmar({
        titulo: 'Remover filtro',
        mensagem: `Remover "${filtro.nome}"? Você para de receber alertas dele.`,
        confirmarLabel: 'Remover',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.filtrosService.remover(filtro.id).subscribe({
          next: () => this.filtros.update((atual) => atual.filter((f) => f.id !== filtro.id)),
          error: () => this.modal.aviso({ mensagem: 'Não foi possível remover o filtro agora.' }).subscribe(),
        });
      });
  }
}
