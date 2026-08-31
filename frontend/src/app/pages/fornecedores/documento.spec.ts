import {
  cnpjValido,
  cpfValido,
  documentoValido,
  mascararCep,
  mascararDocumento,
  mascararTelefone,
  somenteDigitos,
} from './documento';

// Documentos sintéticos, com dígito verificador correto — os mesmos de
// `apps/fornecedores/test_documentos.py`, para as duas implementações
// ficarem ancoradas no mesmo caso.
const CNPJ_OK = '11222333000181';
const CPF_OK = '52998224725';

describe('somenteDigitos', () => {
  it('tira a pontuação da máscara', () => {
    expect(somenteDigitos('11.222.333/0001-81')).toBe(CNPJ_OK);
  });

  it('não estoura com vazio', () => {
    expect(somenteDigitos('')).toBe('');
  });
});

describe('mascararDocumento', () => {
  it('formata CPF completo', () => {
    expect(mascararDocumento(CPF_OK)).toBe('529.982.247-25');
  });

  it('formata CNPJ completo', () => {
    expect(mascararDocumento(CNPJ_OK)).toBe('11.222.333/0001-81');
  });

  it('formata o que já foi digitado, sem exigir o número inteiro', () => {
    expect(mascararDocumento('112')).toBe('112');
    expect(mascararDocumento('11222')).toBe('112.22');
  });

  it('descarta o que passa de 14 dígitos', () => {
    expect(somenteDigitos(mascararDocumento('1122233300018199'))).toHaveLength(14);
  });
});

describe('máscaras de CEP e telefone', () => {
  it('formata CEP', () => {
    expect(mascararCep('13010000')).toBe('13010-000');
  });

  it('formata fixo e celular com o hífen no lugar certo', () => {
    expect(mascararTelefone('1932221100')).toBe('(19) 3222-1100');
    expect(mascararTelefone('19998887766')).toBe('(19) 99888-7766');
  });
});

describe('dígito verificador', () => {
  it('aceita CNPJ e CPF válidos', () => {
    expect(cnpjValido(CNPJ_OK)).toBe(true);
    expect(cpfValido(CPF_OK)).toBe(true);
  });

  it('aceita com máscara também', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });

  it('recusa dígito trocado', () => {
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cpfValido('52998224724')).toBe(false);
  });

  it('recusa dígitos repetidos, que passam no módulo 11', () => {
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
  });

  it('recusa tamanho errado', () => {
    expect(cnpjValido('1122233300018')).toBe(false);
  });

  it('documentoValido aceita os dois formatos e recusa lixo', () => {
    expect(documentoValido(CNPJ_OK)).toBe(true);
    expect(documentoValido(CPF_OK)).toBe(true);
    expect(documentoValido('123456')).toBe(false);
  });
});
