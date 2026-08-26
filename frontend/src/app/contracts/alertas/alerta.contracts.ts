/** Contrato de `Alerta` — ver docs/DOMINIO.md no repositório principal. */
export interface AlertaResponse {
  readonly id: number;
  readonly criado_em: string;
  readonly email_enviado: boolean;
  readonly filtro: { readonly id: number; readonly nome: string };
  readonly licitacao: {
    readonly id: string;
    readonly objeto: string | null;
    readonly uasg: string;
  };
}
