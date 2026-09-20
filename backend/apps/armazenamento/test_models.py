"""A configuração no banco — sobretudo a disciplina do segredo.

Precisam de banco (`manage.py test apps.armazenamento`).
"""

from __future__ import annotations

from django.test import TestCase

from apps.tenants.atual import tenant_atual

from .models import ConfigArmazenamento


def config(**overrides) -> ConfigArmazenamento:
    base = {
        "tenant": tenant_atual(),
        "driver": "r2",
        "opcoes": {
            "endpoint_url": "https://conta.r2.cloudflarestorage.com",
            "bucket": "licita-documentos",
            "access_key": "chave-publica",
        },
    }
    return ConfigArmazenamento.objects.create(**{**base, **overrides})


class SegredosTests(TestCase):
    def test_segredo_e_gravado_cifrado(self):
        c = config()
        c.definir_segredos({"secret_key": "super-secreto"})
        c.save()

        cru = ConfigArmazenamento.objects.values("segredos_cifrados").get()["segredos_cifrados"]
        self.assertNotIn("super-secreto", cru)
        self.assertEqual(c.segredos["secret_key"], "super-secreto")

    def test_valor_vazio_nao_apaga_o_segredo_existente(self):
        # A tela manda o campo vazio quando ninguém digitou nada — apagar a
        # credencial nesse caso seria fácil demais.
        c = config()
        c.definir_segredos({"secret_key": "super-secreto"})
        c.definir_segredos({"secret_key": ""})

        self.assertEqual(c.segredos["secret_key"], "super-secreto")

    def test_definir_segredo_marca_a_data(self):
        c = config()
        self.assertIsNone(c.segredos_definidos_em)

        c.definir_segredos({"secret_key": "x"})
        self.assertIsNotNone(c.segredos_definidos_em)

    def test_trocar_de_driver_descarta_segredo_que_nao_serve_mais(self):
        c = config()
        c.definir_segredos({"secret_key": "do-r2"})

        c.driver = "local"
        c.limpar_segredos_de_outro_driver()

        self.assertEqual(c.segredos, {})
        self.assertIsNone(c.segredos_definidos_em)

    def test_segredos_definidos_lista_nomes_e_nao_valores(self):
        c = config()
        c.definir_segredos({"secret_key": "super-secreto"})

        self.assertEqual(c.segredos_definidos, ["secret_key"])


class CompletaTests(TestCase):
    def test_sem_segredo_a_configuracao_nao_esta_completa(self):
        self.assertFalse(config().completa)

    def test_com_todos_os_obrigatorios_esta_completa(self):
        c = config()
        c.definir_segredos({"secret_key": "x"})

        self.assertTrue(c.completa)

    def test_campo_opcional_nao_impede(self):
        # "prefixo" é opcional no driver — faltar não pode travar upload.
        c = config()
        c.definir_segredos({"secret_key": "x"})

        self.assertNotIn("prefixo", c.opcoes)
        self.assertTrue(c.completa)

    def test_instanciar_junta_opcoes_e_segredos(self):
        c = config()
        c.definir_segredos({"secret_key": "x"})

        driver = c.instanciar()
        self.assertEqual(driver.bucket, "licita-documentos")
        self.assertEqual(driver.secret_key, "x")
        # R2 ignora região, mas a assinatura v4 exige alguma.
        self.assertEqual(driver.regiao, "auto")


class PorTenantNaoPorEmpresaTests(TestCase):
    """O bucket é do **cliente**, não de cada empresa dele: os documentos de
    todas as empresas convivem no mesmo destino, separados por caminho."""

    def test_a_configuracao_e_alcancavel_a_partir_do_tenant(self):
        c = config()

        self.assertEqual(tenant_atual().config_armazenamento.get(), c)

    def test_um_tenant_com_varias_empresas_tem_uma_configuracao_so(self):
        from apps.empresas.models import Empresa

        tenant = tenant_atual()
        Empresa.objects.create(tenant=tenant, nome="Inside Solutions Ltda", cnpj="11222333000181")
        Empresa.objects.create(tenant=tenant, nome="Inside Log Ltda", cnpj="45723174000110")
        config()

        self.assertEqual(tenant.empresas.count(), 2)
        self.assertEqual(tenant.config_armazenamento.count(), 1)
