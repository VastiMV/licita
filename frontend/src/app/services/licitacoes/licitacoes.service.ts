import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import {
  CompraDetalheResponse,
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

  /** Documentos do edital + selo CAPAG de uma compra — sob demanda (ver
   * `CompraDetalheView` no backend), não faz parte de `buscarOportunidades`. */
  detalharCompra(
    cnpj: string,
    ano: string | number,
    sequencial: string | number,
  ): Observable<CompraDetalheResponse> {
    return this.api.get<CompraDetalheResponse>(ENDPOINTS.licitacoes.compraDetalhe(cnpj, ano, sequencial));
  }
}
