"""Teste de integração do endpoint `GET /api/licitacoes/oportunidades/` —
autenticação (a API inteira é `IsAuthenticated` por padrão, ver
docs/ARQUITETURA.md) e o formato de resposta batendo com o contrato do
frontend (`OportunidadeResponse`).
"""

from __future__ import annotations

from unittest import mock

import httpx
from django.core.cache import cache
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
        # Detalhe de compra é cacheado entre requisições (ver services) —
        # cada teste começa limpo.
        cache.clear()

    def test_sem_autenticacao_e_negado(self):
        response = self.client.get("/api/licitacoes/oportunidades/")
        self.assertEqual(response.status_code, 401)

    def test_modo_navegacao_devolve_lista_no_formato_esperado_pelo_frontend(self):
        self.client.force_authenticate(self.user)

        # A view pega o client pelo registro de plataformas — o mock entra lá.
        with mock.patch(
            "apps.integracoes.plataformas.ComprasGovClient",
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
            "criterio_julgamento",
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
            "plataforma_id",
            "link_plataforma",
            "link_pncp",
            "capag",
        ):
            self.assertIn(campo, oportunidade)
        self.assertIsInstance(oportunidade["contratacao_srp"], bool)

    def test_busca_textual_ja_resolve_o_capag_sem_segunda_chamada(self):
        """O selo do card não pode depender de uma segunda chamada ao
        `/api/consulta/` (rate limit por IP — 429 medido ao vivo em
        28/08/2026): os insumos vêm no detalhe que a própria busca fez pra
        filtrar a plataforma, e a view resolve a nota dali."""

        from apps.integracoes.test_pncp import _pncp_falso
        from apps.licitacoes.test_services import _montar_handler_pncp

        MunicipioCapag.objects.create(codigo_ibge=3509502, nome_municipio="Campinas", uf="SP", nota="A")
        self.client.force_authenticate(self.user)

        with (
            mock.patch("apps.licitacoes.services.env", mock.Mock(usar_busca_pncp=True)),
            mock.patch(
                "apps.licitacoes.services.PncpClient",
                side_effect=lambda *a, **kw: _pncp_falso(_montar_handler_pncp()),
            ),
            mock.patch(
                "apps.integracoes.plataformas.ComprasGovClient",
                side_effect=lambda *a, **kw: client_falso(_montar_handler()),
            ),
        ):
            response = self.client.get(
                "/api/licitacoes/oportunidades/",
                {"palavra_chave": "café", "data_inicial": "2026-07-01"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["capag"], {"nota": "A", "cor": "verde"})


class CompraDetalheViewTests(APITestCase):
    """`GET /api/licitacoes/compras/<cnpj>/<ano>/<sequencial>/detalhe/` —
    documentos do edital + selo CAPAG, buscados sob demanda."""

    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")
        self.client.force_authenticate(self.user)
        cache.clear()

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
                    "usuarioNome": "Compras.gov.br",
                    "linkSistemaOrigem": (
                        "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/"
                        "landing?destino=acompanhamento-compra&compra=92553805900672026"
                    ),
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
        # Link de origem reconhecido -> plataforma registrada, com id e nome
        # do registro (ver apps/integracoes/plataformas.py).
        self.assertEqual(response.data["plataforma"]["id"], "compras_gov")
        self.assertEqual(response.data["plataforma"]["nome"], "Compras.gov.br")
        self.assertIn("compra=92553805900672026", response.data["plataforma"]["link"])

    def test_plataforma_desconhecida_mantem_link_e_nome_sem_id(self):
        """Compra publicada por plataforma que não está no registro (o PNCP
        agrega todas): o link e o nome que o PNCP deu continuam valendo — só
        não há `id` (nem, portanto, ícone próprio no frontend)."""

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/arquivos"):
                return httpx.Response(200, json=[])
            return httpx.Response(
                200,
                json={
                    "orgaoEntidade": {"esferaId": "M"},
                    "unidadeOrgao": {},
                    "usuarioNome": "ECustomize Consultoria em Software S.A",
                    "linkSistemaOrigem": "https://www.portaldecompraspublicas.com.br/processos/x",
                },
            )

        with mock.patch(
            "apps.licitacoes.views.PncpClient", side_effect=lambda *a, **kw: pncp_falso(handler)
        ):
            response = self.client.get("/api/licitacoes/compras/1/2026/18/detalhe/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["plataforma"]["id"])
        self.assertEqual(
            response.data["plataforma"]["nome"], "ECustomize Consultoria em Software S.A"
        )
        self.assertIn("portaldecompraspublicas", response.data["plataforma"]["link"])

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
        self.assertIsNone(response.data["plataforma"])

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
