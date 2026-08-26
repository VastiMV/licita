"""Testes de `apps.licitacoes.services` — HTTP mockado (sem rede), sem banco
(a orquestração não persiste — ver docs/DOMINIO.md).

Portado de `tests/test_oportunidades.py` do protótipo (branch
`claude/tenta-de-novo-xu2sxb`). `codigos_pdm` aqui é passado já resolvido —
no protótipo, quem resolvia a palavra em códigos era o router; aqui é
`apps/licitacoes/views.py` (ver `apps/catalogo/search.py`).
"""

from __future__ import annotations

from contextlib import contextmanager
from unittest import mock

import httpx
from django.test import SimpleTestCase

from apps.integracoes.test_compras_gov import RESPOSTA_CONTRATACOES, RESPOSTA_ITENS
from apps.integracoes.test_compras_gov import _client_falso as client_falso
from apps.integracoes.test_pncp import RESPOSTA_BUSCA, RESPOSTA_ITENS_PNCP
from apps.integracoes.test_pncp import _pncp_falso as pncp_falso

from . import services
from .services import BuscaSemCorrespondenciaNoCatalogo, buscar_oportunidades

# Itens vindos da busca por PDM carregam o idCompra.
ITENS_POR_CATALOGO = {
    "resultado": [
        {
            "idCompra": "925874000052026",
            "idCompraItem": "925874000052026-1",
            "numeroItemCompra": 1,
            "descricaoResumida": "Café torrado",
            "descricaodetalhada": "Café torrado e moído, pacote de 500g, tipo tradicional",
            "quantidade": 200.0,
            "unidadeMedida": "PACOTE",
            "valorUnitarioEstimado": 18.5,
        }
    ],
    "totalPaginas": 1,
}

PDMS_CAFE = [1, 4]


def _montar_handler():
    def handler(request: httpx.Request) -> httpx.Response:
        caminho = request.url.path
        if "2_consultarItensContratacoes" in caminho:
            return httpx.Response(200, json=ITENS_POR_CATALOGO)
        if "1.1_consultarContratacoes" in caminho:
            return httpx.Response(200, json=RESPOSTA_CONTRATACOES)
        if "2.1_consultarItens" in caminho:
            return httpx.Response(200, json=RESPOSTA_ITENS)
        return httpx.Response(200, json=RESPOSTA_CONTRATACOES)

    return handler


def _montar_handler_pncp(resposta_busca=None, resposta_itens=None, status=200):
    def handler(request: httpx.Request) -> httpx.Response:
        if status != 200:
            return httpx.Response(status, text="indisponível")
        if request.url.path == "/api/search/":
            return httpx.Response(
                200, json=resposta_busca if resposta_busca is not None else RESPOSTA_BUSCA
            )
        return httpx.Response(
            200, json=resposta_itens if resposta_itens is not None else RESPOSTA_ITENS_PNCP
        )

    return handler


@contextmanager
def _pncp(ligado: bool):
    """Substitui `env` inteiro no módulo — `usar_busca_pncp` é campo de um
    dataclass frozen, não dá para patchar o atributo direto."""

    with mock.patch.object(services, "env", mock.Mock(usar_busca_pncp=ligado)):
        yield


def _buscar(handler=None, **kwargs):
    with client_falso(handler or _montar_handler()) as client:
        return buscar_oportunidades(client, data_inicial="2026-07-01", data_final="2026-09-30", **kwargs)


def _buscar_com_pncp(handler_pncp, handler_compras=None, **kwargs):
    with pncp_falso(handler_pncp) as pncp:
        return _buscar(handler_compras, pncp_client=pncp, **kwargs)


class BuscaPorCatalogoTests(SimpleTestCase):
    """PNCP desligado — só o índice de catálogo entra em jogo."""

    def test_busca_por_palavra_usa_catalogo_e_encontra_itens(self):
        with _pncp(False):
            resultados = _buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE)

        self.assertGreaterEqual(len(resultados), 1)
        op = resultados[0]
        self.assertIn("Café torrado", op["descricao_resumida"])
        self.assertIn("500g", op["descricao_detalhada"])
        self.assertEqual(op["contratacao_uf"], "SP")
        self.assertEqual(op["contratacao_uasg"], "925874")

    def test_palavra_sem_pdm_correspondente_avisa(self):
        with _pncp(False):
            with self.assertRaises(BuscaSemCorrespondenciaNoCatalogo):
                _buscar(palavra_chave="xyzabc", codigos_pdm=[])

    def test_filtro_de_uf_descarta_contratacao_de_outro_estado(self):
        with _pncp(False):
            self.assertEqual(_buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE, uf="RJ"), [])
            self.assertGreaterEqual(len(_buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE, uf="SP")), 1)

    def test_filtro_de_modalidade_usa_codigo_da_contratacao(self):
        with _pncp(False):
            self.assertGreaterEqual(
                len(_buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE, codigo_modalidade="6")), 1
            )
            self.assertEqual(
                _buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE, codigo_modalidade="8"), []
            )

    def test_sem_palavra_chave_navega_contratacoes_do_periodo(self):
        with _pncp(False):
            resultados = _buscar(codigo_modalidade="6")
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]["numero_item"], 1)

    def test_links_presentes_no_resultado(self):
        with _pncp(False):
            op = _buscar(palavra_chave="Café", codigos_pdm=PDMS_CAFE)[0]
        self.assertIn("compra=925874000052026", op["link_compras_gov"])
        self.assertTrue(op["link_pncp"].startswith("https://pncp.gov.br/app/editais/"))

    def test_itens_repetidos_entre_pdms_nao_duplicam_no_resultado(self):
        with _pncp(False):
            resultados = _buscar(palavra_chave="Café", codigos_pdm=[1, 4, 7, 9])
        chaves = [(op["contratacao_id_compra"], op["numero_item"]) for op in resultados]
        self.assertEqual(len(chaves), len(set(chaves)))


class BuscaTextualPncpTests(SimpleTestCase):
    """PNCP ligado — caminho preferido."""

    def test_busca_por_palavra_usa_o_pncp_quando_disponivel(self):
        with _pncp(True):
            resultados = _buscar_com_pncp(_montar_handler_pncp(), palavra_chave="café", codigos_pdm=[])

        # Só o item que cita a palavra entra; o açúcar do mesmo edital fica de fora.
        self.assertEqual(len(resultados), 1)
        op = resultados[0]
        self.assertIn("CAFE TORRADO", op["descricao_resumida"])
        self.assertEqual(op["contratacao_uf"], "SP")
        self.assertEqual(op["contratacao_orgao_nome"], "Prefeitura Municipal Exemplo")
        self.assertEqual(op["link_pncp"], "https://pncp.gov.br/app/editais/12345678000199/2026/5")

    def test_pncp_dispensa_o_catalogo_de_pdm(self):
        with _pncp(True):
            resultados = _buscar_com_pncp(_montar_handler_pncp(), palavra_chave="café", codigos_pdm=[])
        self.assertTrue(resultados)  # sem codigos_pdm e sem BuscaSemCorrespondenciaNoCatalogo

    def test_acento_nao_muda_o_resultado(self):
        with _pncp(True):
            com = _buscar_com_pncp(_montar_handler_pncp(), palavra_chave="café", codigos_pdm=[])
            sem = _buscar_com_pncp(_montar_handler_pncp(), palavra_chave="cafe", codigos_pdm=[])
        self.assertEqual(len(com), len(sem))
        self.assertEqual(len(com), 1)

    def test_edital_casa_mas_nenhum_item_cita_a_palavra(self):
        """Objeto genérico ("gêneros alimentícios") -> mostra a compra inteira."""

        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(), palavra_chave="alimentícios", codigos_pdm=[]
            )
        self.assertEqual(len(resultados), len(RESPOSTA_ITENS_PNCP))

    def test_edital_sem_itens_publicados_ainda_aparece(self):
        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(resposta_itens=[]), palavra_chave="café", codigos_pdm=[]
            )
        self.assertEqual(len(resultados), 1)
        self.assertTrue(resultados[0]["contratacao_objeto"].startswith("Aquisição de café"))
        self.assertIsNone(resultados[0]["numero_item"])

    def test_pncp_fora_do_ar_cai_no_indice_de_pdm(self):
        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(status=503), palavra_chave="Café", codigos_pdm=PDMS_CAFE
            )
        self.assertGreaterEqual(len(resultados), 1)
        self.assertIn("Café torrado", resultados[0]["descricao_resumida"])

    def test_pncp_sem_resultado_cai_no_indice_de_pdm(self):
        vazio = {"items": [], "total": 0}
        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(resposta_busca=vazio), palavra_chave="Café", codigos_pdm=PDMS_CAFE
            )
        self.assertGreaterEqual(len(resultados), 1)
        self.assertIn("Café torrado", resultados[0]["descricao_resumida"])

    def test_sem_pncp_e_sem_pdm_o_aviso_continua(self):
        vazio = {"items": [], "total": 0}
        with _pncp(True):
            with self.assertRaises(BuscaSemCorrespondenciaNoCatalogo):
                _buscar_com_pncp(
                    _montar_handler_pncp(resposta_busca=vazio), palavra_chave="xyzabc", codigos_pdm=[]
                )

    def test_filtro_de_unidade_aplicado_sobre_o_resultado_do_pncp(self):
        with _pncp(True):
            self.assertEqual(
                _buscar_com_pncp(
                    _montar_handler_pncp(), palavra_chave="café", codigos_pdm=[], codigo_unidade="000000"
                ),
                [],
            )
            self.assertTrue(
                _buscar_com_pncp(
                    _montar_handler_pncp(), palavra_chave="café", codigos_pdm=[], codigo_unidade="925874"
                )
            )

    def test_filtro_que_zera_nao_dispara_a_reserva(self):
        """Filtro restritivo é resposta, não ausência de resposta."""

        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(),
                palavra_chave="café",
                codigos_pdm=PDMS_CAFE,  # a reserva acharia algo, se fosse consultada
                codigo_unidade="000000",
            )
        self.assertEqual(resultados, [])

    def test_periodo_da_tela_recorta_o_resultado_do_pncp(self):
        """O buscador do portal filtra por situação, não por data — o recorte é nosso."""

        with _pncp(True):
            with pncp_falso(_montar_handler_pncp()) as pncp:
                with client_falso(_montar_handler()) as client:
                    fora = buscar_oportunidades(
                        client,
                        data_inicial="2026-01-01",
                        data_final="2026-02-01",  # edital do fixture é de 2026-08-20
                        palavra_chave="café",
                        codigos_pdm=[],
                        pncp_client=pncp,
                    )
        self.assertEqual(fora, [])

    def test_edital_sem_data_legivel_nao_e_descartado(self):
        """Campo de data ausente é degradação, não motivo para sumir com o edital."""

        sem_data = {"items": [dict(RESPOSTA_BUSCA["items"][0])], "total": 1}
        del sem_data["items"][0]["data_publicacao_pncp"]

        with _pncp(True):
            resultados = _buscar_com_pncp(
                _montar_handler_pncp(resposta_busca=sem_data), palavra_chave="café", codigos_pdm=[]
            )
        self.assertEqual(len(resultados), 1)
