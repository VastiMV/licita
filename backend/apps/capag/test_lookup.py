"""Testes de `apps.capag.lookup` — banco real (Postgres), sem rede."""

from __future__ import annotations

from django.test import TestCase

from . import lookup
from .models import EstadoCapag, MunicipioCapag


class NotaParaTests(TestCase):
    def setUp(self):
        MunicipioCapag.objects.create(
            codigo_ibge=3549805, nome_municipio="São José do Rio Preto", uf="SP", nota="A"
        )
        EstadoCapag.objects.create(uf="SP", nota="B")

    def test_municipal_busca_por_codigo_ibge(self):
        selo = lookup.nota_para(esfera_id="M", codigo_ibge=3549805, uf="SP")
        self.assertEqual(selo, {"nota": "A", "cor": "verde"})

    def test_estadual_busca_por_uf(self):
        selo = lookup.nota_para(esfera_id="E", codigo_ibge=None, uf="SP")
        self.assertEqual(selo, {"nota": "B", "cor": "amarelo"})

    def test_federal_nao_tem_capag(self):
        self.assertIsNone(lookup.nota_para(esfera_id="F", codigo_ibge=3549805, uf="SP"))

    def test_municipio_nao_sincronizado_fica_sem_selo(self):
        self.assertIsNone(lookup.nota_para(esfera_id="M", codigo_ibge=9999999, uf="SP"))

    def test_esfera_desconhecida_fica_sem_selo(self):
        self.assertIsNone(lookup.nota_para(esfera_id=None, codigo_ibge=3549805, uf="SP"))
