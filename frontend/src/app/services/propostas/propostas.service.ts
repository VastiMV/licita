import { HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

import {
  ArquivoProposta,
  EmPropostaPagina,
  EmPropostaParams,
  ModeloProposta,
  PropostaDetalhe,
  PropostaResponse,
} from '../../contracts/propostas/proposta.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { PlanilhaBaixada, nomeDoArquivo } from '../cotador/cotador.service';

/** Propostas (`apps/propostas`): gerar (do Cotador), a lista de Ciclo ›
 * Propostas e o modal — empresa, Word, modelo e arquivos. */
@Injectable({ providedIn: 'root' })
export class PropostasService {
  private readonly api = inject(ApiClient);

  /** Leva a licitação do Cotador para a etapa Proposta. Idempotente. */
  gerar(oportunidadeId: number): Observable<PropostaResponse> {
    return this.api.post<PropostaResponse>(ENDPOINTS.propostas.lista, {
      oportunidade_id: oportunidadeId,
    });
  }

  listar(params: EmPropostaParams = {}): Observable<EmPropostaPagina> {
    return this.api.get<EmPropostaPagina>(ENDPOINTS.propostas.lista, { ...params });
  }

  detalhe(id: number): Observable<PropostaDetalhe> {
    return this.api.get<PropostaDetalhe>(ENDPOINTS.propostas.detalhe(id));
  }

  atualizar(
    id: number,
    dados: { empresa_id?: number; validade_dias?: number },
  ): Observable<PropostaResponse> {
    return this.api.patch<PropostaResponse>(ENDPOINTS.propostas.detalhe(id), dados);
  }

  /** A proposta comercial em Word, do modelo em uso. */
  documento(id: number): Observable<PlanilhaBaixada> {
    return this.baixar(ENDPOINTS.propostas.documento(id));
  }

  enviarArquivo(id: number, arquivo: File): Observable<ArquivoProposta> {
    return this.enviar<ArquivoProposta>(ENDPOINTS.propostas.arquivos(id), arquivo);
  }

  removerArquivo(arquivoId: number): Observable<void> {
    return this.api.delete<void>(ENDPOINTS.propostas.arquivo(arquivoId));
  }

  /** URL assinada de curta duração — o bucket nunca é público. */
  urlDoArquivo(arquivoId: number): Observable<{ url: string; nome: string }> {
    return this.api.get<{ url: string; nome: string }>(
      ENDPOINTS.propostas.arquivoDownload(arquivoId),
    );
  }

  enviarModelo(arquivo: File): Observable<ModeloProposta> {
    return this.enviar<ModeloProposta>(ENDPOINTS.propostas.modelo, arquivo);
  }

  /** Volta para o modelo padrão do sistema. */
  removerModelo(): Observable<ModeloProposta> {
    return this.api.delete<ModeloProposta>(ENDPOINTS.propostas.modelo);
  }

  baixarModelo(): Observable<PlanilhaBaixada> {
    return this.baixar(ENDPOINTS.propostas.modeloDownload);
  }

  private baixar(caminho: string): Observable<PlanilhaBaixada> {
    return this.api
      .getArquivo(caminho)
      .pipe(map((resposta) => ({ conteudo: resposta.body!, nome: nomeDoArquivo(resposta) })));
  }

  private enviar<T>(caminho: string, arquivo: File): Observable<T> {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    return this.api.upload<T>(caminho, form).pipe(
      filter((evento) => evento.type === HttpEventType.Response),
      map((evento) => (evento as { body: T }).body),
    );
  }
}
