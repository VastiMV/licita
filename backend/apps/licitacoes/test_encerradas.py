"""Encerradas (`/api/licitacoes/encerradas/`) — quem saiu do ciclo, por quê
e quando (ver `encerradas.py`)."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.cotador.test_views import cotacao_payload

from .models import OportunidadeSalva, montar_texto_busca


class EncerradasTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="operador@empresa.com", password="x", nome="Vasti"
        )
        self.client.force_authenticate(self.user)
        self.hoje = timezone.localdate()

    def salva(self, sequencial: str, prazo_em_dias: int | None, **extras):
        prazo = self.hoje + dt.timedelta(days=prazo_em_dias) if prazo_em_dias is not None else None
        return OportunidadeSalva.objects.create(
            cnpj_orgao="12345678000199",
            ano_compra="2026",
            sequencial_compra=sequencial,
            objeto=extras.pop("objeto", f"Edital {sequencial}"),
            uf=extras.pop("uf", "SP"),
            data_encerramento_proposta=prazo,
            **extras,
        )

    def cotar(self, salva):
        resposta = self.client.post(
            "/api/cotador/cotacoes/",
            cotacao_payload(oportunidade_id=salva.pk),
            format="json",
        )
        self.assertIn(resposta.status_code, (200, 201))

    def vencer(self, salva, dias_atras: int):
        salva.data_encerramento_proposta = self.hoje - dt.timedelta(days=dias_atras)
        salva.save(update_fields=["data_encerramento_proposta"])

    def listar(self, **params):
        resposta = self.client.get("/api/licitacoes/encerradas/", params)
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def por_sequencial(self, dados):
        return {linha["sequencial_compra"]: linha for linha in dados["results"]}

    def test_so_quem_saiu_do_ciclo_aparece_com_o_motivo(self):
        self.salva("1", 5)  # no prazo: está no ciclo
        self.salva("2", None)  # sem prazo publicado: nunca vence
        self.salva("3", -3)  # venceu sem cotação
        cotada = self.salva("4", 5)
        self.cotar(cotada)
        self.vencer(cotada, 2)  # venceu com cotação
        descartada = self.salva("5", 5)
        descartada.remover(por=self.user)

        linhas = self.por_sequencial(self.listar())

        self.assertEqual(sorted(linhas), ["3", "4", "5"])
        self.assertEqual(linhas["3"]["motivo"], "prazo_oportunidade")
        self.assertIsNone(linhas["3"]["cotacao_id"])
        self.assertEqual(linhas["4"]["motivo"], "prazo_cotacao")
        self.assertEqual(linhas["4"]["motivo_label"], "Prazo perdido na cotação")
        self.assertIsNotNone(linhas["4"]["cotacao_id"])
        self.assertEqual(linhas["5"]["motivo"], "descartada")
        self.assertEqual(linhas["5"]["removida_por"], "Vasti")
        self.assertEqual(linhas["5"]["encerrada_em"], str(self.hoje))

    def test_descartada_depois_do_prazo_encerrou_pelo_prazo(self):
        salva = self.salva("1", -10)
        salva.remover(por=self.user)

        linha = self.listar()["results"][0]

        self.assertEqual(linha["motivo"], "prazo_oportunidade")
        self.assertEqual(linha["encerrada_em"], str(self.hoje - dt.timedelta(days=10)))

    def test_filtra_por_periodo_motivo_uf_e_busca(self):
        self.salva("1", -40)
        self.salva("2", -5, uf="RJ", objeto="Cadeira de rodas")
        self.salva("3", 5).remover(por=self.user)

        periodo = self.listar(data_inicial=str(self.hoje - dt.timedelta(days=10)))
        self.assertEqual(sorted(self.por_sequencial(periodo)), ["2", "3"])

        ate = self.listar(data_final=str(self.hoje - dt.timedelta(days=30)))
        self.assertEqual(sorted(self.por_sequencial(ate)), ["1"])

        descartadas = self.listar(motivo="descartada")
        self.assertEqual(sorted(self.por_sequencial(descartadas)), ["3"])

        self.assertEqual(sorted(self.por_sequencial(self.listar(uf="rj"))), ["2"])

        OportunidadeSalva.objects.filter(sequencial_compra="2").update(
            texto_busca=montar_texto_busca("Cadeira de rodas", [])
        )
        self.assertEqual(sorted(self.por_sequencial(self.listar(busca="cadeira"))), ["2"])

    def test_mais_recentes_primeiro_e_ordenacao_por_coluna(self):
        self.salva("1", -40)
        self.salva("2", -5)

        padrao = [linha["sequencial_compra"] for linha in self.listar()["results"]]
        self.assertEqual(padrao, ["2", "1"])

        antigas = self.listar(ordering="encerrada_em")
        self.assertEqual([linha["sequencial_compra"] for linha in antigas["results"]], ["1", "2"])

    def test_prazo_vencido_nao_aparece_mais_nas_salvas(self):
        self.salva("1", -1)

        salvas = self.client.get("/api/licitacoes/salvas/")

        self.assertEqual(salvas.data["count"], 0)
        self.assertEqual(self.listar()["count"], 1)
