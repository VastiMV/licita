import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CotacaoRequest } from '../../contracts/cotador/cotacao.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { CotadorService, PlanilhaBaixada } from './cotador.service';

const COTACAO = {
  titulo: 'Cotação',
  transporte: 8,
  garantia: 0,
  lucro_minimo: 10,
  lucro_maximo: 35,
  impostos: 10,
  itens: [],
  oportunidade_id: 3,
} as unknown as CotacaoRequest;

function respostaDeArquivo(disposition: string | null): HttpResponse<Blob> {
  return new HttpResponse({
    body: new Blob(['x']),
    headers: new HttpHeaders(disposition ? { 'Content-Disposition': disposition } : {}),
  });
}

describe('CotadorService', () => {
  let service: CotadorService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getArquivo: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      get: vi.fn(() => of({})),
      post: vi.fn(() => of({})),
      delete: vi.fn(() => of(undefined)),
      getArquivo: vi.fn(() => of(respostaDeArquivo('attachment; filename="proposta-925997.xlsx"'))),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(CotadorService);
  });

  it('salvar() posta na coleção — cria ou sobrescreve, o backend decide', () => {
    service.salvar(COTACAO).subscribe();

    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.cotador.cotacoes, COTACAO);
  });

  it('carregarDaOportunidade() usa a rota pela oportunidade, não pelo id da cotação', () => {
    service.carregarDaOportunidade(3).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.cotador.cotacaoDaOportunidade(3));
  });

  it('exportar() devolve o blob e o nome que veio no Content-Disposition', () => {
    let baixada: PlanilhaBaixada | undefined;
    service.exportar(9).subscribe((resultado) => (baixada = resultado));

    expect(api.getArquivo).toHaveBeenCalledWith(ENDPOINTS.cotador.planilha(9));
    expect(baixada?.nome).toBe('proposta-925997.xlsx');
  });

  it('sem Content-Disposition o arquivo ainda ganha um nome utilizável', () => {
    api.getArquivo.mockReturnValue(of(respostaDeArquivo(null)));

    let baixada: PlanilhaBaixada | undefined;
    service.exportar(9).subscribe((resultado) => (baixada = resultado));

    expect(baixada?.nome).toBe('proposta.xlsx');
  });

  it('remover() apaga só a cotação', () => {
    service.remover(9).subscribe();

    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.cotador.cotacao(9));
  });
});
