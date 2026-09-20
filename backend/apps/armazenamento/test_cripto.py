"""A cifra dos segredos. Sem banco."""

from __future__ import annotations

from cryptography.fernet import Fernet
from django.test import SimpleTestCase, override_settings

from .base import ErroArmazenamento
from .cripto import cifrar, decifrar


class CriptoTests(SimpleTestCase):
    def test_round_trip(self):
        self.assertEqual(decifrar(cifrar({"secret_key": "abc"})), {"secret_key": "abc"})

    def test_texto_cifrado_nao_contem_o_segredo(self):
        # É o ponto todo: um dump do Postgres não pode entregar a credencial.
        self.assertNotIn("abc", cifrar({"secret_key": "abc"}))

    def test_vazio_devolve_dicionario_vazio(self):
        self.assertEqual(decifrar(""), {})

    def test_chave_trocada_falha_com_instrucao_em_vez_de_traceback(self):
        cifrado = cifrar({"secret_key": "abc"})

        with override_settings(SECRET_KEY=Fernet.generate_key().decode()):
            with self.assertRaises(ErroArmazenamento) as erro:
                decifrar(cifrado)

        self.assertIn("Preencha o segredo de novo", str(erro.exception))
