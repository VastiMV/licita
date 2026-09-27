import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { QuadroCiclo } from '../../contracts/licitacoes/ciclo.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/** O quadro do Ciclo de Licitação — só leitura: quem move a licitação é o
 * trabalho feito nas telas de cada etapa, não o quadro. */
@Injectable({ providedIn: 'root' })
export class CicloService {
  private readonly api = inject(ApiClient);

  quadro(): Observable<QuadroCiclo> {
    return this.api.get<QuadroCiclo>(ENDPOINTS.licitacoes.ciclo);
  }
}
