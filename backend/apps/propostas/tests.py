"""Gerar proposta move a licitação do Cotador para a coluna Proposta — e,
com proposta, o prazo vencer não a leva para Encerradas."""

from __future__ import annotations

import datetime as dt

from rest_framework.test import APITestCase

from apps.cotador.test_views import item_cotado
from apps.licitacoes.models import EventoOportunidadeSalva
from apps.licitacoes.test_ciclo import CicloTests

from .models import Proposta


class GerarPropostaTests(APITestCase):
    setUp = CicloTests.setUp
    salva = CicloTests.salva
    cotar = CicloTests.cotar
    quadro = CicloTests.quadro
    coluna = CicloTests.coluna

    def gerar(self, salva):
        return self.client.post("/api/propostas/", {"oportunidade_id": salva.pk}, format="json")

    def test_gerar_tira_do_cotador_e_poe_na_coluna_proposta(self):
        salva = self.salva("1")
        self.cotar(salva, itens=[item_cotado(valor_referencia="50.00")])

        resposta = self.gerar(salva)

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(self.client.get("/api/licitacoes/cotacoes/").data["results"], [])
        quadro = self.quadro()
        self.assertEqual(self.coluna(quadro, "cotacao")["cartoes"], [])
        coluna = self.coluna(quadro, "proposta")
        self.assertTrue(coluna["disponivel"])
        self.assertEqual([c["id"] for c in coluna["cartoes"]], [salva.pk])
        self.assertTrue(
            salva.eventos.filter(tipo=EventoOportunidadeSalva.Tipo.PROPOSTA).exists()
        )

    def test_gerar_de_novo_e_idempotente(self):
        salva = self.salva("1")
        self.cotar(salva)
        self.gerar(salva)

        self.assertEqual(self.gerar(salva).status_code, 200)
        self.assertEqual(Proposta.objects.count(), 1)
        self.assertEqual(salva.eventos.filter(tipo=EventoOportunidadeSalva.Tipo.PROPOSTA).count(), 1)

    def test_sem_cotacao_nao_gera(self):
        self.assertEqual(self.gerar(self.salva("1")).status_code, 400)

    def test_com_proposta_o_prazo_vencido_nao_encerra(self):
        salva = self.salva("1")
        self.cotar(salva)
        self.gerar(salva)
        salva.data_encerramento_proposta = self.hoje - dt.timedelta(days=1)
        salva.save()

        self.assertEqual(self.client.get("/api/licitacoes/encerradas/").data["count"], 0)
        self.assertEqual(
            [c["id"] for c in self.coluna(self.quadro(), "proposta")["cartoes"]], [salva.pk]
        )

    def test_cotacao_com_proposta_nao_pode_ser_apagada(self):
        salva = self.salva("1")
        self.cotar(salva)
        self.gerar(salva)
        salva.refresh_from_db()

        resposta = self.client.delete(f"/api/cotador/cotacoes/{salva.cotacao.pk}/")

        self.assertEqual(resposta.status_code, 409)
