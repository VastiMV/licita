"""O driver de disco — o que os testes do resto do projeto vão usar.

Sem banco e sem rede, que é justamente o ponto dele.
"""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

from django.test import SimpleTestCase

from .base import ErroArmazenamento
from .drivers.local import ArmazenamentoLocal, caminho_do_token


class LocalTests(SimpleTestCase):
    def setUp(self):
        self.raiz = tempfile.mkdtemp()
        self.driver = ArmazenamentoLocal(raiz=self.raiz)

    def test_round_trip(self):
        self.driver.salvar("tenant/inside/a.pdf", io.BytesIO(b"conteudo"))

        with self.driver.abrir("tenant/inside/a.pdf") as arquivo:
            self.assertEqual(arquivo.read(), b"conteudo")

    def test_cria_as_pastas_do_caminho(self):
        self.driver.salvar("tenant/inside/empresas/7/cnd/v1.pdf", io.BytesIO(b"."))

        self.assertTrue(Path(self.raiz, "tenant/inside/empresas/7/cnd/v1.pdf").exists())

    def test_remover_e_idempotente(self):
        self.driver.salvar("a.pdf", io.BytesIO(b"."))
        self.driver.remover("a.pdf")
        self.driver.remover("a.pdf")  # não levanta

        self.assertFalse(Path(self.raiz, "a.pdf").exists())

    def test_arquivo_inexistente_vira_erro_de_dominio(self):
        # Quem chama nunca deveria precisar capturar FileNotFoundError.
        with self.assertRaises(ErroArmazenamento):
            self.driver.abrir("nao-existe.pdf")

    def test_caminho_para_fora_da_raiz_e_recusado(self):
        with self.assertRaises(ErroArmazenamento):
            self.driver.salvar("../fora.pdf", io.BytesIO(b"."))

    def test_url_temporaria_e_assinada_e_expira(self):
        # Mesma promessa do bucket: link que expira, não caminho adivinhável.
        url = self.driver.url_temporaria("tenant/inside/a.pdf")
        token = url.rstrip("/").rsplit("/", 1)[-1]

        self.assertEqual(caminho_do_token(token), "tenant/inside/a.pdf")
        with self.assertRaises(ErroArmazenamento):
            caminho_do_token(token, expira_em=-1)

    def test_token_adulterado_nao_abre_nada(self):
        with self.assertRaises(ErroArmazenamento):
            caminho_do_token("nao-e-um-token")

    def test_falha_de_disco_vira_erro_de_dominio(self):
        # Pasta sem permissão, disco cheio: quem chama nunca deveria precisar
        # capturar OSError — e a tela precisa de um texto, não de um errno.
        driver = ArmazenamentoLocal(raiz="/proc/nao-da-para-escrever")

        with self.assertRaises(ErroArmazenamento) as erro:
            driver.salvar("a.pdf", io.BytesIO(b"."))

        self.assertIn("Não foi possível gravar", str(erro.exception))
