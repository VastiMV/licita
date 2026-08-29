/** Nome e ícone das plataformas que o backend registra
 * (`apps/integracoes/plataformas.py`) — o `id` é o contrato entre os dois.
 * Plataforma nova no backend = uma entrada aqui (com o favicon dela em
 * `public/plataformas/`). Plataforma fora desta tabela ainda aparece: usa o
 * nome que o PNCP deu e um ícone genérico.
 *
 * Mora fora do card porque a tabela de oportunidades salvas mostra a mesma
 * coluna "Plataforma" — e as duas telas têm que dar o mesmo nome. */
export const PLATAFORMAS: Record<string, { nome: string; icone: string }> = {
  compras_gov: { nome: 'Compras.gov.br', icone: 'plataformas/compras_gov.png' },
};

/** Nome de exibição de uma plataforma: o do registro quando conhecida, o que
 * a origem informou quando não, e o próprio id como último recurso (melhor
 * um identificador do que uma coluna vazia). */
export function nomePlataforma(id: string | null, informado?: string | null): string {
  const registrada = id ? PLATAFORMAS[id] : undefined;
  return registrada?.nome ?? informado ?? id ?? '—';
}
