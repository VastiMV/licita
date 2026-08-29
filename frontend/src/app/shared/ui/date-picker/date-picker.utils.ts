/**
 * Regras de calendário do `DatePickerComponent`, como funções puras —
 * separadas do componente pelo mesmo motivo de `edital-card.utils.ts`: dá
 * pra testar cada regra (virada de mês, ano bissexto, limites) sem montar
 * componente nenhum.
 *
 * Duas representações de data convivem aqui, de propósito:
 * - **valor** do controle: ISO `aaaa-mm-dd` — o mesmo que o
 *   `<input type="date">` nativo produzia e que o backend espera (ver
 *   `OportunidadeBuscaParams`). Como ISO ordena lexicograficamente igual a
 *   cronologicamente, comparação de intervalo é `<`/`>` de string mesmo.
 * - **exibição**: `dd/mm/aaaa`, que é o que o usuário brasileiro lê e digita.
 *
 * Tudo é data LOCAL. Nada de `toISOString()` aqui: ele converte pra UTC e
 * devolve o dia anterior pra quem está a oeste de Greenwich (todo o Brasil).
 */

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/** Cabeçalho da grade. Uma letra só, como no calendário de papel — o nome
 * inteiro vai no `aria-label` de cada dia, então leitor de tela não perde nada. */
export const DIAS_SEMANA_CURTOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

/** Um dia da grade. `null` no lugar da célula = espaço antes do dia 1 ou
 * depois do último (o mês vizinho não aparece, como no Material). */
export interface CelulaDia {
  readonly iso: string;
  readonly dia: number;
}

export type Semana = readonly (CelulaDia | null)[];

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function paraIso(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/** ISO -> `Date` local, ou `null` se não for uma data real (`2026-02-31`
 * tem o formato certo mas não existe — o `Date` estouraria pra 03/03). */
export function paraData(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  const real = data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  return real ? data : null;
}

export function hojeIso(): string {
  return paraIso(new Date());
}

/** ISO -> `dd/mm/aaaa`. Entrada inválida vira string vazia (o campo fica em
 * branco em vez de mostrar "NaN/NaN/NaN"). */
export function formatarBr(iso: string | null | undefined): string {
  const data = paraData(iso);
  if (!data) return '';
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()}`;
}

/** `dd/mm/aaaa` -> ISO, ou `null` enquanto o que foi digitado não for uma
 * data completa e real (é o caso a cada tecla, até fechar os 8 dígitos). */
export function parsearBr(texto: string): string | null {
  const casou = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!casou) return null;
  const [, dia, mes, ano] = casou;
  const iso = `${ano}-${mes}-${dia}`;
  return paraData(iso) ? iso : null;
}

/** Vai pondo as barras enquanto o usuário digita: `05092026` -> `05/09/2026`.
 * Só dígitos entram, no máximo 8 — colar lixo não quebra o campo. */
export function mascararBr(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)];
  return partes.filter((parte) => parte.length > 0).join('/');
}

export function somarDias(iso: string, dias: number): string {
  const data = paraData(iso);
  if (!data) return iso;
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

/** Soma meses preservando o dia quando ele existe no mês destino e grudando
 * no último dia quando não existe (31/01 + 1 mês = 28/02, não 03/03 — que é
 * o que o `Date` faria sozinho). */
export function somarMeses(iso: string, meses: number): string {
  const data = paraData(iso);
  if (!data) return iso;
  const dia = data.getDate();
  const destino = new Date(data.getFullYear(), data.getMonth() + meses, 1);
  destino.setDate(Math.min(dia, diasNoMes(destino.getFullYear(), destino.getMonth())));
  return paraIso(destino);
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

export function inicioDoMes(iso: string): string {
  const data = paraData(iso);
  return data ? paraIso(new Date(data.getFullYear(), data.getMonth(), 1)) : iso;
}

export function fimDoMes(iso: string): string {
  const data = paraData(iso);
  if (!data) return iso;
  return paraIso(new Date(data.getFullYear(), data.getMonth() + 1, 0));
}

/** `true` quando a data está fora de `[min, max]` — comparação de string
 * ISO, que já é cronológica. Limite ausente = sem limite daquele lado. */
export function foraDoIntervalo(
  iso: string,
  min: string | null | undefined,
  max: string | null | undefined,
): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
}

/** Empurra a data pra dentro de `[min, max]` — usado pra decidir em que dia
 * o calendário abre quando o valor atual é vazio ou está fora dos limites. */
export function limitar(
  iso: string,
  min: string | null | undefined,
  max: string | null | undefined,
): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/**
 * Grade do mês, linha a linha. `primeiroDiaSemana` é o índice do dia que
 * abre a semana (0 = domingo, 1 = segunda) — a mesma configuração que o
 * Material expõe, porque calendário de escritório às vezes começa na
 * segunda. Devolve só as linhas necessárias (4 a 6), sem completar com o
 * mês vizinho.
 */
export function semanasDoMes(ano: number, mes: number, primeiroDiaSemana = 0): Semana[] {
  const total = diasNoMes(ano, mes);
  const deslocamento = (new Date(ano, mes, 1).getDay() - primeiroDiaSemana + 7) % 7;

  const celulas: (CelulaDia | null)[] = Array<CelulaDia | null>(deslocamento).fill(null);
  for (let dia = 1; dia <= total; dia++) {
    celulas.push({ iso: `${ano}-${doisDigitos(mes + 1)}-${doisDigitos(dia)}`, dia });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas: Semana[] = [];
  for (let inicio = 0; inicio < celulas.length; inicio += 7) {
    semanas.push(celulas.slice(inicio, inicio + 7));
  }
  return semanas;
}

/** Cabeçalho da semana já rodado pelo `primeiroDiaSemana`. */
export function titulosDaSemana(primeiroDiaSemana = 0): string[] {
  return Array.from(
    { length: 7 },
    (_, indice) => DIAS_SEMANA_CURTOS[(indice + primeiroDiaSemana) % 7],
  );
}

/** "Sexta-feira, 4 de setembro de 2026" — `aria-label` de cada célula. */
export function rotuloPorExtenso(iso: string): string {
  const data = paraData(iso);
  if (!data) return '';
  const mes = MESES[data.getMonth()].toLowerCase();
  return `${DIAS_SEMANA[data.getDay()]}, ${data.getDate()} de ${mes} de ${data.getFullYear()}`;
}
