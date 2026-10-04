import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  EncerradasPagina,
  EncerradasParams,
  HistoricoProcesso,
} from '../../contracts/licitacoes/encerrada.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

@Injectable({ providedIn: 'root' })
export class EncerradasService {
  private readonly api = inject(ApiClient);

  listar(params: EncerradasParams = {}): Observable<EncerradasPagina> {
    return this.api.get<EncerradasPagina>(ENDPOINTS.licitacoes.encerradas, { ...params });
  }

  historico(id: number): Observable<HistoricoProcesso> {
    return this.api.get<HistoricoProcesso>(ENDPOINTS.licitacoes.salvaEventos(id));
  }
}
