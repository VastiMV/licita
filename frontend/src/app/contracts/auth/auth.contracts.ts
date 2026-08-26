/**
 * Contratos da API de autenticação — o formato exato que o backend espera
 * receber (`*Request`) e devolve (`*Response`). Ficam separados dos modelos
 * de UI de propósito: se o campo mudar de nome na API, o ajuste é só aqui.
 */

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly access: string;
}

export interface RefreshResponse {
  readonly access: string;
}
