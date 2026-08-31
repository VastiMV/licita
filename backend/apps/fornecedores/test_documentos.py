"""Testes de CPF/CNPJ. Sem Django: a regra é aritmética pura, roda com
`python -m unittest apps.fornecedores.test_documentos`."""

from __future__ import annotations

import unittest

from .documentos import cnpj_valido, cpf_valido, documento_valido, formatar_documento, somente_digitos

# Documentos sintéticos, com dígito verificador correto — não são de
# empresas ou pessoas reais.
CNPJ_OK = "11222333000181"
CPF_OK = "52998224725"


class NormalizacaoTests(unittest.TestCase):
    def test_mascara_e_texto_viram_os_mesmos_digitos(self):
        self.assertEqual(somente_digitos("11.222.333/0001-81"), CNPJ_OK)
        self.assertEqual(somente_digitos(CNPJ_OK), CNPJ_OK)

    def test_vazio_e_nulo_nao_estouram(self):
        self.assertEqual(somente_digitos(""), "")
        self.assertEqual(somente_digitos(None), "")

    def test_formatar_devolve_a_mascara_de_cada_tipo(self):
        self.assertEqual(formatar_documento(CNPJ_OK), "11.222.333/0001-81")
        self.assertEqual(formatar_documento(CPF_OK), "529.982.247-25")

    def test_tamanho_inesperado_sai_como_veio(self):
        """Melhor mostrar o dado cru do que uma máscara mentirosa."""

        self.assertEqual(formatar_documento("123"), "123")


class DigitoVerificadorTests(unittest.TestCase):
    def test_cnpj_valido(self):
        self.assertTrue(cnpj_valido(CNPJ_OK))

    def test_cnpj_com_digito_trocado_e_recusado(self):
        self.assertFalse(cnpj_valido("11222333000182"))

    def test_cnpj_de_digitos_repetidos_e_recusado(self):
        """Passa na conta do módulo 11 e é a digitação preguiçosa mais
        comum — precisa cair aqui."""

        self.assertFalse(cnpj_valido("11111111111111"))

    def test_cnpj_de_tamanho_errado_e_recusado(self):
        self.assertFalse(cnpj_valido("1122233300018"))

    def test_cpf_valido(self):
        self.assertTrue(cpf_valido(CPF_OK))

    def test_cpf_com_digito_trocado_e_recusado(self):
        self.assertFalse(cpf_valido("52998224724"))

    def test_cpf_de_digitos_repetidos_e_recusado(self):
        self.assertFalse(cpf_valido("00000000000"))

    def test_documento_aceita_os_dois_formatos(self):
        self.assertTrue(documento_valido(CNPJ_OK))
        self.assertTrue(documento_valido(CPF_OK))
        self.assertFalse(documento_valido("123456"))


if __name__ == "__main__":
    unittest.main()
