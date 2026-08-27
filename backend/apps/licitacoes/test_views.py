"""Teste de integração do endpoint `GET /api/licitacoes/oportunidades/` —
autenticação (a API inteira é `IsAuthenticated` por padrão, ver
docs/ARQUITETURA.md) e o formato de resposta batendo com o contrato do
frontend (`OportunidadeResponse`).
"""

from __future__ import annotations

from unittest import mock

import httpx
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.capag.models import EstadoCapag, MunicipioCapag
from apps.integracoes.test_compras_gov import RESPOSTA_CONTRATACOES, RESPOSTA_ITENS
from apps.integracoes.test_pncp import _pncp_falso as pncp_falso

from .test_services import _montar_handler
from apps.integracoes.test_compras_gov import _client_falso as client_falso


class OportunidadesViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

    def test_sem_autenticacao_e_negado(self):
        response = self.client.get("/api/licitacoes/oportunidades/")
        self.assertEqual(response.status_code, 401)

    def test_modo_navegacao_devolve_lista_no_formato_esperado_pelo_frontend(self):
        self.client.force_authenticate(self.user)

        with mock.patch(
            "apps.licitacoes.views.ComprasGovClient",
            side_effect=lambda *a, **kw: client_falso(_montar_handler()),
        ):
            response = self.client.get(
                "/api/licitacoes/oportunidades/", {"modalidade": "6", "data_inicial": "2026-07-01"}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        oportunidade = response.data[0]
        # Todo campo que o frontend espera precisa estar presente (mesmo que
        # `null`) — ver oportunidade.contracts.ts.
        for campo in (
            "numero_item",
            "descricao_resumida",
            "descricao_detalhada",
            "quantidade",
            "unidade_medida",
            "valor_unitario_estimado",
            "valor_total",
            "tipo_beneficio",
            "contratacao_uf",
            "contratacao_modalidade",
            "contratacao_srp",
            "contratacao_situacao",
            "situacao_item",
            "contratacao_data_publicacao",
            "contratacao_data_encerramento_proposta",
            "contratacao_orgao_nome",
            "contratacao_municipio",
            "contratacao_uasg",
            "contratacao_objeto",
            "link_compras_gov",
            "link_pncp",
        ):
            self.assertIn(campo, oportunidade)
        self.assertIsInstance(oportunidade["contratacao_srp"], bool)


class CompraDetalheViewTests(APITestCase):
    """`GET /api/licitacoes/compras/<cnpj>/<ano>/<sequencial>/detalhe/` —
    documentos do edital + selo CAPAG, buscados sob demanda."""

    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")
        self.client.force_authenticate(self.user)

    def test_sem_autenticacao_e_negado(self):
        self.client.force_authenticate(None)
        response = self.client.get("/api/licitacoes/compras/1/2026/1/detalhe/")
        self.assertEqual(response.status_code, 401)

    def test_devolve_documentos_e_o_selo_do_ente_certo(self):
        """Esfera estadual -> nota do ESTADO (nunca do município, mesmo que o
        órgão tenha nome de cidade) — ver apps.capag.lookup."""

        EstadoCapag.objects.create(uf="SP", nota="B")
        MunicipioCapag.objects.create(codigo_ibge=3549805, nome_municipio="X", uf="SP", nota="A")

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/arquivos"):
                return httpx.Response(
                    200,
                    json=[
                        {
                            "titulo": "Edital.pdf",
                            "tipoDocumentoNome": "Edital",
                            "url": "https://pncp.gov.br/pncp-api/v1/orgaos/1/compras/2026/43/arquivos/1",
                        }
                    ],
                )
            return httpx.Response(
                200,
                json={
                    "orgaoEntidade": {"esferaId": "E"},
                    "unidadeOrgao": {"ufSigla": "SP", "codigoIbge": "3549805"},
                },
            )

        with mock.patch(
            "apps.licitacoes.views.PncpClient", side_effect=lambda *a, **kw: pncp_falso(handler)
        ):
            response = self.client.get("/api/licitacoes/compras/1/2026/43/detalhe/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["capag"], {"nota": "B", "cor": "amarelo"})
        self.assertEqual(len(response.data["documentos"]), 1)
        self.assertEqual(response.data["documentos"][0]["titulo"], "Edital.pdf")

    def test_orgao_federal_fica_sem_selo(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/arquivos"):
                return httpx.Response(200, json=[])
            return httpx.Response(200, json={"orgaoEntidade": {"esferaId": "F"}, "unidadeOrgao": {}})

        with mock.patch(
            "apps.licitacoes.views.PncpClient", side_effect=lambda *a, **kw: pncp_falso(handler)
        ):
            response = self.client.get("/api/licitacoes/compras/1/2026/1/detalhe/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["capag"])
        self.assertEqual(response.data["documentos"], [])

    def test_falha_no_pncp_nao_derruba_a_resposta(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text="indisponível")

        with mock.patch(
            "apps.licitacoes.views.PncpClient", side_effect=lambda *a, **kw: pncp_falso(handler)
        ):
            response = self.client.get("/api/licitacoes/compras/1/2026/1/detalhe/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["capag"])
        self.assertEqual(response.data["documentos"], [])
