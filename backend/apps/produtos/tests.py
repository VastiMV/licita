"""Produtos: não duplicar, afinidade por fabricante e a tabela de preços que
o Cotador alimenta (ver `models.py`)."""

from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.cotador.test_views import cotacao_payload, item_cotado, oferta
from apps.fornecedores.models import Fornecedor
from apps.licitacoes.models import OportunidadeSalva

from .models import Fabricante, Marca, Modelo, PrecoFornecedor


class Base(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="op@empresa.com", password="x", nome="Vasti")
        self.client.force_authenticate(self.user)
        self.sul = Fornecedor.objects.create(nome="Sul", cnpj="11222333000181", email="a@a.com")
        self.norte = Fornecedor.objects.create(nome="Norte", cnpj="11444777000161", email="b@b.com")

    def post(self, url, dados):
        return self.client.post(f"/api/produtos/{url}", dados, format="json")


class CadastroTests(Base):
    def test_fabricante_com_o_mesmo_nome_nao_duplica_e_ganha_o_fornecedor(self):
        primeiro = self.post("fabricantes/", {"nome": "Jaguaribe", "fornecedor": self.sul.pk})
        segundo = self.post("fabricantes/", {"nome": "  jaguaribé ", "fornecedor": self.norte.pk})

        self.assertEqual(primeiro.status_code, 201)
        self.assertEqual(segundo.status_code, 200)
        self.assertEqual(segundo.data["id"], primeiro.data["id"])
        self.assertEqual(Fabricante.objects.count(), 1)
        self.assertEqual(
            sorted(f["nome"] for f in segundo.data["fornecedores"]), ["Norte", "Sul"]
        )

    def test_marca_repete_em_outro_fabricante_mas_nao_no_mesmo(self):
        a = Fabricante.objects.create(nome="A")
        b = Fabricante.objects.create(nome="B")

        self.assertEqual(self.post("marcas/", {"fabricante": a.pk, "nome": "Prolife"}).status_code, 201)
        self.assertEqual(self.post("marcas/", {"fabricante": a.pk, "nome": "PROLIFE"}).status_code, 200)
        self.assertEqual(self.post("marcas/", {"fabricante": b.pk, "nome": "Prolife"}).status_code, 201)
        self.assertEqual(Marca.objects.count(), 2)

    def test_modelo_unico_na_marca_e_renomear_nao_cria_duplicata(self):
        marca = Marca.objects.create(fabricante=Fabricante.objects.create(nome="A"), nome="M")
        cr40 = self.post("modelos/", {"marca": marca.pk, "nome": "CR-40"}).data
        cr50 = self.post("modelos/", {"marca": marca.pk, "nome": "CR-50"}).data

        resposta = self.client.put(
            f"/api/produtos/modelos/{cr50['id']}/", {"nome": "cr-40"}, format="json"
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Modelo.objects.get(pk=cr40["id"]).nome, "CR-40")

    def test_opcoes_de_fabricante_com_fornecedor_trazem_so_os_dele(self):
        Fabricante.objects.create(nome="Alfa")
        Fabricante.objects.create(nome="Zeta").fornecedores.add(self.sul)

        opcoes = self.client.get(
            "/api/produtos/fabricantes/opcoes/", {"fornecedor": self.sul.pk}
        ).data

        self.assertEqual([(o["nome"], o["afim"]) for o in opcoes], [("Zeta", True)])

    def test_tabela_lista_fabricantes_com_marcas_modelos_e_busca(self):
        marca = Marca.objects.create(fabricante=Fabricante.objects.create(nome="Jaguaribe"), nome="Prolife")
        Modelo.objects.create(marca=marca, nome="CR-40")
        Fabricante.objects.create(nome="Outro")

        pagina = self.client.get("/api/produtos/fabricantes/", {"busca": "cr-40"}).data

        self.assertEqual(pagina["count"], 1)
        linha = pagina["results"][0]
        self.assertEqual((linha["nome"], linha["marcas_total"], linha["modelos_total"]), ("Jaguaribe", 1, 1))


class CotacaoAprendeTests(Base):
    def setUp(self):
        super().setUp()
        self.salva = OportunidadeSalva.objects.create(
            cnpj_orgao="1", ano_compra="2026", sequencial_compra="1", objeto="Edital"
        )
        self.fabricante = Fabricante.objects.create(nome="Jaguaribe")
        self.marca = Marca.objects.create(fabricante=self.fabricante, nome="Prolife")
        self.modelo = Modelo.objects.create(marca=self.marca, nome="CR-40")

    def salvar(self, custo="100.00", **extras):
        o = oferta(fornecedor=self.sul.pk, custo_produto=custo, escolhida=True, **extras)
        return self.client.post(
            "/api/cotador/cotacoes/",
            cotacao_payload(oportunidade_id=self.salva.pk, itens=[item_cotado(ofertas=[o])]),
            format="json",
        )

    def test_modelo_completa_marca_e_fabricante_grava_preco_e_afinidade(self):
        resposta = self.salvar(modelo=self.modelo.pk)

        self.assertIn(resposta.status_code, (200, 201), resposta.content)
        gravada = resposta.data["itens"][0]["ofertas"][0]
        self.assertEqual(
            (gravada["fabricante_nome"], gravada["marca_nome"], gravada["modelo_nome"]),
            ("Jaguaribe", "Prolife", "CR-40"),
        )
        self.assertIn(self.sul, self.fabricante.fornecedores.all())
        preco = self.client.get(
            "/api/produtos/precos/sugerido/", {"fornecedor": self.sul.pk, "modelo": self.modelo.pk}
        ).data
        self.assertEqual(Decimal(preco["custo"]), Decimal("100"))

    def test_salvar_de_novo_com_o_mesmo_custo_nao_repete_o_preco(self):
        self.salvar(modelo=self.modelo.pk)
        self.salvar(modelo=self.modelo.pk)
        self.salvar(custo="90.00", modelo=self.modelo.pk)

        self.assertEqual(
            list(PrecoFornecedor.objects.values_list("custo", flat=True)),
            [Decimal("90"), Decimal("100")],
        )

    def test_marca_de_outro_fabricante_e_recusada(self):
        outro = Fabricante.objects.create(nome="Outro")

        resposta = self.salvar(fabricante=outro.pk, marca=self.marca.pk)

        self.assertEqual(resposta.status_code, 400)

    def test_sem_preco_sugerido_devolve_nulo(self):
        resposta = self.client.get(
            "/api/produtos/precos/sugerido/", {"fornecedor": self.sul.pk, "modelo": self.modelo.pk}
        )
        self.assertIsNone(resposta.data)
