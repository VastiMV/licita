"""Como a chave do arquivo é montada. Sem banco."""

from __future__ import annotations

from django.test import SimpleTestCase

from .caminhos import caminho, limpar


class FakeTenant:
    slug = "inside-solutions"


class CaminhosTests(SimpleTestCase):
    def test_prefixo_por_tenant_desde_o_primeiro_arquivo(self):
        # Começar sem o prefixo e querer separar depois é mover arquivo, não
        # mudar código.
        self.assertEqual(
            caminho(FakeTenant(), "empresas", "12", "v3.pdf"),
            "tenant/inside-solutions/empresas/12/v3.pdf",
        )

    def test_acento_espaco_e_barra_somem_do_nome(self):
        self.assertEqual(limpar("Certidão Municipal (2).pdf"), "certidao-municipal-2-.pdf")
        self.assertEqual(limpar("a/b"), "a-b")

    def test_nome_que_sobraria_vazio_vira_algo(self):
        self.assertEqual(limpar("///"), "arquivo")
