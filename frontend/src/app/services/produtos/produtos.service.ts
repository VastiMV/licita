import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  FabricanteRequest,
  FabricanteResponse,
  FabricantesPagina,
  FabricantesParams,
  MarcaResponse,
  ModeloResponse,
  OpcaoProduto,
  PrecoSugerido,
} from '../../contracts/produtos/produto.contracts';
import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';

/** Cadastro de produtos e a tabela de preços (ver `apps/produtos`). Criar
 * é idempotente em todos os níveis — o backend devolve o existente. */
@Injectable({ providedIn: 'root' })
export class ProdutosService {
  private readonly api = inject(ApiClient);
  private readonly rotas = ENDPOINTS.produtos;

  listar(params: FabricantesParams = {}): Observable<FabricantesPagina> {
    return this.api.get<FabricantesPagina>(this.rotas.fabricantes, { ...params });
  }

  fabricante(id: number): Observable<FabricanteResponse> {
    return this.api.get<FabricanteResponse>(this.rotas.fabricante(id));
  }

  criarFabricante(dados: FabricanteRequest): Observable<FabricanteResponse> {
    return this.api.post<FabricanteResponse, FabricanteRequest>(this.rotas.fabricantes, dados);
  }

  atualizarFabricante(id: number, dados: FabricanteRequest): Observable<FabricanteResponse> {
    return this.api.put<FabricanteResponse, FabricanteRequest>(this.rotas.fabricante(id), dados);
  }

  removerFabricante(id: number): Observable<void> {
    return this.api.delete<void>(this.rotas.fabricante(id));
  }

  criarMarca(fabricante: number, nome: string): Observable<MarcaResponse> {
    return this.api.post<MarcaResponse, object>(this.rotas.marcas, { fabricante, nome });
  }

  renomearMarca(id: number, nome: string): Observable<MarcaResponse> {
    return this.api.put<MarcaResponse, object>(this.rotas.marca(id), { nome });
  }

  removerMarca(id: number): Observable<void> {
    return this.api.delete<void>(this.rotas.marca(id));
  }

  criarModelo(marca: number, nome: string): Observable<ModeloResponse> {
    return this.api.post<ModeloResponse, object>(this.rotas.modelos, { marca, nome });
  }

  renomearModelo(id: number, nome: string): Observable<ModeloResponse> {
    return this.api.put<ModeloResponse, object>(this.rotas.modelo(id), { nome });
  }

  removerModelo(id: number): Observable<void> {
    return this.api.delete<void>(this.rotas.modelo(id));
  }

  /** Com `fornecedor`, os fabricantes que ele vende vêm primeiro (`afim`). */
  opcoesFabricante(busca: string, fornecedor: number | null): Observable<readonly OpcaoProduto[]> {
    return this.api.get<readonly OpcaoProduto[]>(this.rotas.fabricantesOpcoes, {
      busca,
      ...(fornecedor ? { fornecedor } : {}),
    });
  }

  opcoesMarca(fabricante: number, busca: string): Observable<readonly OpcaoProduto[]> {
    return this.api.get<readonly OpcaoProduto[]>(this.rotas.marcasOpcoes, { fabricante, busca });
  }

  opcoesModelo(marca: number, busca: string): Observable<readonly OpcaoProduto[]> {
    return this.api.get<readonly OpcaoProduto[]>(this.rotas.modelosOpcoes, { marca, busca });
  }

  /** Último custo desse fornecedor para esse modelo; `null` se nunca cotado. */
  precoSugerido(fornecedor: number, modelo: number): Observable<PrecoSugerido | null> {
    return this.api.get<PrecoSugerido | null>(this.rotas.precoSugerido, { fornecedor, modelo });
  }
}
