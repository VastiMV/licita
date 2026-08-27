import type { SelectOption } from '../../shared/ui/select/select.component';

/**
 * Modalidades aceitas pelo filtro `codigoModalidade` do compras.gov.br (é
 * pra lá que esse valor vai — ver `LicitacoesService`). NÃO é a tabela
 * "oficial" de modalidades da Lei 14.133 que o PNCP usa (ali "6" é Pregão
 * Eletrônico; aqui é Dispensa) — são numerações diferentes entre as duas
 * fontes de dados, confirmado contra a API real em 26/08/2026 (ver
 * docs/DOMINIO.md e `MODALIDADES_CONTRATACOES` no backend,
 * apps/integracoes/clients/compras_gov.py). Varridos os 13 códigos que a
 * tabela do PNCP tem contra um ano inteiro de dados reais; só estes quatro
 * devolveram algum registro — os outros nove são aceitos sem erro pela API,
 * mas nunca trazem resultado, por isso não entram aqui.
 */
export const MODALIDADES: readonly SelectOption[] = [
  { value: '3', label: 'Concorrência - Eletrônica' },
  { value: '5', label: 'Pregão - Eletrônico' },
  { value: '6', label: 'Dispensa' },
  { value: '7', label: 'Inexigibilidade' },
];
