import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Único ponto de contato com `HttpClient` no projeto. Nenhum serviço de
 * domínio (`FiltrosService`, `LicitacoesService`, ...) injeta `HttpClient`
 * diretamente — todos passam por aqui, para que o prefixo da API, a
 * montagem de query params e o tratamento de payload fiquem num só lugar.
 *
 * O prefixo é relativo (`/api`) de propósito: em produção o Ingress serve
 * frontend e backend sob o mesmo domínio, então não há CORS a configurar; em
 * desenvolvimento, `proxy.conf.json` encaminha `/api` para o backend local.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  get<TResponse>(path: string, queryParams?: Record<string, unknown>): Observable<TResponse> {
    return this.http.get<TResponse>(this.url(path), { params: this.buildParams(queryParams) });
  }

  post<TResponse, TRequest = unknown>(path: string, body: TRequest): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(path), body);
  }

  patch<TResponse, TRequest = unknown>(path: string, body: TRequest): Observable<TResponse> {
    return this.http.patch<TResponse>(this.url(path), body);
  }

  delete<TResponse = void>(path: string): Observable<TResponse> {
    return this.http.delete<TResponse>(this.url(path));
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\//, '')}`;
  }

  /** Remove chaves vazias (`''`, `null`, `undefined`) — filtros opcionais de busca não viram `?campo=` na URL. */
  private buildParams(queryParams?: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(queryParams ?? {})) {
      if (value === '' || value === null || value === undefined) continue;
      params = params.set(key, String(value));
    }
    return params;
  }
}
