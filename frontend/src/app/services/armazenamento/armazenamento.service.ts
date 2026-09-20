import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ConfigArmazenamento,
  ConfigArmazenamentoRequest,
  DriverArmazenamento,
  ResultadoTeste,
} from '../../contracts/armazenamento/armazenamento.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/**
 * Onde os arquivos deste cliente são gravados (ver `apps/armazenamento`).
 *
 * Só administrador chega aqui — o backend responde 403 para o resto.
 */
@Injectable({ providedIn: 'root' })
export class ArmazenamentoService {
  private readonly api = inject(ApiClient);

  /** O que está instalado no backend e o que cada driver precisa. É a lista
   * que monta o seletor e o formulário. */
  drivers(): Observable<readonly DriverArmazenamento[]> {
    return this.api.get<readonly DriverArmazenamento[]>(ENDPOINTS.armazenamento.drivers);
  }

  /** `null` quando ainda não há configuração — estado normal da tela, não erro. */
  config(): Observable<ConfigArmazenamento | null> {
    return this.api.get<ConfigArmazenamento | null>(ENDPOINTS.armazenamento.config);
  }

  salvar(config: ConfigArmazenamentoRequest): Observable<ConfigArmazenamento> {
    return this.api.put<ConfigArmazenamento, ConfigArmazenamentoRequest>(
      ENDPOINTS.armazenamento.config,
      config,
    );
  }

  /** Grava um byte, lê de volta e apaga. Falha vem com a mensagem do
   * provedor já traduzida pelo backend — é o texto que a tela mostra. */
  testar(): Observable<ResultadoTeste> {
    return this.api.post<ResultadoTeste, undefined>(ENDPOINTS.armazenamento.testar, undefined);
  }
}
