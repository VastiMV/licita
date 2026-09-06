import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  FornecedorOpcao,
  FornecedorRequest,
  FornecedorResponse,
  FornecedoresPagina,
  FornecedoresParams,
} from '../../contracts/fornecedores/fornecedor.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * O cadastro de fornecedores — compartilhado por toda a equipe (ver
 * `apps/fornecedores/models.py`), como a lista de oportunidades salvas.
 *
 * Buscar, ordenar e paginar são sempre consulta nova ao endpoint: a tela
 * nunca tem o cadastro inteiro em memória. A exceção é `opcoes()`, que
 * traz tudo de uma vez — o Cotador precisa achar um fornecedor sem sair da
 * cotação, e paginar ali seria hostil.
 */
@Injectable({ providedIn: 'root' })
export class FornecedoresService {
  private readonly api = inject(ApiClient);

  listar(params: FornecedoresParams = {}): Observable<FornecedoresPagina> {
    return this.api.get<FornecedoresPagina>(ENDPOINTS.fornecedores.lista, { ...params });
  }

  criar(fornecedor: FornecedorRequest): Observable<FornecedorResponse> {
    return this.api.post<FornecedorResponse, FornecedorRequest>(
      ENDPOINTS.fornecedores.lista,
      fornecedor,
    );
  }

  /** `PUT`, não `PATCH`: o modal edita o registro inteiro, então mandar
   * parcial esconderia um campo apagado de propósito. */
  atualizar(id: number, fornecedor: FornecedorRequest): Observable<FornecedorResponse> {
    return this.api.put<FornecedorResponse, FornecedorRequest>(
      ENDPOINTS.fornecedores.detalhe(id),
      fornecedor,
    );
  }

  remover(id: number): Observable<void> {
    return this.api.delete<void>(ENDPOINTS.fornecedores.detalhe(id));
  }

  /**
   * O cadastro enxuto para o seletor do Cotador.
   *
   * `todos` inclui inativos e com documentação vencida — é o que a tela usa
   * ao **abrir uma cotação já salva**, para não sumir o fornecedor que já
   * estava escolhido nela. Numa cotação nova, o padrão (só os disponíveis)
   * é o certo.
   */
  opcoes(todos = false): Observable<readonly FornecedorOpcao[]> {
    return this.api.get<readonly FornecedorOpcao[]>(
      ENDPOINTS.fornecedores.opcoes,
      todos ? { todos: 1 } : {},
    );
  }
}
