"""Testes da cotação: a conta em `cotacao.py` e o endpoint que a grava.

A âncora é o exemplo documentado na planilha de origem — o mesmo que
`cotador.model.spec.ts` usa no frontend. Se as duas implementações da
fórmula divergirem, um destes dois testes cai.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .cotacao import (
    ItemCotacao,
    ParametrosCotacao,
    calcular_item,
    itens_de_lista,
    parametros_de_dict,
    totalizar,
)
from .models import Cotacao, OportunidadeSalva

# R$100 de produto + 8% de transporte + 10% de imposto + 35% de lucro.
PARAMETROS_EXEMPLO = ParametrosCotacao(
    transporte=Decimal("0.08"),
    icms=Decimal("0.10"),
    lucro_desejado=Decimal("0.35"),
    lucro_minimo=Decimal("0.10"),
)
ITEM_EXEMPLO = ItemCotacao(quantidade=Decimal("1"), valor_unitario_produto=Decimal("100"))

PARAMETROS_JSON = {
    "transporte": 0.08,
    "garantia": 0,
    "icms": 0.1,
    "pis": 0,
    "cofins": 0,
    "ipi": 0,
    "iss": 0,
    "lucro_desejado": 0.35,
    "lucro_minimo": 0.1,
}
ITENS_JSON = [
    {
        "fornecedor": "Papel A4",
        "quantidade": 10,
        "valor_unitario_produto": 100,
        "frete_fixo_unitario": 0,
        "outros_custos_unitarios": 0,
        "valor_referencia_edital": 0,
        "lance": 0,
    }
]


class CalculoCotacaoTests(APITestCase):
    def test_reproduz_o_exemplo_da_planilha(self):
        calculado = calcular_item(ITEM_EXEMPLO, PARAMETROS_EXEMPLO)

        self.assertEqual(calculado.custo_unitario, Decimal("108.00"))
        self.assertEqual(calculado.preco_unitario_final.quantize(Decimal("0.01")), Decimal("158.89"))
        self.assertEqual(
            calculado.lucro_liquido_unitario.quantize(Decimal("0.01")), Decimal("35.00")
        )

    def test_soma_frete_e_outros_custos_sem_aplicar_transporte_sobre_eles(self):
        item = ItemCotacao(
            quantidade=Decimal("1"),
            valor_unitario_produto=Decimal("100"),
            frete_fixo_unitario=Decimal("5"),
            outros_custos_unitarios=Decimal("2"),
        )

        # 100 + 8 (8% de 100, não de 107) + 5 + 2
        self.assertEqual(calcular_item(item, PARAMETROS_EXEMPLO).custo_unitario, Decimal("115.00"))

    def test_devolve_zero_quando_os_tributos_somam_cem_por_cento(self):
        parametros = ParametrosCotacao(icms=Decimal("1"))

        self.assertEqual(calcular_item(ITEM_EXEMPLO, parametros).preco_unitario_final, Decimal("0"))

    def test_totaliza_varios_itens(self):
        itens = [
            ItemCotacao(quantidade=Decimal("10"), valor_unitario_produto=Decimal("100")),
            ItemCotacao(quantidade=Decimal("3"), valor_unitario_produto=Decimal("450")),
        ]

        totais = totalizar(itens, PARAMETROS_EXEMPLO)

        # 10 x 158,89 (arredondado só no fim) + 3 x 715,00
        self.assertEqual(totais.valor_total, Decimal("3733.89"))
        self.assertEqual(totais.lucro_total, Decimal("822.50"))

    def test_converte_numero_de_json_sem_herdar_erro_binario_do_float(self):
        parametros = parametros_de_dict({"transporte": 0.1})

        # Decimal(0.1) guardaria 0.1000000000000000055511151231257827;
        # a conversão via str não.
        self.assertEqual(parametros.transporte, Decimal("0.1"))

    def test_trata_campo_ausente_ou_vazio_como_zero(self):
        itens = itens_de_lista([{"quantidade": 2}])

        self.assertEqual(itens[0].valor_unitario_produto, Decimal("0"))
        self.assertEqual(itens[0].quantidade, Decimal("2"))


class CotacaoEndpointTests(APITestCase):
    def setUp(self):
        self.usuario = get_user_model().objects.create_user(
            email="pregoeiro@empresa.com", password="segredo123"
        )
        self.client.force_authenticate(self.usuario)
        self.salva = OportunidadeSalva.objects.create(
            cnpj_orgao="00000000000191",
            ano_compra="2026",
            sequencial_compra="1",
            objeto="Aquisição de papel A4",
        )
        self.url = reverse("licitacoes-salva-cotacao", args=[self.salva.pk])

    def test_get_devolve_404_enquanto_a_oportunidade_nao_foi_cotada(self):
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_put_cria_a_cotacao_ligada_a_oportunidade(self):
        resposta = self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )

        self.assertEqual(resposta.status_code, 201)
        cotacao = Cotacao.objects.get()
        self.assertEqual(cotacao.oportunidade, self.salva)
        self.assertEqual(cotacao.atualizada_por, self.usuario)
        # A oportunidade enxerga a cotação pelo outro lado da relação.
        self.salva.refresh_from_db()
        self.assertEqual(self.salva.cotacao, cotacao)

    def test_put_calcula_os_totais_no_servidor(self):
        resposta = self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )

        self.assertEqual(Decimal(resposta.data["valor_total"]), Decimal("1588.89"))
        self.assertEqual(Decimal(resposta.data["lucro_total"]), Decimal("350.00"))

    def test_put_ignora_o_total_enviado_pelo_cliente(self):
        resposta = self.client.put(
            self.url,
            {
                "parametros": PARAMETROS_JSON,
                "itens": ITENS_JSON,
                "valor_total": "999999.99",
                "lucro_total": "999999.99",
            },
            format="json",
        )

        self.assertEqual(Decimal(resposta.data["valor_total"]), Decimal("1588.89"))

    def test_put_sobrescreve_a_cotacao_existente_em_vez_de_criar_outra(self):
        self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )
        resposta = self.client.put(
            self.url,
            {
                "parametros": PARAMETROS_JSON,
                "itens": [{**ITENS_JSON[0], "quantidade": 20}],
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(Cotacao.objects.count(), 1)
        self.assertEqual(Decimal(resposta.data["valor_total"]), Decimal("3177.78"))

    def test_get_devolve_a_cotacao_gravada(self):
        self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["itens"][0]["fornecedor"], "Papel A4")
        self.assertEqual(resposta.data["parametros"]["lucro_desejado"], 0.35)

    def test_recusa_cotacao_sem_item(self):
        resposta = self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": []}, format="json"
        )

        self.assertEqual(resposta.status_code, 400)

    def test_recusa_percentual_que_nao_e_numero(self):
        resposta = self.client.put(
            self.url,
            {"parametros": {**PARAMETROS_JSON, "icms": "dez por cento"}, "itens": ITENS_JSON},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)

    def test_nao_cota_oportunidade_removida_da_lista(self):
        self.salva.remover(por=self.usuario)

        resposta = self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )

        self.assertEqual(resposta.status_code, 404)

    def test_exige_autenticacao(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_apagar_a_oportunidade_apaga_a_cotacao_junto(self):
        self.client.put(
            self.url, {"parametros": PARAMETROS_JSON, "itens": ITENS_JSON}, format="json"
        )

        self.salva.delete()

        self.assertEqual(Cotacao.objects.count(), 0)
