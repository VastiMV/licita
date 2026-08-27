/** Funções puras de formatação do card de oportunidade — separadas do
 * componente pra dar pra testar sem montar DOM (ver handoff de design em
 * docs/Mockups/card_oportunidades/README.md). */

const MS_POR_DIA = 86_400_000;

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const REGEX_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const REGEX_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Só entende os dois formatos que o backend de fato manda (ISO do
 * PNCP/compras.gov.br, ou `dd/MM/yyyy` já formatado) — construído com
 * `Date(ano, mes, dia)` em vez de `new Date(string)` de propósito: a forma
 * "YYYY-MM-DD" crua vira meia-noite UTC e pode voltar um dia no fuso do
 * navegador. Formato não reconhecido -> `null` (sem chute). */
export function parseData(valor: string | null | undefined): Date | null {
  if (!valor) return null;

  const iso = REGEX_ISO.exec(valor);
  if (iso) {
    const [, ano, mes, dia] = iso;
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
  }

  const br = REGEX_BR.exec(valor);
  if (br) {
    const [, dia, mes, ano] = br;
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
  }

  return null;
}

/** `dd/MM/yyyy`. Se a data não for reconhecida, devolve o valor original em
 * vez de esconder a informação (ver `parseData`). */
export function formatarData(valor: string | null | undefined): string | null {
  const data = parseData(valor);
  return data ? FORMATADOR_DATA.format(data) : (valor ?? null);
}

/** `R$ 9.480,00` — o `Intl.NumberFormat` de verdade usa espaço não-quebrável
 * entre "R$" e o número; troca por espaço normal pra não ficar invisível ao
 * comparar/copiar o texto. */
export function formatarMoeda(valor: number | null | undefined): string | null {
  return valor == null ? null : FORMATADOR_MOEDA.format(valor).replace(' ', ' ');
}

/** Positivo = dias que faltam; negativo = dias desde o encerramento. `null`
 * quando a data de encerramento não vem ou não é reconhecida. */
export function diasRestantes(
  dataEncerramento: string | null | undefined,
  hoje = new Date(),
): number | null {
  const data = parseData(dataEncerramento);
  if (!data) return null;

  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((data.getTime() - inicioDeHoje.getTime()) / MS_POR_DIA);
}

export function estaEncerrada(
  dataEncerramento: string | null | undefined,
  hoje = new Date(),
): boolean {
  const dias = diasRestantes(dataEncerramento, hoje);
  return dias !== null && dias < 0;
}

/** % do intervalo publicação → encerramento já decorrido, limitado a 0–100
 * (spec do card, bloco "Propostas até"). Datas ausentes/inválidas -> 0 (barra
 * vazia, sem chutar progresso). */
export function progressoPercentual(
  dataPublicacao: string | null | undefined,
  dataEncerramento: string | null | undefined,
  hoje = new Date(),
): number {
  const inicio = parseData(dataPublicacao);
  const fim = parseData(dataEncerramento);
  if (!inicio || !fim || fim.getTime() <= inicio.getTime()) return 0;

  const decorrido = hoje.getTime() - inicio.getTime();
  const total = fim.getTime() - inicio.getTime();
  return Math.min(100, Math.max(0, Math.round((decorrido / total) * 100)));
}

// Siglas do domínio que não podem virar "Uasg", "Pncp" etc. quando o título
// (vindo em CAIXA ALTA do PNCP) é normalizado — ver `normalizarTitulo`.
const SIGLAS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO', // UFs
  'UASG',
  'PNCP',
  'CNPJ',
  'CPF',
  'CAPAG',
  'SRP',
  'TR',
  'ATA',
  'RDC',
  'ME',
  'EPP',
  'TI',
  'EAD',
  'CATSER',
  'CATMAT',
]);

function capitalizarInicioDeFrases(texto: string): string {
  return texto.replace(
    /(^|[.!?]\s+)([a-zà-ÿ])/gu,
    (_, prefixo: string, letra: string) => prefixo + letra.toUpperCase(),
  );
}

function restaurarSiglas(texto: string): string {
  return texto.replace(/\p{L}+/gu, (palavra) => {
    const maiuscula = palavra.toLocaleUpperCase('pt-BR');
    return SIGLAS.has(maiuscula) ? maiuscula : palavra;
  });
}

/** O objeto do edital vem em CAIXA ALTA quando a fonte é o PNCP, mas o
 * título do card nunca pode ser maiúsculo (spec do card, seção 6a). Heurística
 * best-effort — não é um normalizador de português completo: só age quando a
 * string inteira está em maiúsculas (uma vinda em outro caso fica como está)
 * e preserva uma lista pequena de siglas do domínio. */
export function normalizarTitulo(objeto: string | null | undefined): string {
  if (!objeto) return '—';
  if (/[a-zà-ÿ]/.test(objeto)) return objeto;

  const minusculo = objeto.toLocaleLowerCase('pt-BR');
  return restaurarSiglas(capitalizarInicioDeFrases(minusculo));
}
