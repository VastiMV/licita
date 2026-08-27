"""Testes de `apps.capag.sync` — HTTP mockado (sem rede), banco real (Postgres).

Mesmo padrão de `apps/catalogo/test_sync.py`.
"""

from __future__ import annotations

import io

import httpx
from django.test import TestCase
from openpyxl import Workbook

from . import sync
from .models import EstadoCapag, MunicipioCapag


def _xlsx_municipios() -> bytes:
    """Réplica mínima da estrutura real (ver docstring de `sync.py`): duas
    linhas de metadado antes do cabeçalho de verdade, na aba de sync."""

    livro = Workbook()
    aba = livro.active
    aba.title = sync.ABA_MUNICIPIOS
    aba.append([None, "CAPAG Ano Base 2025"])
    aba.append([None, "CAPAG Ano Base 2024"])
    aba.append(["Código Município Completo", "Nome_Município", "UF", "CAPAG"])
    aba.append([3550308, "São Paulo", "SP", "B"])
    aba.append([3304557, "Rio de Janeiro", "RJ", "C"])
    aba.append([9999999, "Sem Nota", "XX", "n.d."])  # não avaliado — deve ser descartado

    buf = io.BytesIO()
    livro.save(buf)
    return buf.getvalue()


CSV_ESTADOS = (
    "UF;Indicador 1;Nota 1;Indicador 2;Nota 2;Indicador 3;Nota 3;"
    "Classificação da CAPAG;Qualidade da informação contábil e fiscal;Observação\n"
    "SP;147,35%;C;89,75%;B;1,97%;B;B;Bicf;\n"
    "RJ;231,81%;C;98,44%;C;-8,7%;C;D;Bicf;\n"
)


def _handler(request: httpx.Request) -> httpx.Response:
    url = str(request.url)
    if "package_show" in url:
        dataset = dict(request.url.params).get("id")
        return httpx.Response(
            200,
            json={"result": {"resources": [{"url": f"https://exemplo.gov.br/{dataset}.arquivo"}]}},
        )
    if url.endswith("capag-municipios.arquivo"):
        return httpx.Response(200, content=_xlsx_municipios())
    if url.endswith("capag-estados.arquivo"):
        return httpx.Response(200, text=CSV_ESTADOS)
    return httpx.Response(404)


def _cliente_falso() -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(_handler))


class SincronizarTests(TestCase):
    def test_grava_municipios_e_estados(self):
        with _cliente_falso() as client:
            resultado = sync.sincronizar(client)

        self.assertEqual(resultado, {"municipios": 2, "estados": 2})
        self.assertEqual(MunicipioCapag.objects.count(), 2)
        self.assertEqual(EstadoCapag.objects.count(), 2)

    def test_municipio_sem_nota_avaliavel_e_descartado(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)

        self.assertFalse(MunicipioCapag.objects.filter(codigo_ibge=9999999).exists())

    def test_gravacao_confere_os_campos(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)

        sp = MunicipioCapag.objects.get(codigo_ibge=3550308)
        self.assertEqual(sp.nome_municipio, "São Paulo")
        self.assertEqual(sp.uf, "SP")
        self.assertEqual(sp.nota, "B")

        rj = EstadoCapag.objects.get(uf="RJ")
        self.assertEqual(rj.nota, "D")

    def test_sincronizar_duas_vezes_nao_duplica(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)
        with _cliente_falso() as client:
            sync.sincronizar(client)

        self.assertEqual(MunicipioCapag.objects.count(), 2)
        self.assertEqual(EstadoCapag.objects.count(), 2)
