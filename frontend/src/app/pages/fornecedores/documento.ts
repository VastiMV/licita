/**
 * Máscara e validação de CPF/CNPJ, CEP e telefone — as regras que o
 * formulário de fornecedor aplica enquanto se digita.
 *
 * Espelha `apps/fornecedores/documentos.py`, que é quem decide de verdade:
 * o backend revalida tudo, porque validação de tela é conveniência (dizer
 * "confira o dígito" antes de a pessoa clicar em salvar), nunca garantia.
 *
 * Funções puras, separadas do componente pra dar pra testar sem montar DOM
 * — igual `edital-card.utils.ts`.
 */

export const CNPJ_DIGITOS = 14;
export const CPF_DIGITOS = 11;

export function somenteDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Máscara progressiva: formata o que já foi digitado sem exigir o número
 * completo — quem digita "11.2" tem que ver "11.2", não um erro. Escolhe
 * CPF ou CNPJ pelo tamanho, então trocar o tipo no formulário não obriga a
 * apagar o campo. */
export function mascararDocumento(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, CNPJ_DIGITOS);

  if (digitos.length <= CPF_DIGITOS) {
    return digitos
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function mascararCep(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 8);
  return digitos.replace(/^(\d{5})(\d)/, '$1-$2');
}

/** Aceita fixo (10 dígitos) e celular (11) — o nono dígito muda onde o
 * hífen cai. */
export function mascararTelefone(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length <= 10) {
    return digitos.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digitos.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function digitoVerificador(digitos: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, indice) => total + Number(digitos[indice]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const PESOS_CNPJ = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function cnpjValido(valor: string): boolean {
  const digitos = somenteDigitos(valor);
  // Dígito repetido passa na conta do módulo 11 e é a digitação preguiçosa
  // mais comum — precisa cair aqui.
  if (digitos.length !== CNPJ_DIGITOS || new Set(digitos).size === 1) return false;

  const primeiro = digitoVerificador(digitos, PESOS_CNPJ);
  const segundo = digitoVerificador(`${digitos.slice(0, 12)}${primeiro}`, [6, ...PESOS_CNPJ]);
  return digitos.slice(12) === `${primeiro}${segundo}`;
}

export function cpfValido(valor: string): boolean {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== CPF_DIGITOS || new Set(digitos).size === 1) return false;

  const pesos = (inicio: number) => Array.from({ length: inicio - 1 }, (_, i) => inicio - i);
  const primeiro = digitoVerificador(digitos, pesos(10));
  const segundo = digitoVerificador(`${digitos.slice(0, 9)}${primeiro}`, pesos(11));
  return digitos.slice(9) === `${primeiro}${segundo}`;
}

/** O cadastro admite pessoa física (prestador autônomo) tanto quanto
 * empresa — os dois passam. */
export function documentoValido(valor: string): boolean {
  return cnpjValido(valor) || cpfValido(valor);
}
