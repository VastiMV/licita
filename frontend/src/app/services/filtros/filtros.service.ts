import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { FiltroRequest, FiltroResponse } from '../../contracts/filtros/filtro.contracts';

/** CRUD de `Filtro` do usuário autenticado — ver docs/DOMINIO.md. */
@Injectable({ providedIn: 'root' })
export class FiltrosService {
  private readonly api = inject(ApiClient);

  listar(): Observable<FiltroResponse[]> {
    return this.api.get<FiltroResponse[]>(ENDPOINTS.filtros.lista);
  }

  criar(filtro: FiltroRequest): Observable<FiltroResponse> {
    return this.api.post<FiltroResponse, FiltroRequest>(ENDPOINTS.filtros.lista, filtro);
  }

  atualizar(id: number, filtro: FiltroRequest): Observable<FiltroResponse> {
    return this.api.patch<FiltroResponse, FiltroRequest>(ENDPOINTS.filtros.detalhe(id), filtro);
  }

  remover(id: number): Observable<void> {
    return this.api.delete<void>(ENDPOINTS.filtros.detalhe(id));
  }
}
