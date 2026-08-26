import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MODALIDADES } from '../../contracts/licitacoes/modalidade';
import { OportunidadeResponse } from '../../contracts/licitacoes/oportunidade.contracts';
import { LicitacoesService } from '../../services/licitacoes/licitacoes.service';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { InputTextComponent } from '../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../shared/ui/select/select.component';

const FORM_INICIAL = {
  palavra_chave: '',
  modalidade: '',
  uf: '',
  codigo_unidade: '',
  data_inicial: '',
  data_final: '',
};

@Component({
  selector: 'app-oportunidades-page',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    InputTextComponent,
    SelectComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
  ],
  templateUrl: './oportunidades.page.html',
  styleUrl: './oportunidades.page.scss',
})
export class OportunidadesPage {
  private readonly fb = inject(FormBuilder);
  private readonly licitacoes = inject(LicitacoesService);

  /** Requisição em andamento — guardada só pra `cancelarBusca()` poder abortá-la. */
  private buscaEmAndamento: Subscription | null = null;

  protected readonly modalidades = MODALIDADES;

  protected readonly form = this.fb.nonNullable.group(FORM_INICIAL);

  protected readonly resultados = signal<OportunidadeResponse[]>([]);
  protected readonly buscando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly buscou = signal(false);

  protected buscar(): void {
    this.buscando.set(true);
    this.erro.set(null);
    this.buscou.set(true);

    this.buscaEmAndamento = this.licitacoes.buscarOportunidades(this.form.getRawValue()).subscribe({
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

  /** Desfazer o `subscribe` aborta a requisição HTTP em andamento de verdade (não só ignora a resposta). */
  protected cancelarBusca(): void {
    this.buscaEmAndamento?.unsubscribe();
    this.buscaEmAndamento = null;
    this.buscando.set(false);
  }

  /** Volta a tela ao estado inicial — filtros, resultado e mensagens, tudo junto. */
  protected limpar(): void {
    this.cancelarBusca();
    this.form.reset(FORM_INICIAL);
    this.resultados.set([]);
    this.erro.set(null);
    this.buscou.set(false);
  }
}
