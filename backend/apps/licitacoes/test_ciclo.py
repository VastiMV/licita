"""Testes do quadro do Ciclo de Licitação (`/api/licitacoes/ciclo/`).

O que mais importa aqui é a etapa **calculada**: salvar a cotação move o
cartão de coluna sem ninguém arrastar nada, e prazo vencido tira do quadro.
"""

from __future__ import annotations

import datetime as dt

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.cotador.test_views import cotacao_payload, item_cotado, oferta

from .models import OportunidadeSalva


class CicloTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="operador@empresa.com", password="x")
        self.client.force_authenticate(self.user)
        self.hoje = timezone.localdate()

    def salva(self, sequencial: str, prazo_em_dias: int | None = 10, **extras):
        prazo = self.hoje + dt.timedelta(days=prazo_em_dias) if prazo_em_dias is not None else None
        return OportunidadeSalva.objects.create(
            cnpj_orgao="12345678000199",
            ano_compra="2026",
            sequencial_compra=sequencial,
            objeto=f"Edital {sequencial}",
            data_encerramento_proposta=prazo,
            **extras,
        )

    def cotar(self, salva, **overrides):
        resposta = self.client.post(
            "/api/cotador/cotacoes/",
            cotacao_payload(oportunidade_id=salva.pk, **overrides),
            format="json",
        )
        self.assertIn(resposta.status_code, (200, 201))

    def quadro(self):
        resposta = self.client.get("/api/licitacoes/ciclo/")
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def coluna(self, quadro, etapa):
        return next(c for c in quadro["colunas"] if c["etapa"] == etapa)

    def test_cinco_colunas_na_ordem_e_so_as_duas_primeiras_disponiveis(self):
        colunas = self.quadro()["colunas"]

        self.assertEqual(
            [c["etapa"] for c in colunas],
            ["oportunidade", "cotacao", "proposta", "disputa", "empenho"],
        )
        self.assertEqual([c["disponivel"] for c in colunas], [True, True, False, False, False])

    def test_salvar_a_cotacao_move_o_cartao_de_coluna(self):
        salva = self.salva("1")
        self.assertEqual(len(self.coluna(self.quadro(), "oportunidade")["cartoes"]), 1)

        self.cotar(salva)

        quadro = self.quadro()
        self.assertEqual(self.coluna(quadro, "oportunidade")["cartoes"], [])
        cartao = self.coluna(quadro, "cotacao")["cartoes"][0]
        self.assertEqual(cartao["id"], salva.pk)
        self.assertIsNotNone(cartao["cotacao_id"])
        self.assertEqual(cartao["falta"], "gerar a proposta")

    def test_cotacao_com_item_sem_preco_aponta_a_pendencia(self):
        salva = self.salva("1")
        sem_preco = item_cotado(ofertas=[oferta(escolhida=True, custo_produto="0", frete="0")])
        self.cotar(salva, itens=[sem_preco])

        quadro = self.quadro()
        cartao = self.coluna(quadro, "cotacao")["cartoes"][0]

        self.assertEqual(cartao["pendencias"], 1)
        self.assertEqual(cartao["alerta"]["nivel"], "aviso")
        self.assertEqual(cartao["falta"], "preço de fornecedor nos itens pendentes")
        self.assertEqual(quadro["resumo"]["cotacoes_com_pendencia"], 1)

    def test_prazo_vencido_sai_do_quadro_e_conta_como_encerrada(self):
        self.salva("1", prazo_em_dias=-1)

        quadro = self.quadro()

        self.assertEqual(self.coluna(quadro, "oportunidade")["cartoes"], [])
        self.assertEqual(quadro["encerradas"], 1)

    def test_removida_da_lista_nao_aparece(self):
        self.salva("1").remover()
        quadro = self.quadro()
        self.assertEqual(sum(len(c["cartoes"]) for c in quadro["colunas"]), 0)
        self.assertEqual(quadro["encerradas"], 0)

    def test_salva_antiga_sem_cotacao_acende_o_aviso(self):
        salva = self.salva("1")
        OportunidadeSalva.objects.filter(pk=salva.pk).update(
            criada_em=timezone.now() - dt.timedelta(days=5)
        )

        quadro = self.quadro()
        cartao = self.coluna(quadro, "oportunidade")["cartoes"][0]

        self.assertEqual(cartao["alerta"], {"nivel": "aviso", "texto": "salva há 5 dias, sem cotação"})
        self.assertEqual(quadro["resumo"]["salvas_sem_cotacao"], 1)

    def test_prazo_amanha_vira_alerta(self):
        self.salva("1", prazo_em_dias=1)

        cartao = self.coluna(self.quadro(), "oportunidade")["cartoes"][0]

        self.assertEqual(cartao["alerta"], {"nivel": "alerta", "texto": "propostas até amanhã"})

    def test_quem_vence_primeiro_vem_primeiro_e_sem_prazo_vai_para_o_fim(self):
        self.salva("sem-prazo", prazo_em_dias=None)
        self.salva("longe", prazo_em_dias=20)
        self.salva("perto", prazo_em_dias=3)

        cartoes = self.coluna(self.quadro(), "oportunidade")["cartoes"]

        self.assertEqual(
            [c["objeto"] for c in cartoes], ["Edital perto", "Edital longe", "Edital sem-prazo"]
        )

    def test_exige_autenticacao(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/licitacoes/ciclo/").status_code, 401)
