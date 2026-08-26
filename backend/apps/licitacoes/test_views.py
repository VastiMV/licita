"""Teste de integração do endpoint `GET /api/licitacoes/oportunidades/` —
autenticação (a API inteira é `IsAuthenticated` por padrão, ver
docs/ARQUITETURA.md) e o formato de resposta batendo com o contrato do
frontend (`OportunidadeResponse`).
"""

from __future__ import annotations

from unittest import mock

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.integracoes.test_compras_gov import RESPOSTA_CONTRATACOES, RESPOSTA_ITENS

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
