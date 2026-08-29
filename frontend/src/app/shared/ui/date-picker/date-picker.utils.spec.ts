import {
  foraDoIntervalo,
  formatarBr,
  limitar,
  mascararBr,
  paraData,
  parsearBr,
  rotuloPorExtenso,
  semanasDoMes,
  somarDias,
  somarMeses,
  titulosDaSemana,
} from './date-picker.utils';

describe('date-picker.utils', () => {
  describe('paraData', () => {
    it('recusa data que tem o formato certo mas não existe no calendário', () => {
      expect(paraData('2026-02-31')).toBeNull();
      expect(paraData('2026-13-01')).toBeNull();
      expect(paraData('04/09/2026')).toBeNull();
      expect(paraData('')).toBeNull();
    });

    it('interpreta como data local, não UTC (não anda um dia pra trás)', () => {
      const data = paraData('2026-09-04')!;
      expect(data.getDate()).toBe(4);
      expect(data.getMonth()).toBe(8);
      expect(data.getFullYear()).toBe(2026);
    });

    it('aceita 29/02 em ano bissexto e recusa em ano comum', () => {
      expect(paraData('2028-02-29')).not.toBeNull();
      expect(paraData('2026-02-29')).toBeNull();
    });
  });

  describe('formatarBr / parsearBr', () => {
    it('converte ISO para dd/mm/aaaa e de volta', () => {
      expect(formatarBr('2026-09-04')).toBe('04/09/2026');
      expect(parsearBr('04/09/2026')).toBe('2026-09-04');
    });

    it('devolve vazio/nulo pra entrada incompleta ou inválida', () => {
      expect(formatarBr('')).toBe('');
      expect(formatarBr(null)).toBe('');
      expect(parsearBr('04/09/20')).toBeNull();
      expect(parsearBr('31/02/2026')).toBeNull();
    });
  });

  describe('mascararBr', () => {
    it('coloca as barras conforme os dígitos entram', () => {
      expect(mascararBr('0')).toBe('0');
      expect(mascararBr('04')).toBe('04');
      expect(mascararBr('0409')).toBe('04/09');
      expect(mascararBr('04092026')).toBe('04/09/2026');
    });

    it('ignora o que não é dígito e trunca no oitavo', () => {
      expect(mascararBr('a4/x9/2026999')).toBe('49/20/2699');
      expect(mascararBr('04/09/2026')).toBe('04/09/2026');
    });
  });

  describe('somarDias / somarMeses', () => {
    it('vira mês e ano', () => {
      expect(somarDias('2026-08-29', 7)).toBe('2026-09-05');
      expect(somarDias('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('gruda no último dia quando o mês destino é mais curto', () => {
      expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
      expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28');
      expect(somarMeses('2026-09-04', 3)).toBe('2026-12-04');
    });
  });

  describe('foraDoIntervalo / limitar', () => {
    it('respeita cada limite, e ignora o lado que não foi informado', () => {
      expect(foraDoIntervalo('2026-09-04', '2026-09-05', null)).toBe(true);
      expect(foraDoIntervalo('2026-09-04', null, '2026-09-03')).toBe(true);
      expect(foraDoIntervalo('2026-09-04', '2026-09-01', '2026-09-30')).toBe(false);
      expect(foraDoIntervalo('2026-09-04', null, null)).toBe(false);
    });

    it('empurra a data pra dentro dos limites', () => {
      expect(limitar('2026-01-01', '2026-09-01', '2026-09-30')).toBe('2026-09-01');
      expect(limitar('2026-12-01', '2026-09-01', '2026-09-30')).toBe('2026-09-30');
      expect(limitar('2026-09-04', '2026-09-01', '2026-09-30')).toBe('2026-09-04');
    });
  });

  describe('semanasDoMes', () => {
    it('alinha o dia 1 no dia da semana certo, com vazios antes', () => {
      // 01/09/2026 é uma terça — com a semana começando no domingo, sobram
      // duas células vazias antes.
      const semanas = semanasDoMes(2026, 8);
      expect(semanas[0][0]).toBeNull();
      expect(semanas[0][1]).toBeNull();
      expect(semanas[0][2]).toEqual({ iso: '2026-09-01', dia: 1 });
    });

    it('roda o alinhamento quando a semana começa na segunda', () => {
      const semanas = semanasDoMes(2026, 8, 1);
      expect(semanas[0][0]).toBeNull();
      expect(semanas[0][1]).toEqual({ iso: '2026-09-01', dia: 1 });
    });

    it('cobre todos os dias do mês, em linhas de 7', () => {
      const semanas = semanasDoMes(2026, 1); // fevereiro/2026, 28 dias
      const dias = semanas.flat().filter((celula) => celula !== null);
      expect(dias).toHaveLength(28);
      expect(dias.at(-1)).toEqual({ iso: '2026-02-28', dia: 28 });
      for (const semana of semanas) expect(semana).toHaveLength(7);
    });
  });

  it('titulosDaSemana começa no dia configurado', () => {
    expect(titulosDaSemana()).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
    expect(titulosDaSemana(1)[0]).toBe('S');
    expect(titulosDaSemana(6)[0]).toBe('S');
  });

  it('rotuloPorExtenso descreve a data em português', () => {
    expect(rotuloPorExtenso('2026-09-04')).toBe('Sexta-feira, 4 de setembro de 2026');
  });
});
