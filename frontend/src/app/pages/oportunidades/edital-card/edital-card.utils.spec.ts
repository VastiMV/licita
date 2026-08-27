import {
  diasRestantes,
  estaEncerrada,
  formatarData,
  formatarMoeda,
  normalizarTitulo,
  parseData,
  progressoPercentual,
} from './edital-card.utils';

const HOJE = new Date(2026, 7, 27); // 27/08/2026

describe('parseData', () => {
  it('entende data ISO (YYYY-MM-DD)', () => {
    expect(parseData('2026-09-01')).toEqual(new Date(2026, 8, 1));
  });

  it('entende data ISO com horário', () => {
    expect(parseData('2026-09-01T00:00:00Z')).toEqual(new Date(2026, 8, 1));
  });

  it('entende data já formatada em dd/MM/yyyy', () => {
    expect(parseData('01/09/2026')).toEqual(new Date(2026, 8, 1));
  });

  it('formato não reconhecido ou vazio vira null', () => {
    expect(parseData('não é uma data')).toBeNull();
    expect(parseData(null)).toBeNull();
    expect(parseData(undefined)).toBeNull();
  });
});

describe('formatarData', () => {
  it('formata em pt-BR', () => {
    expect(formatarData('2026-09-01')).toBe('01/09/2026');
  });

  it('valor não reconhecido volta como veio, em vez de sumir', () => {
    expect(formatarData('data esquisita')).toBe('data esquisita');
  });

  it('nulo vira null', () => {
    expect(formatarData(null)).toBeNull();
  });
});

describe('formatarMoeda', () => {
  it('formata em R$ pt-BR', () => {
    expect(formatarMoeda(9480)).toBe('R$ 9.480,00');
  });

  it('nulo/undefined viram null', () => {
    expect(formatarMoeda(null)).toBeNull();
    expect(formatarMoeda(undefined)).toBeNull();
  });
});

describe('diasRestantes', () => {
  it('positivo quando a data é no futuro', () => {
    expect(diasRestantes('2026-09-01', HOJE)).toBe(5);
  });

  it('negativo quando a data já passou', () => {
    expect(diasRestantes('2026-08-01', HOJE)).toBe(-26);
  });

  it('zero no próprio dia', () => {
    expect(diasRestantes('2026-08-27', HOJE)).toBe(0);
  });

  it('null quando não dá pra reconhecer a data', () => {
    expect(diasRestantes(null, HOJE)).toBeNull();
  });
});

describe('estaEncerrada', () => {
  it('true quando o encerramento já passou', () => {
    expect(estaEncerrada('2026-08-01', HOJE)).toBe(true);
  });

  it('false no próprio dia ou no futuro', () => {
    expect(estaEncerrada('2026-08-27', HOJE)).toBe(false);
    expect(estaEncerrada('2026-09-01', HOJE)).toBe(false);
  });

  it('false quando não sabe a data (não inventa encerramento)', () => {
    expect(estaEncerrada(null, HOJE)).toBe(false);
  });
});

describe('progressoPercentual', () => {
  it('calcula o % do intervalo publicação -> encerramento já decorrido', () => {
    // publicado 26/08, encerra 01/09 (7 dias), hoje é 27/08 (1 dia decorrido)
    expect(progressoPercentual('2026-08-26', '2026-09-02', HOJE)).toBe(14);
  });

  it('limita em 0–100', () => {
    expect(progressoPercentual('2026-01-01', '2026-01-10', HOJE)).toBe(100);
    expect(progressoPercentual('2026-12-01', '2026-12-10', HOJE)).toBe(0);
  });

  it('datas ausentes ou invertidas viram 0 (barra vazia, sem chutar)', () => {
    expect(progressoPercentual(null, '2026-09-01', HOJE)).toBe(0);
    expect(progressoPercentual('2026-09-01', '2026-08-01', HOJE)).toBe(0);
  });
});

describe('normalizarTitulo', () => {
  it('converte CAIXA ALTA pra sentence case', () => {
    expect(normalizarTitulo('AQUISIÇÃO DE MATERIAL DE LIMPEZA')).toBe(
      'Aquisição de material de limpeza',
    );
  });

  it('preserva siglas conhecidas do domínio', () => {
    expect(normalizarTitulo('LOCAÇÃO DE MÁQUINA PARA O ESTANDE EM GO, UASG 989571')).toBe(
      'Locação de máquina para o estande em GO, UASG 989571',
    );
  });

  it('capitaliza depois de ponto final', () => {
    expect(normalizarTitulo('ITEM 1. ENTREGA IMEDIATA')).toBe('Item 1. Entrega imediata');
  });

  it('string que já não é toda maiúscula fica como veio', () => {
    expect(normalizarTitulo('Aquisição de Notebooks')).toBe('Aquisição de Notebooks');
  });

  it('vazio/nulo vira travessão', () => {
    expect(normalizarTitulo(null)).toBe('—');
    expect(normalizarTitulo('')).toBe('—');
  });
});
