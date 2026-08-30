import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CotacaoRequest, CotacaoResponse } from '../../contracts/licitacoes/cotacao.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * A cotação gravada de uma oportunidade salva.
 *
 * Não existe "listar": a cotação é um-para-um com a oportunidade (ver
 * `Cotacao` no backend), então ou se abre a de um edital específico, ou não
 * se abre nenhuma. `carregar` devolve 404 quando aquela oportunidade ainda
 * não foi cotada — é o sinal de que a tela abre com os valores padrão, não
 * um erro a mostrar pro usuário.
 */
@Injectable({ providedIn: 'root' })
export class CotacoesService {
  private readonly api = inject(ApiClient);

  carregar(oportunidadeId: number): Observable<CotacaoResponse> {
    return this.api.get<CotacaoResponse>(ENDPOINTS.licitacoes.salvaCotacao(oportunidadeId));
  }

  /** Cria ou sobrescreve — o backend decide, o chamador não precisa saber. */
  salvar(oportunidadeId: number, cotacao: CotacaoRequest): Observable<CotacaoResponse> {
    return this.api.put<CotacaoResponse, CotacaoRequest>(
      ENDPOINTS.licitacoes.salvaCotacao(oportunidadeId),
      cotacao,
    );
  }
}
