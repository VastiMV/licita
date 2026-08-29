/** Nome e ícone das plataformas que o backend registra
 * (`apps/integracoes/plataformas.py`) — o `id` é o contrato entre os dois.
 * Plataforma nova no backend = uma entrada aqui (com o favicon dela em
 * `public/plataformas/`). Plataforma fora desta tabela ainda aparece: usa o
 * nome que o PNCP deu e um ícone genérico.
 *
 * Mora fora do card (e não dentro dele) porque é o registro do domínio, não
 * um detalhe de layout: qualquer tela que precise nomear uma plataforma usa
 * esta tabela, e todas dão o mesmo nome. */
export const PLATAFORMAS: Record<string, { nome: string; icone: string }> = {
  compras_gov: { nome: 'Compras.gov.br', icone: 'plataformas/compras_gov.png' },
};
