import { EventoProcesso } from '../../../../contracts/licitacoes/encerrada.contracts';
import { montarMarcos } from './processo-modal.component';

function evento(tipo: string, descricao: string, autor: string | null = 'Vasti'): EventoProcesso {
  return {
    id: Math.random(),
    tipo,
    tipo_label: tipo === 'salva' ? 'Oportunidade salva' : 'Prazo de proposta encerrado',
    descricao,
    autor,
    dados: {},
    ocorrido_em: '2026-09-01T12:00:00Z',
  };
}

describe('montarMarcos', () => {
  it('salvamentos seguidos da cotação viram uma linha com o último valor', () => {
    const marcos = montarMarcos([
      evento('salva', 'Oportunidade salva por Vasti.'),
      evento('proposta_gerada', 'Cotação criada — R$ 4923.97.'),
      evento('proposta_gerada', 'Cotação atualizada — R$ 6565.29.'),
      evento('proposta_gerada', 'Cotação atualizada — R$ 351296.23.'),
      evento('prazo_vencido', 'Prazo encerrado em 14/09/2026.', null),
    ]);

    expect(marcos.map((m) => m.titulo)).toEqual([
      'Oportunidade salva',
      'Cotação salva 3 vezes',
      'Prazo de proposta encerrado',
    ]);
    expect(marcos[1].descricao).toContain('351296.23');
    expect(marcos[2].sistema).toBe(true);
  });
});
