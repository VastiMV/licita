import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  EncerradasPagina,
  EncerradasParams,
  ProcessoResponse,
} from '../../contracts/licitacoes/encerrada.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

@Injectable({ providedIn: 'root' })
export class EncerradasService {
  private readonly api = inject(ApiClient);

  listar(params: EncerradasParams = {}): Observable<EncerradasPagina> {
    return this.api.get<EncerradasPagina>(ENDPOINTS.licitacoes.encerradas, { ...params });
  }

  /** A história da salva no formato do modal do processo. */
  processo(id: number): Observable<ProcessoResponse> {
    return this.api.get<ProcessoResponse>(ENDPOINTS.licitacoes.processo(id));
  }
}
