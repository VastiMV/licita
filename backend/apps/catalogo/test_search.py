"""Testes de `apps.catalogo.search` — busca por similaridade (trigram), banco
real (Postgres com `pg_trgm`, ver migration `0001_initial`).

Cobre as duas camadas: nome de produto (camada 1) e nome de
categoria/classe/grupo (camada 2) — ver docs/DOMINIO.md, "Busca textual —
camadas".
"""

from __future__ import annotations

from django.test import TestCase

from .models import Pdm
from .search import buscar_pdms


class BuscarPdmsTests(TestCase):
    def setUp(self):
        Pdm.objects.bulk_create(
            [
                Pdm(codigo_pdm=1, nome_pdm="CAFÉ", nome_normalizado="CAFE"),
                Pdm(codigo_pdm=2, nome_pdm="CAFÉ SOLÚVEL", nome_normalizado="CAFE SOLUVEL"),
                Pdm(codigo_pdm=3, nome_pdm="TESOURA", nome_normalizado="TESOURA"),
                Pdm(
                    codigo_pdm=4,
                    nome_pdm="TINTA IMPRESSORA",
                    nome_normalizado="TINTA IMPRESSORA",
                    nome_grupo="Escritório",
                    nome_grupo_normalizado="ESCRITORIO",
                    nome_classe="Material de escritório",
                    nome_classe_normalizado="MATERIAL DE ESCRITORIO",
                ),
                Pdm(
                    codigo_pdm=5,
                    nome_pdm="PAPEL A4",
                    nome_normalizado="PAPEL A4",
                    nome_grupo="Escritório",
                    nome_grupo_normalizado="ESCRITORIO",
                    nome_classe="Material de escritório",
                    nome_classe_normalizado="MATERIAL DE ESCRITORIO",
                ),
            ]
        )

    def test_camada_1_casa_por_nome_de_produto_ignorando_acento(self):
        nomes = [p.nome_pdm for p in buscar_pdms("cafe")]

        self.assertIn("CAFÉ", nomes)
        self.assertIn("CAFÉ SOLÚVEL", nomes)
        self.assertNotIn("TESOURA", nomes)

    def test_camada_1_produto_generico_vem_primeiro(self):
        achados = buscar_pdms("cafe")
        self.assertEqual(achados[0].nome_pdm, "CAFÉ")

    def test_camada_2_casa_por_categoria_quando_termo_nao_e_nome_de_produto(self):
        # "material de escritório" não é nome de nenhum PDM, mas é a
        # classe/grupo oficial de dois deles.
        nomes = {p.nome_pdm for p in buscar_pdms("material de escritorio")}

        self.assertEqual(nomes, {"TINTA IMPRESSORA", "PAPEL A4"})

    def test_sem_correspondencia_devolve_vazio(self):
        self.assertEqual(buscar_pdms("xyzabc123"), [])
        self.assertEqual(buscar_pdms("   "), [])

    def test_limite_e_respeitado(self):
        self.assertLessEqual(len(buscar_pdms("e", limite=2)), 2)
