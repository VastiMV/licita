"""Testes de `apps.catalogo.sync` — HTTP mockado (sem rede), banco real (Postgres,
precisa da extensão `pg_trgm` — ver migration `0001_initial`).

Portado de `tests/test_catalogo.py` do protótipo (branch `claude/tenta-de-novo-xu2sxb`).
"""

from __future__ import annotations

import httpx
from django.test import TestCase

from apps.integracoes.clients.compras_gov import ComprasGovClient

from . import sync
from .models import Pdm

PAGINAS = {
    1: {
        "resultado": [
            {"codigoPdm": 1, "nomePdm": "CAFÉ", "codigoClasse": 89, "nomeClasse": "Alimentos"},
            {"codigoPdm": 2, "nomePdm": "CAFETEIRA ELÉTRICA", "codigoClasse": 73},
            {"codigoPdm": 3, "nomePdm": "TESOURA", "codigoClasse": 75},
        ],
        "totalPaginas": 2,
    },
    2: {
        "resultado": [
            {"codigoPdm": 4, "nomePdm": "CAFÉ SOLÚVEL", "codigoClasse": 89},
        ],
        "totalPaginas": 2,
    },
}


def _handler(request: httpx.Request) -> httpx.Response:
    pagina = int(dict(request.url.params).get("pagina", 1))
    return httpx.Response(200, json=PAGINAS[pagina])


def _cliente_falso() -> ComprasGovClient:
    client = ComprasGovClient(base_url="https://dadosabertos.compras.gov.br")
    client._client = httpx.Client(base_url=client.base_url, transport=httpx.MockTransport(_handler))
    return client


class SincronizarTests(TestCase):
    def test_percorre_todas_as_paginas(self):
        self.assertEqual(Pdm.objects.count(), 0)

        with _cliente_falso() as client:
            gravados = sync.sincronizar(client)

        self.assertEqual(gravados, 4)
        self.assertEqual(Pdm.objects.count(), 4)

    def test_sincronizar_duas_vezes_nao_duplica(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)
        with _cliente_falso() as client:
            sync.sincronizar(client)

        self.assertEqual(Pdm.objects.count(), 4)

    def test_nome_normalizado_e_gravado_sem_acento(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)

        pdm = Pdm.objects.get(codigo_pdm=1)
        self.assertEqual(pdm.nome_pdm, "CAFÉ")
        self.assertEqual(pdm.nome_normalizado, "CAFE")
        self.assertEqual(pdm.nome_classe_normalizado, "ALIMENTOS")

    def test_registro_existente_e_atualizado_nao_duplicado(self):
        with _cliente_falso() as client:
            sync.sincronizar(client)

        # Uma segunda sincronização com o nome mudado atualiza, não cria outro.
        def handler_v2(request: httpx.Request) -> httpx.Response:
            pagina = int(dict(request.url.params).get("pagina", 1))
            payload = PAGINAS[pagina]
            if pagina == 1:
                payload = {
                    **payload,
                    "resultado": [{**payload["resultado"][0], "nomePdm": "CAFÉ TORRADO"}, *payload["resultado"][1:]],
                }
            return httpx.Response(200, json=payload)

        client = ComprasGovClient(base_url="https://dadosabertos.compras.gov.br")
        client._client = httpx.Client(base_url=client.base_url, transport=httpx.MockTransport(handler_v2))
        with client:
            sync.sincronizar(client)

        self.assertEqual(Pdm.objects.count(), 4)
        self.assertEqual(Pdm.objects.get(codigo_pdm=1).nome_pdm, "CAFÉ TORRADO")
