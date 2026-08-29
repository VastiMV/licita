import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  OportunidadeSalvaRequest,
  OportunidadeSalvaResponse,
  OportunidadesSalvasPagina,
  OportunidadesSalvasParams,
} from '../../contracts/licitacoes/oportunidade-salva.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * Lista de oportunidades salvas — a única parte de licitações que persiste
 * (a busca é ao vivo, ver `LicitacoesService`).
 *
 * Não há "remover" na tela de busca de propósito: salvar é só de ida, e a
 * exclusão mora no módulo de salvas (ver docs/DOMINIO.md — cada salvamento
 * abre um histórico, e um toggle encheria o log de cria/apaga/cria).
 */
@Injectable({ providedIn: 'root' })
export class OportunidadesSalvasService {
  private readonly api = inject(ApiClient);

  listar(params: OportunidadesSalvasParams = {}): Observable<OportunidadesSalvasPagina> {
    return this.api.get<OportunidadesSalvasPagina>(ENDPOINTS.licitacoes.salvas, { ...params });
  }

  /** Só as chaves do que está salvo — é o que a busca precisa pra marcar os
   * cards, sem baixar (nem paginar) a lista inteira. */
  chaves(): Observable<readonly string[]> {
    return this.api
      .get<{ chaves: readonly string[] }>(ENDPOINTS.licitacoes.salvasChaves)
      .pipe(map((resposta) => resposta.chaves));
  }

  salvar(oportunidade: OportunidadeSalvaRequest): Observable<OportunidadeSalvaResponse> {
    return this.api.post<OportunidadeSalvaResponse, OportunidadeSalvaRequest>(
      ENDPOINTS.licitacoes.salvas,
      oportunidade,
    );
  }

  remover(id: number): Observable<void> {
    return this.api.delete<void>(ENDPOINTS.licitacoes.salva(id));
  }

  /** Apaga de uma vez todas as que perderam o prazo — é o link do aviso que
   * a tela mostra ao abrir. */
  removerExpiradas(): Observable<{ removidas: number }> {
    return this.api.delete<{ removidas: number }>(ENDPOINTS.licitacoes.salvasExpiradas);
  }
}
