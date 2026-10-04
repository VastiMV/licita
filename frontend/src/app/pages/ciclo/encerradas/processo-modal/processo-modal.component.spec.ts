import {
  EventoDoProcesso,
  ProcessoResponse,
} from '../../../../contracts/licitacoes/encerrada.contracts';
import { estadoDaFase, nosDaEtapa, narrar } from './processo.model';

function evento(
  tipo: string,
  etapa: 'oportunidade' | 'cotacao',
  valor: number | null = null,
  autor: string | null = 'Ana Souza',
): EventoDoProcesso {
  return {
    id: Math.random(),
    tipo,
    etapa,
    texto: tipo,
    autor,
    data: '2026-09-01T12:00:00Z',
    valor,
  };
}

const PROCESSO: ProcessoResponse = {
  id: 1,
  etapa: 'cotacao',
  desfecho: {
    tipo: 'prazo_cotacao',
    data: '2026-09-14',
    por: null,
    porque: 'A cotação estava pronta, mas nenhuma proposta foi registrada.',
  },
  eventos: [
    evento('oportunidade_salva', 'oportunidade'),
    evento('cotacao_criada', 'cotacao', 100),
    evento('cotacao_atualizada', 'cotacao', 200),
    evento('cotacao_atualizada', 'cotacao', 300),
    evento('cotacao_atualizada', 'cotacao', 400),
    evento('cotacao_atualizada', 'cotacao', 500),
    evento('prazo_encerrado', 'cotacao', null, null),
  ],
};

describe('processo.model', () => {
  it('três ou mais atualizações seguidas viram um bloco e a última fica à mostra', () => {
    const nos = nosDaEtapa(PROCESSO.eventos.filter((e) => e.etapa === 'cotacao'));

    expect(nos.map((n) => n.tipo)).toEqual(['evento', 'grupo', 'evento', 'evento']);
    expect(nos[1].tipo === 'grupo' && nos[1].eventos).toHaveLength(3);
    expect(nos[2].tipo === 'evento' && nos[2].evento.texto).toBe('Última atualização da cotação');
  });

  it('fases antes da atual estão feitas; a atual parou com a cor do desfecho; as outras não alcançadas', () => {
    expect(estadoDaFase(PROCESSO, 0).classe).toBe('feita');
    expect(estadoDaFase(PROCESSO, 1)).toEqual(
      expect.objectContaining({ classe: 'parou', rotulo: 'Parou aqui', familia: 'alerta' }),
    );
    expect(estadoDaFase(PROCESSO, 2).classe).toBe('depois');
  });

  it('a narração da fase em que parou traz o porquê', () => {
    const cab = { valor_total_estimado: 1000, data_encerramento_proposta: '2026-09-14' } as never;

    const n = narrar(PROCESSO, cab, 1);

    expect(n.pontos[0]).toContain('Cotação criada');
    expect(n.pontos.some((p) => p.includes('5 salvamentos'))).toBe(true);
    expect(n.pontos.some((p) => p.includes('50% do estimado'))).toBe(true);
    expect(n.porque).toContain('nenhuma proposta');
    expect(narrar(PROCESSO, cab, 3).porque).toBeNull();
  });
});
