/** O que o card de oportunidade precisa receber pronto — compartilhado
 * pelas duas telas que desenham o mesmo card: a busca (`pesquisar`) e o
 * modal de visualização das salvas (`salvas`).
 *
 * Fica aqui, e não na página, porque o card é de quem exibe: a busca monta
 * `EditalCard` agrupando o resultado da API; as salvas montam o mesmo
 * `EditalCard` a partir do snapshot gravado ao salvar. Nenhuma das duas
 * conhece o formato interno da outra.
 */

import { OportunidadeResponse } from '../../../contracts/licitacoes/oportunidade.contracts';

/** Um card = um edital. A busca devolve 1 linha por item batido (mesmo
 * edital repete se mais de um item casar); o agrupamento em card é de tela,
 * o backend continua devolvendo a lista flat (ver `OportunidadeResponse`). */
export interface EditalCard {
  readonly chave: string;
  readonly contratacao: OportunidadeResponse;
  readonly itens: readonly OportunidadeResponse[];
}

/** Documentos + CAPAG + plataforma de origem de um card, buscados em
 * `apps.licitacoes.CompraDetalheView`. */
export interface DetalheEstado {
  readonly carregando: boolean;
  readonly documentos: readonly {
    titulo: string | null;
    tipo_documento: string | null;
    url: string | null;
  }[];
  readonly capag: { nota: string; cor: 'verde' | 'amarelo' | 'vermelho' } | null;
  /** Onde a compra de fato acontece — corrige o palpite `link_plataforma`
   * da busca (o PNCP agrega todas as plataformas, ver docs/DOMINIO.md). */
  readonly plataforma: { id: string | null; nome: string | null; link: string } | null;
  readonly erro: boolean;
}

/** Identidade da compra no PNCP — a mesma chave que o backend guarda em
 * `OportunidadeSalva.chave`, e é por ela que a busca sabe que um edital já
 * está salvo. */
export function chaveEdital(op: OportunidadeResponse): string {
  const { contratacao_cnpj_orgao, contratacao_ano_compra, contratacao_sequencial_compra } = op;
  if (contratacao_cnpj_orgao && contratacao_ano_compra && contratacao_sequencial_compra) {
    return `${contratacao_cnpj_orgao}-${contratacao_ano_compra}-${contratacao_sequencial_compra}`;
  }
  // Identificador incompleto (degradação do PNCP, ver docs/DOMINIO.md) — cada
  // item vira o card dele mesmo, em vez de agrupar errado.
  return `${op.contratacao_uasg ?? '?'}-${op.numero_item ?? '?'}`;
}

export function agruparPorEdital(resultados: readonly OportunidadeResponse[]): EditalCard[] {
  const grupos = new Map<string, OportunidadeResponse[]>();
  for (const op of resultados) {
    const chave = chaveEdital(op);
    const itens = grupos.get(chave);
    if (itens) {
      itens.push(op);
    } else {
      grupos.set(chave, [op]);
    }
  }
  return Array.from(grupos, ([chave, itens]) => ({ chave, contratacao: itens[0], itens }));
}
