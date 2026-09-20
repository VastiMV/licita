/**
 * Contratos da configuração de armazenamento — ver `apps/armazenamento` no
 * backend.
 *
 * A forma aqui é incomum de propósito: **o frontend não conhece Cloudflare
 * R2 nem S3**. Ele pergunta ao backend quais drivers estão instalados e
 * quais campos cada um precisa (`DriverArmazenamento.campos`), e desenha o
 * formulário a partir disso. Um driver novo, instalado como pacote no
 * backend, aparece na tela sem uma linha de Angular.
 */

export interface CampoDriver {
  readonly nome: string;
  readonly rotulo: string;
  readonly obrigatorio: boolean;
  /** Entra e não volta: o backend nunca devolve o valor, só se está definido. */
  readonly segredo: boolean;
  readonly ajuda: string;
  readonly placeholder: string;
}

export interface DriverArmazenamento {
  readonly chave: string;
  readonly rotulo: string;
  readonly campos: readonly CampoDriver[];
}

export interface ConfigArmazenamento {
  readonly driver: string;
  /** Os campos não secretos, como o driver os nomeou. */
  readonly opcoes: Record<string, string>;
  /** Nomes dos segredos já gravados — nunca os valores. */
  readonly segredos_definidos: readonly string[];
  readonly segredos_definidos_em: string | null;
  /** Todo campo obrigatório preenchido — é o que libera o envio de documentos. */
  readonly completa: boolean;
  readonly testado_em: string | null;
  readonly atualizado_em: string;
}

/** O `PUT`: só os segredos que a pessoa digitou agora vão em `segredos` —
 * campo em branco não apaga o que já está gravado. */
export interface ConfigArmazenamentoRequest {
  readonly driver: string;
  readonly opcoes: Record<string, string>;
  readonly segredos: Record<string, string>;
}

export interface ResultadoTeste {
  readonly ok: boolean;
  readonly erro?: string;
}
