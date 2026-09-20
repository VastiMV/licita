import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  EmpresaOpcao,
  EmpresaRequest,
  EmpresaResponse,
  EmpresasPagina,
  EmpresasParams,
} from '../../contracts/empresas/empresa.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * O cadastro das empresas com que a equipe disputa (ver
 * `apps/empresas/models.py`).
 *
 * Mesmo desenho do serviço de fornecedores — buscar, ordenar e paginar são
 * consulta nova ao endpoint —, ainda que aqui o cadastro seja curto: a
 * tabela do projeto é uma só, e uma tela que carrega tudo em memória é uma
 * exceção a explicar depois.
 */
@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly api = inject(ApiClient);

  listar(params: EmpresasParams = {}): Observable<EmpresasPagina> {
    return this.api.get<EmpresasPagina>(ENDPOINTS.empresas.lista, { ...params });
  }

  criar(empresa: EmpresaRequest): Observable<EmpresaResponse> {
    return this.api.post<EmpresaResponse, EmpresaRequest>(ENDPOINTS.empresas.lista, empresa);
  }

  /** `PUT`, não `PATCH`: o modal edita o registro inteiro. */
  atualizar(id: number, empresa: EmpresaRequest): Observable<EmpresaResponse> {
    return this.api.put<EmpresaResponse, EmpresaRequest>(ENDPOINTS.empresas.detalhe(id), empresa);
  }

  /**
   * Inativa — **não apaga**. Empresa que já disputou está amarrada a
   * propostas e processos (ver a docstring do model), então o `DELETE`
   * devolve o registro atualizado em vez de 204: a linha continua na lista,
   * só muda de estado.
   */
  inativar(id: number): Observable<EmpresaResponse> {
    return this.api.delete<EmpresaResponse>(ENDPOINTS.empresas.detalhe(id));
  }

  /** O seletor de CNPJ. `todas` inclui as inativas — é o que a tela usa ao
   * abrir uma proposta antiga, para não sumir o CNPJ já escolhido nela. */
  opcoes(todas = false): Observable<readonly EmpresaOpcao[]> {
    return this.api.get<readonly EmpresaOpcao[]>(
      ENDPOINTS.empresas.opcoes,
      todas ? { todas: 1 } : {},
    );
  }
}
