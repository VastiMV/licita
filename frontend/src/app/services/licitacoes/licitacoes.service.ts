import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import {
  OportunidadeBuscaParams,
  OportunidadeResponse,
} from '../../contracts/licitacoes/oportunidade.contracts';

/** Busca de oportunidades item a item — consulta ao vivo, não persiste (ver docs/DOMINIO.md). */
@Injectable({ providedIn: 'root' })
export class LicitacoesService {
  private readonly api = inject(ApiClient);

  buscarOportunidades(params: OportunidadeBuscaParams): Observable<OportunidadeResponse[]> {
    return this.api.get<OportunidadeResponse[]>(ENDPOINTS.licitacoes.oportunidades, { ...params });
  }
}
