"""Endpoints da configuração de armazenamento (`/api/armazenamento/`).

Precisam de banco. O driver usado é sempre o `local` — teste não fala com
bucket de verdade (mesma disciplina de `apps/integracoes`).
"""

from __future__ import annotations

import tempfile

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.tenants.atual import tenant_atual

from .models import ConfigArmazenamento


class PermissaoTests(APITestCase):
    def test_usuario_comum_nao_ve_nem_configura(self):
        # Trocar o bucket redireciona para onde vão os documentos da
        # empresa — não é coisa para todo usuário logado.
        self.client.force_authenticate(User.objects.create_user(email="op@x.com", password="x"))

        self.assertEqual(self.client.get("/api/armazenamento/config/").status_code, 403)
        self.assertEqual(self.client.get("/api/armazenamento/drivers/").status_code, 403)
        self.assertEqual(self.client.post("/api/armazenamento/testar/").status_code, 403)

    def test_sem_token_e_401(self):
        self.assertEqual(self.client.get("/api/armazenamento/config/").status_code, 401)


class ConfiguracaoTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@x.com", password="x", is_staff=True)
        self.client.force_authenticate(self.admin)
        self.raiz = tempfile.mkdtemp()

    def test_drivers_listam_os_campos_para_a_tela_montar_o_formulario(self):
        resposta = self.client.get("/api/armazenamento/drivers/")

        self.assertEqual(resposta.status_code, 200)
        por_chave = {d["chave"]: d for d in resposta.data}
        self.assertEqual(por_chave["r2"]["rotulo"], "Cloudflare R2")
        # O endpoint da conta é o que distingue o R2 — tem que ser
        # perguntado, não adivinhado.
        campos = {c["nome"]: c for c in por_chave["r2"]["campos"]}
        self.assertIn("endpoint_url", campos)
        self.assertTrue(campos["secret_key"]["segredo"])
        self.assertFalse(campos["prefixo"]["obrigatorio"])

    def test_sem_configuracao_responde_nulo_e_nao_404(self):
        # "Ainda não configurado" é estado normal da tela, não erro de rota.
        resposta = self.client.get("/api/armazenamento/config/")

        self.assertEqual(resposta.status_code, 200)
        self.assertIsNone(resposta.data)

    def test_put_cria_a_configuracao_e_registra_quem_mexeu(self):
        resposta = self.client.put(
            "/api/armazenamento/config/",
            {"driver": "local", "opcoes": {"raiz": self.raiz}},
            format="json",
        )

        self.assertEqual(resposta.status_code, 200)
        config = ConfigArmazenamento.objects.get()
        self.assertEqual(config.tenant, tenant_atual())
        self.assertEqual(config.atualizado_por, self.admin)

    def test_o_segredo_nunca_volta_pela_api(self):
        self.client.put(
            "/api/armazenamento/config/",
            {
                "driver": "r2",
                "opcoes": {"endpoint_url": "https://c.r2.cloudflarestorage.com", "bucket": "b", "access_key": "k"},
                "segredos": {"secret_key": "super-secreto"},
            },
            format="json",
        )
        resposta = self.client.get("/api/armazenamento/config/")

        self.assertNotIn("super-secreto", str(resposta.data))
        self.assertEqual(resposta.data["segredos_definidos"], ["secret_key"])
        self.assertIsNotNone(resposta.data["segredos_definidos_em"])

    def test_driver_desconhecido_diz_o_que_esta_instalado(self):
        resposta = self.client.put(
            "/api/armazenamento/config/", {"driver": "dropbox"}, format="json"
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("não está instalado", str(resposta.data["driver"][0]))

    def test_campo_que_o_driver_nao_usa_e_recusado(self):
        # Configuração morta no banco é do tipo que ninguém descobre estar
        # sendo ignorada.
        resposta = self.client.put(
            "/api/armazenamento/config/",
            {"driver": "local", "opcoes": {"raiz": self.raiz, "bucket": "b"}},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("bucket", str(resposta.data["opcoes"]))

    def test_segredo_enviado_como_opcao_comum_e_recusado(self):
        # Se passasse, ficaria gravado em claro no JSON.
        resposta = self.client.put(
            "/api/armazenamento/config/",
            {
                "driver": "r2",
                "opcoes": {"endpoint_url": "https://c.r2.cloudflarestorage.com", "bucket": "b", "secret_key": "x"},
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("segredo", str(resposta.data["opcoes"]))


class TesteDeConexaoTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            User.objects.create_user(email="admin@x.com", password="x", is_staff=True)
        )
        self.raiz = tempfile.mkdtemp()

    def test_round_trip_passa_e_marca_a_data(self):
        self.client.put(
            "/api/armazenamento/config/",
            {"driver": "local", "opcoes": {"raiz": self.raiz}},
            format="json",
        )

        resposta = self.client.post("/api/armazenamento/testar/")

        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.data["ok"])
        self.assertIsNotNone(ConfigArmazenamento.objects.get().testado_em)

    def test_teste_nao_deixa_lixo_no_armazenamento(self):
        from pathlib import Path

        self.client.put(
            "/api/armazenamento/config/",
            {"driver": "local", "opcoes": {"raiz": self.raiz}},
            format="json",
        )
        self.client.post("/api/armazenamento/testar/")

        sobrou = [p for p in Path(self.raiz).rglob("*") if p.is_file()]
        self.assertEqual(sobrou, [])

    def test_configuracao_quebrada_devolve_a_mensagem_e_nao_um_traceback(self):
        self.client.put(
            "/api/armazenamento/config/",
            {"driver": "local", "opcoes": {"raiz": "/proc/nao-da-para-escrever"}},
            format="json",
        )

        resposta = self.client.post("/api/armazenamento/testar/")

        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(resposta.data["ok"])
        self.assertTrue(resposta.data["erro"])

    def test_sem_configuracao_o_teste_explica_em_vez_de_quebrar(self):
        resposta = self.client.post("/api/armazenamento/testar/")

        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(resposta.data["ok"])


class ServicoTests(APITestCase):
    def test_sem_configuracao_completa_o_upload_e_recusado_com_instrucao(self):
        # Não há fallback silencioso para disco: gravar certidão numa pasta
        # que some no próximo pod é pior do que recusar.
        from .base import ErroArmazenamento
        from .servico import armazenamento_do_tenant

        with self.assertRaises(ErroArmazenamento) as erro:
            armazenamento_do_tenant(tenant_atual())

        self.assertIn("Configurações → Armazenamento", str(erro.exception))
