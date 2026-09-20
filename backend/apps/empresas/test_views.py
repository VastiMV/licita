"""Testes dos endpoints do cadastro de empresas (`/api/empresas/`).

Precisam de banco (`manage.py test apps.empresas`).
"""

from __future__ import annotations

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.tenants.atual import tenant_atual

from .models import Empresa


def payload(**overrides) -> dict:
    base = {
        "nome": "Inside Solutions Ltda",
        "fantasia": "Inside",
        "cnpj": "11.222.333/0001-81",
        "porte": "epp",
        "cidade": "São Paulo",
        "uf": "SP",
        "email": "licitacoes@inside.com.br",
        "responsavel_legal": "Gustavo Marucci",
    }
    return {**base, **overrides}


class CadastroTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="operador@empresa.com", password="x")
        self.client.force_authenticate(self.user)

    def test_exige_autenticacao(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/empresas/").status_code, 401)

    def test_cadastra_normalizando_o_cnpj_e_gravando_quem_cadastrou(self):
        resposta = self.client.post("/api/empresas/", payload(), format="json")

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.data["cnpj"], "11222333000181")
        self.assertEqual(resposta.data["cnpj_formatado"], "11.222.333/0001-81")
        self.assertEqual(resposta.data["porte_label"], "Empresa de pequeno porte (EPP)")

        empresa = Empresa.objects.get()
        self.assertEqual(empresa.criado_por, self.user)
        self.assertEqual(empresa.tenant, tenant_atual())

    def test_tenant_do_payload_e_ignorado(self):
        # De quem é o registro quem decide é `apps.tenants.atual` — aceitar
        # do payload seria o primeiro buraco de multiempresa.
        resposta = self.client.post("/api/empresas/", payload(tenant=999), format="json")

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(Empresa.objects.get().tenant, tenant_atual())

    def test_cnpj_invalido_reprova_com_mensagem_do_campo(self):
        resposta = self.client.post("/api/empresas/", payload(cnpj="11.222.333/0001-00"), format="json")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("dígitos verificadores", resposta.data["cnpj"][0])

    def test_cnpj_repetido_aponta_a_empresa_existente(self):
        self.client.post("/api/empresas/", payload(), format="json")
        resposta = self.client.post("/api/empresas/", payload(nome="Outra"), format="json")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("Inside Solutions Ltda", resposta.data["cnpj"][0])

    def test_edicao_mantem_o_proprio_cnpj(self):
        criada = self.client.post("/api/empresas/", payload(), format="json").data
        resposta = self.client.put(
            f"/api/empresas/{criada['id']}/", payload(nome="Inside Solutions S.A."), format="json"
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["nome"], "Inside Solutions S.A.")


class ListaTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            User.objects.create_user(email="operador@empresa.com", password="x")
        )
        tenant = tenant_atual()
        Empresa.objects.create(tenant=tenant, nome="Alfa Ltda", cnpj="11222333000181", cidade="Campinas")
        Empresa.objects.create(tenant=tenant, nome="Beta Ltda", cnpj="45723174000110", cidade="Santos")

    def test_lista_paginada_e_ordenada_por_nome(self):
        resposta = self.client.get("/api/empresas/")

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["count"], 2)
        self.assertEqual([e["nome"] for e in resposta.data["results"]], ["Alfa Ltda", "Beta Ltda"])

    def test_ordering_fora_da_whitelist_cai_no_padrao(self):
        resposta = self.client.get("/api/empresas/?ordering=observacoes")

        self.assertEqual([e["nome"] for e in resposta.data["results"]], ["Alfa Ltda", "Beta Ltda"])

    def test_ordering_descendente(self):
        resposta = self.client.get("/api/empresas/?ordering=-nome")

        self.assertEqual([e["nome"] for e in resposta.data["results"]], ["Beta Ltda", "Alfa Ltda"])

    def test_busca_por_cidade(self):
        resposta = self.client.get("/api/empresas/?busca=santos")

        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["nome"], "Beta Ltda")


class InativacaoTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            User.objects.create_user(email="operador@empresa.com", password="x")
        )
        tenant = tenant_atual()
        self.padrao = Empresa.objects.create(tenant=tenant, nome="Alfa Ltda", cnpj="11222333000181")
        self.outra = Empresa.objects.create(tenant=tenant, nome="Beta Ltda", cnpj="45723174000110")

    def test_delete_inativa_e_devolve_o_registro(self):
        resposta = self.client.delete(f"/api/empresas/{self.outra.id}/")

        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(resposta.data["ativa"])
        self.assertEqual(Empresa.objects.count(), 2)

    def test_nao_inativa_a_empresa_padrao(self):
        resposta = self.client.delete(f"/api/empresas/{self.padrao.id}/")

        self.assertEqual(resposta.status_code, 400)
        self.padrao.refresh_from_db()
        self.assertTrue(self.padrao.ativa)

    def test_put_tambem_recusa_inativar_a_padrao(self):
        resposta = self.client.put(
            f"/api/empresas/{self.padrao.id}/",
            payload(cnpj=self.padrao.cnpj, ativa=False),
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("empresa padrão", resposta.data["ativa"][0])


class OpcoesTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            User.objects.create_user(email="operador@empresa.com", password="x")
        )
        tenant = tenant_atual()
        Empresa.objects.create(tenant=tenant, nome="Alfa Ltda", cnpj="11222333000181")
        Empresa.objects.create(
            tenant=tenant, nome="Beta Ltda", cnpj="45723174000110", ativa=False
        )

    def test_opcoes_traz_so_as_ativas(self):
        resposta = self.client.get("/api/empresas/opcoes/")

        self.assertEqual([e["nome"] for e in resposta.data], ["Alfa Ltda"])
        self.assertTrue(resposta.data[0]["padrao"])

    def test_todas_inclui_inativa_para_abrir_proposta_antiga(self):
        resposta = self.client.get("/api/empresas/opcoes/?todas=1")

        self.assertEqual([e["nome"] for e in resposta.data], ["Alfa Ltda", "Beta Ltda"])
