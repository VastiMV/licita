import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

export interface PropostaResponse {
  readonly id: number;
  readonly oportunidade_id: number;
  readonly valor: number;
  readonly gerada_por: string | null;
  readonly gerada_em: string;
}

/** Propostas (`apps/propostas`) — por enquanto só o gerar, que leva a
 * licitação do Cotador para a etapa Proposta. Idempotente no backend. */
@Injectable({ providedIn: 'root' })
export class PropostasService {
  private readonly api = inject(ApiClient);

  gerar(oportunidadeId: number): Observable<PropostaResponse> {
    return this.api.post<PropostaResponse>(ENDPOINTS.propostas.gerar, {
      oportunidade_id: oportunidadeId,
    });
  }
}
