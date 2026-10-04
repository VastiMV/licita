import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmCotacaoPagina, EmCotacaoParams } from '../../contracts/licitacoes/em-cotacao.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

@Injectable({ providedIn: 'root' })
export class EmCotacaoService {
  private readonly api = inject(ApiClient);

  listar(params: EmCotacaoParams = {}): Observable<EmCotacaoPagina> {
    return this.api.get<EmCotacaoPagina>(ENDPOINTS.licitacoes.cotacoes, { ...params });
  }
}
