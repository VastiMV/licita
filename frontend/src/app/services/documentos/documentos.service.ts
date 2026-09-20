import { HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

import {
  DocumentoResponse,
  DocumentosResposta,
  EventoDocumento,
  NovaVersao,
  ProgressoUpload,
  TipoDocumento,
  VersaoCriada,
  VersaoDocumento,
} from '../../contracts/documentos/documento.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * O dossiê de habilitação da empresa (ver `apps/documentos`).
 *
 * O upload emite progresso real do `HttpClient` — não uma barra animada: um
 * balanço de 20 MB leva o tempo que leva, e inventar a porcentagem é pior do
 * que não mostrar nenhuma.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly api = inject(ApiClient);

  listar(empresaId: number): Observable<DocumentosResposta> {
    return this.api.get<DocumentosResposta>(ENDPOINTS.documentos.lista, { empresa: empresaId });
  }

  tipos(): Observable<readonly TipoDocumento[]> {
    return this.api.get<readonly TipoDocumento[]>(ENDPOINTS.documentos.tipos);
  }

  /** Abre uma vaga nova. As obrigatórias já vêm abertas quando a empresa é
   * cadastrada — isto é para o opcional e para o "outro documento". */
  abrirVaga(empresaId: number, tipoId: number, titulo = ''): Observable<DocumentoResponse> {
    return this.api.post<DocumentoResponse>(ENDPOINTS.documentos.lista, {
      empresa: empresaId,
      tipo: tipoId,
      titulo,
    });
  }

  versoes(documentoId: number): Observable<readonly VersaoDocumento[]> {
    return this.api.get<readonly VersaoDocumento[]>(ENDPOINTS.documentos.versoes(documentoId));
  }

  eventos(documentoId: number): Observable<readonly EventoDocumento[]> {
    return this.api.get<readonly EventoDocumento[]>(ENDPOINTS.documentos.eventos(documentoId));
  }

  /** Envia o arquivo e emite o progresso até o resultado. */
  enviarVersao(documentoId: number, nova: NovaVersao): Observable<ProgressoUpload> {
    const form = new FormData();
    form.append('arquivo', nova.arquivo, nova.arquivo.name);
    for (const campo of ['numero', 'emissao', 'validade', 'nota'] as const) {
      const valor = nova[campo];
      if (valor) form.append(campo, valor);
    }

    return this.api.upload<VersaoCriada>(ENDPOINTS.documentos.versoes(documentoId), form).pipe(
      map((evento) => {
        if (evento.type === HttpEventType.UploadProgress) {
          // `total` pode não vir (servidor sem Content-Length no request):
          // nesse caso não há porcentagem honesta a mostrar.
          const pct = evento.total ? Math.round((100 * evento.loaded) / evento.total) : 0;
          return { pct };
        }
        if (evento.type === HttpEventType.Response) {
          return { pct: 100, resultado: evento.body as VersaoCriada };
        }
        return null;
      }),
      filter((progresso): progresso is ProgressoUpload => progresso !== null),
    );
  }

  /** Arquiva — não apaga. O documento sai das listas e continua preso ao
   * processo em que foi usado. */
  arquivar(documentoId: number): Observable<DocumentoResponse> {
    return this.api.delete<DocumentoResponse>(ENDPOINTS.documentos.detalhe(documentoId));
  }

  restaurar(documentoId: number): Observable<DocumentoResponse> {
    return this.api.post<DocumentoResponse, undefined>(
      ENDPOINTS.documentos.restaurar(documentoId),
      undefined,
    );
  }

  /** O backend devolve uma URL assinada de curta duração — o bucket nunca é
   * público, então não existe link fixo para o arquivo. */
  urlDeDownload(versaoId: number): Observable<{ url: string; nome: string }> {
    return this.api.get<{ url: string; nome: string }>(ENDPOINTS.documentos.download(versaoId));
  }
}
