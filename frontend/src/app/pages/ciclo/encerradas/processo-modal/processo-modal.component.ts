import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, inject, signal } from '@angular/core';

import {
  EncerradaResponse,
  EventoProcesso,
} from '../../../../contracts/licitacoes/encerrada.contracts';
import { EncerradasService } from '../../../../services/licitacoes/encerradas.service';
import { ModalShellComponent } from '../../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import {
  formatarData,
  formatarMoeda,
} from '../../../oportunidades/edital-card/edital-card.utils';

/** Uma linha da linha do tempo. Salvamentos seguidos da cotação viram uma
 * linha só ("atualizada 20 vezes") — vinte linhas iguais escondem o que
 * importa, que é o primeiro, o último e o valor final. */
export interface MarcoProcesso {
  readonly titulo: string;
  readonly descricao: string;
  readonly autor: string | null;
  readonly quando: string;
  readonly sistema: boolean;
}

const COTACAO = 'proposta_gerada';

export function montarMarcos(eventos: readonly EventoProcesso[]): MarcoProcesso[] {
  const marcos: MarcoProcesso[] = [];
  for (let i = 0; i < eventos.length; i++) {
    const evento = eventos[i];
    if (evento.tipo !== COTACAO) {
      marcos.push({
        titulo: evento.tipo_label,
        descricao: evento.descricao,
        autor: evento.autor,
        quando: evento.ocorrido_em,
        sistema: evento.autor === null,
      });
      continue;
    }
    let fim = i;
    while (fim + 1 < eventos.length && eventos[fim + 1].tipo === COTACAO) fim++;
    const ultimo = eventos[fim];
    const vezes = fim - i + 1;
    marcos.push({
      titulo: vezes === 1 ? 'Cotação salva' : `Cotação salva ${vezes} vezes`,
      descricao: ultimo.descricao,
      autor: ultimo.autor,
      quando: ultimo.ocorrido_em,
      sistema: false,
    });
    i = fim;
  }
  return marcos;
}

/**
 * O processo de uma licitação encerrada: de onde veio, por que saiu do
 * ciclo e a linha do tempo do que aconteceu. Versão provisória — o desenho
 * definitivo deste modal está com o design.
 */
@Component({
  selector: 'app-processo-modal',
  imports: [ModalShellComponent, ButtonComponent],
  templateUrl: './processo-modal.component.html',
  styleUrl: './processo-modal.component.scss',
})
export class ProcessoModalComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<'cotacao'>);
  private readonly service = inject(EncerradasService);

  protected readonly processo = inject<EncerradaResponse>(DIALOG_DATA);
  protected readonly marcos = signal<readonly MarcoProcesso[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);

  protected readonly data = formatarData;
  protected readonly moeda = formatarMoeda;

  ngOnInit(): void {
    this.service.historico(this.processo.id).subscribe({
      next: (historico) => {
        this.marcos.set(montarMarcos(historico.eventos));
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  protected quando(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected verCotacao(): void {
    this.dialogRef.close('cotacao');
  }

  protected fechar(): void {
    this.dialogRef.close();
  }
}
