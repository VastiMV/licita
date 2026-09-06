import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CotacaoRequest, CotacaoResponse } from '../../contracts/cotador/cotacao.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/** O que `exportar` devolve: o arquivo e o nome que o backend escolheu para
 * ele (vem no `Content-Disposition`, não no corpo). */
export interface PlanilhaBaixada {
  readonly conteudo: Blob;
  readonly nome: string;
}

const NOME_PADRAO = 'proposta.xlsx';

/**
 * O Cotador novo (`apps/cotador` no backend).
 *
 * Não existe "listar" nem "rascunho": a cotação é um-para-um com a
 * oportunidade e **só existe depois de salva**. Enquanto o operador mexe no
 * modal, ela vive na memória da tela — quem abre o Cotador a partir da
 * busca, olha e desiste não deixa nada na lista da equipe.
 *
 * `salvar` cria **ou** sobrescreve, e é o mesmo método nos dois caminhos:
 * da busca (com o payload `oportunidade`, que entra na lista de salvas
 * junto) e das salvas (com `oportunidade_id`).
 */
@Injectable({ providedIn: 'root' })
export class CotadorService {
  private readonly api = inject(ApiClient);

  salvar(cotacao: CotacaoRequest): Observable<CotacaoResponse> {
    return this.api.post<CotacaoResponse, CotacaoRequest>(ENDPOINTS.cotador.cotacoes, cotacao);
  }

  /** 404 = oportunidade ainda não cotada. É o sinal de abrir o modal em
   * branco (com os itens do snapshot), não um erro a mostrar. */
  carregarDaOportunidade(oportunidadeId: number): Observable<CotacaoResponse> {
    return this.api.get<CotacaoResponse>(ENDPOINTS.cotador.cotacaoDaOportunidade(oportunidadeId));
  }

  remover(id: number): Observable<void> {
    return this.api.delete<void>(ENDPOINTS.cotador.cotacao(id));
  }

  /** A proposta em .xlsx — com fórmulas, não números congelados (ver
   * `apps/cotador/planilha.py`). */
  exportar(id: number): Observable<PlanilhaBaixada> {
    return this.api
      .getArquivo(ENDPOINTS.cotador.planilha(id))
      .pipe(map((resposta) => ({ conteudo: resposta.body!, nome: nomeDoArquivo(resposta) })));
  }
}

/** Lê o nome do arquivo do `Content-Disposition`. O header pode não chegar
 * (proxy que o remove), e aí um nome genérico é melhor do que o navegador
 * salvar como "download". */
export function nomeDoArquivo(resposta: HttpResponse<Blob>): string {
  const disposition = resposta.headers.get('Content-Disposition') ?? '';
  return /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? NOME_PADRAO;
}
