"""Preços de fornecedor registrados à mão — "a Wololo vende caneta em caixa
com 10 a R$ 34" — e a busca "onde eu tenho preço de caneta?"."""

from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.fornecedores.models import Fornecedor

from .models import Fabricante, Marca, Modelo, OrigemPreco, PrecoFornecedor

URL = "/api/produtos/precos/"


class PrecosTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="op@empresa.com", password="x", nome="Vasti")
        self.client.force_authenticate(self.user)
        self.wololo = Fornecedor.objects.create(
            nome="Wololo Ltda", cnpj="11222333000181", email="a@a.com"
        )
        self.norte = Fornecedor.objects.create(nome="Norte", cnpj="11444777000161", email="b@b.com")

    def registrar(self, fornecedor=None, **dados):
        payload = {
            "fornecedor": (fornecedor or self.wololo).pk,
            "descricao": "Caneta esferográfica azul",
            "embalagem": "Caixa",
            "quantidade_embalagem": 10,
            "preco_embalagem": "34.00",
            **dados,
        }
        return self.client.post(URL, payload, format="json")

    def test_preco_da_caixa_vira_custo_unitario(self):
        resposta = self.registrar()

        self.assertEqual(resposta.status_code, 201, resposta.content)
        self.assertEqual(Decimal(resposta.data["custo"]), Decimal("3.4"))
        self.assertEqual(Decimal(resposta.data["preco_embalagem"]), Decimal("34"))
        self.assertEqual(resposta.data["produto"], "Caneta esferográfica azul")
        self.assertEqual(resposta.data["origem"], OrigemPreco.MANUAL)
        self.assertEqual(resposta.data["registrado_por"], "Vasti")

    def test_sem_produto_e_recusado(self):
        resposta = self.registrar(descricao="  ")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("descricao", resposta.data)

    def test_quantidade_zero_e_recusada(self):
        self.assertEqual(self.registrar(quantidade_embalagem=0).status_code, 400)

    def test_busca_sem_acento_traz_o_mais_barato_primeiro(self):
        self.registrar()
        self.registrar(fornecedor=self.norte, preco_embalagem="30.00")
        self.registrar(descricao="Lápis preto", preco_embalagem="5.00")

        pagina = self.client.get(URL, {"busca": "CANÉTA"}).data

        self.assertEqual(pagina["count"], 2)
        self.assertEqual(
            [p["fornecedor"]["nome"] for p in pagina["results"]], ["Norte", "Wololo Ltda"]
        )

    def test_preco_novo_substitui_o_antigo_na_lista_mas_fica_no_historico(self):
        self.registrar()
        self.registrar(preco_embalagem="36.00")

        atuais = self.client.get(URL, {"fornecedor": self.wololo.pk}).data
        historico = self.client.get(URL, {"fornecedor": self.wololo.pk, "historico": 1}).data

        self.assertEqual(atuais["count"], 1)
        self.assertEqual(Decimal(atuais["results"][0]["preco_embalagem"]), Decimal("36"))
        self.assertEqual(historico["count"], 2)

    def test_embalagem_diferente_e_outra_oferta(self):
        self.registrar()
        self.registrar(quantidade_embalagem=50, preco_embalagem="150.00")

        self.assertEqual(self.client.get(URL, {"fornecedor": self.wololo.pk}).data["count"], 2)

    def test_filtro_por_fornecedor(self):
        self.registrar()
        self.registrar(fornecedor=self.norte)

        pagina = self.client.get(URL, {"fornecedor": self.norte.pk}).data

        self.assertEqual([p["fornecedor"]["nome"] for p in pagina["results"]], ["Norte"])

    def test_busca_acha_produto_cadastrado_pelo_modelo(self):
        marca = Marca.objects.create(fabricante=Fabricante.objects.create(nome="BIC"), nome="Cristal")
        modelo = Modelo.objects.create(marca=marca, nome="Azul")
        PrecoFornecedor.objects.create(
            fornecedor=self.wololo, modelo=modelo, custo=Decimal("2.5"), origem=OrigemPreco.COTADOR
        )

        linha = self.client.get(URL, {"busca": "cristal"}).data["results"][0]

        self.assertEqual(linha["produto"], "BIC › Cristal › Azul")
        self.assertEqual(Decimal(linha["preco_embalagem"]), Decimal("2.5"))

    def test_excluir(self):
        preco = self.registrar().data

        self.assertEqual(self.client.delete(f"{URL}{preco['id']}/").status_code, 204)
        self.assertFalse(PrecoFornecedor.objects.exists())
