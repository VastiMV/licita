import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { AlertaResponse } from '../../contracts/alertas/alerta.contracts';

/** Alertas gerados pelo casamento de um `Filtro` com uma `Licitacao` nova. */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly api = inject(ApiClient);

  listar(): Observable<AlertaResponse[]> {
    return this.api.get<AlertaResponse[]>(ENDPOINTS.alertas.lista);
  }
}
