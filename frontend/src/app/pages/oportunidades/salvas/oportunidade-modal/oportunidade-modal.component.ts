import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, inject, signal } from '@angular/core';

import { OportunidadeSalvaResponse } from '../../../../contracts/licitacoes/oportunidade-salva.contracts';
import { LicitacoesService } from '../../../../services/licitacoes/licitacoes.service';
import { ModalShellComponent } from '../../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EditalCardComponent } from '../../edital-card/edital-card.component';
import { DetalheEstado, EditalCard } from '../../edital-card/edital-card.model';

/**
 * Visualizar uma oportunidade salva: o **mesmo card** da busca, com os
 * mesmos comportamentos (abas de itens/documentos, abrir na plataforma,
 * baixar edital) — é literalmente o `EditalCardComponent`, não uma segunda
 * versão dele.
 *
 * O que dá pra mostrar na hora vem do snapshot gravado ao salvar
 * (`OportunidadeSalva.itens`): abre sem esperar rede. O que **muda com o
 * tempo** — documentos publicados depois, plataforma de origem, selo CAPAG —
 * é consultado ao abrir, no `CompraDetalheView` (cacheado no backend, ver
 * `services.detalhar_compra_cacheada`), e entra no card assim que chega.
 */
@Component({
  selector: 'app-oportunidade-modal',
  imports: [ModalShellComponent, EditalCardComponent, ButtonComponent],
  templateUrl: './oportunidade-modal.component.html',
  styleUrl: './oportunidade-modal.component.scss',
})
export class OportunidadeModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly licitacoes = inject(LicitacoesService);

  protected readonly salva = inject<OportunidadeSalvaResponse>(DIALOG_DATA);

  protected readonly card: EditalCard = {
    chave: this.salva.chave,
    contratacao: this.salva.itens[0],
    itens: this.salva.itens,
  };

  protected readonly detalhe = signal<DetalheEstado | undefined>(undefined);

  ngOnInit(): void {
    this.carregarDetalhe();
  }

  protected fechar(): void {
    this.dialogRef.close();
  }

  protected baixarEdital(): void {
    const url = this.detalhe()?.documentos[0]?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  private carregarDetalhe(): void {
    const { cnpj_orgao, ano_compra, sequencial_compra } = this.salva;
    this.detalhe.set({
      carregando: true,
      documentos: [],
      // O selo gravado no snapshot aparece de imediato; o do detalhe
      // substitui quando chegar.
      capag: this.salva.capag,
      plataforma: null,
      erro: false,
    });

    this.licitacoes.detalharCompra(cnpj_orgao, ano_compra, sequencial_compra).subscribe({
      next: (dados) =>
        this.detalhe.set({
          carregando: false,
          documentos: dados.documentos,
          capag: dados.capag ?? this.salva.capag,
          plataforma: dados.plataforma,
          erro: false,
        }),
      // O card continua desenhado com o snapshot — só os documentos ficam
      // sem lista (o card já mostra o aviso de falha na aba deles).
      error: () =>
        this.detalhe.set({
          carregando: false,
          documentos: [],
          capag: this.salva.capag,
          plataforma: null,
          erro: true,
        }),
    });
  }
}
