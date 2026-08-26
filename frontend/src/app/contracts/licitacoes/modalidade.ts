import type { SelectOption } from '../../shared/ui/select/select.component';

/**
 * Modalidades de licitação (Lei 14.133) tal como o compras.gov.br as
 * codifica. Único lugar que declara esse mapeamento — o `<app-select>` de
 * modalidade, em qualquer página, importa daqui.
 */
export const MODALIDADES: readonly SelectOption[] = [
  { value: '1', label: 'Leilão - Eletrônico' },
  { value: '2', label: 'Diálogo Competitivo' },
  { value: '3', label: 'Concurso' },
  { value: '4', label: 'Concorrência - Eletrônica' },
  { value: '5', label: 'Concorrência - Presencial' },
  { value: '6', label: 'Pregão - Eletrônico' },
  { value: '7', label: 'Pregão - Presencial' },
  { value: '8', label: 'Dispensa de Licitação' },
  { value: '9', label: 'Inexigibilidade' },
  { value: '10', label: 'Manifestação de Interesse' },
  { value: '11', label: 'Pré-qualificação' },
  { value: '12', label: 'Credenciamento' },
  { value: '13', label: 'Leilão - Presencial' },
];
