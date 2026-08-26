import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MODALIDADES } from '../../contracts/licitacoes/modalidade';
import { OportunidadeResponse } from '../../contracts/licitacoes/oportunidade.contracts';
import { LicitacoesService } from '../../services/licitacoes/licitacoes.service';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../shared/ui/select/select.component';

@Component({
  selector: 'app-oportunidades-page',
  imports: [ReactiveFormsModule, DecimalPipe, InputTextComponent, SelectComponent, ButtonComponent, BadgeComponent],
  templateUrl: './oportunidades.page.html',
  styleUrl: './oportunidades.page.scss',
})
export class OportunidadesPage {
  private readonly fb = inject(FormBuilder);
  private readonly licitacoes = inject(LicitacoesService);

  protected readonly modalidades = MODALIDADES;

  protected readonly form = this.fb.nonNullable.group({
    palavra_chave: [''],
    modalidade: [''],
    uf: [''],
    codigo_unidade: [''],
    data_inicial: [''],
    data_final: [''],
  });

  protected readonly resultados = signal<OportunidadeResponse[]>([]);
  protected readonly buscando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly buscou = signal(false);

  protected buscar(): void {
    this.buscando.set(true);
    this.erro.set(null);
    this.buscou.set(true);

    this.licitacoes.buscarOportunidades(this.form.getRawValue()).subscribe({
      next: (resultados) => {
        this.resultados.set(resultados);
        this.buscando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível buscar agora. Tente novamente em instantes.');
        this.buscando.set(false);
      },
    });
  }
}
