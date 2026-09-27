import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** O que cada rota do Ciclo passa em `data` enquanto a tela dela não existe. */
export interface EtapaAConstruirDados {
  readonly titulo: string;
  readonly descricao: string;
}

/**
 * Lugar das telas do Ciclo de Licitação que ainda não foram construídas — o
 * quadro e as listas de Cotador, Propostas, Disputas, Empenhos e
 * Encerradas. O menu já tem o desenho final; cada rota troca esta página
 * pela tela de verdade quando ela chegar (docs/Tarefas/feat-ciclo.md).
 */
@Component({
  selector: 'app-etapa-a-construir-page',
  templateUrl: './etapa-a-construir.page.html',
  styleUrl: './etapa-a-construir.page.scss',
})
export class EtapaAConstruirPage {
  protected readonly dados = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data as EtapaAConstruirDados)),
  );
}
