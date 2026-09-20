from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase

from apps.empresas.models import Empresa

from .atual import tenant_atual
from .models import TENANT_PADRAO_SLUG, Tenant


class TenantAtualTests(TestCase):
    def test_migracao_semeia_o_tenant_unico(self):
        self.assertEqual(Tenant.objects.count(), 1)
        self.assertEqual(Tenant.objects.get().slug, TENANT_PADRAO_SLUG)

    def test_tenant_atual_devolve_o_unico_existente(self):
        self.assertEqual(tenant_atual().slug, TENANT_PADRAO_SLUG)

    def test_tenant_atual_aceita_request_e_ignora_por_enquanto(self):
        # A assinatura já é a definitiva — quando o request passar a decidir,
        # nenhuma chamada do projeto precisa mudar.
        self.assertEqual(tenant_atual(request=object()), tenant_atual())

    def test_banco_sem_o_tenant_falha_explicitamente(self):
        Tenant.objects.all().delete()
        with self.assertRaises(ImproperlyConfigured):
            tenant_atual()


class TenantTemVariasEmpresasTests(TestCase):
    """Tenant **não** é empresa: um cliente disputa com mais de um CNPJ, e o
    caminho de volta (`tenant.empresas`) faz parte do model — sem ele o
    vínculo existiria só no banco."""

    def setUp(self):
        self.tenant = tenant_atual()

    def test_um_tenant_tem_varias_empresas(self):
        Empresa.objects.create(tenant=self.tenant, nome="Inside Solutions Ltda", cnpj="11222333000181")
        Empresa.objects.create(tenant=self.tenant, nome="Inside Log Ltda", cnpj="45723174000110")

        self.assertEqual(
            list(self.tenant.empresas.order_by("nome").values_list("nome", flat=True)),
            ["Inside Log Ltda", "Inside Solutions Ltda"],
        )

    def test_empresa_padrao_do_tenant(self):
        primeira = Empresa.objects.create(
            tenant=self.tenant, nome="Inside Solutions Ltda", cnpj="11222333000181"
        )
        Empresa.objects.create(tenant=self.tenant, nome="Inside Log Ltda", cnpj="45723174000110")

        self.assertEqual(self.tenant.empresa_padrao, primeira)

    def test_sem_empresa_cadastrada_nao_ha_padrao(self):
        self.assertIsNone(self.tenant.empresa_padrao)

    def test_empresa_inativa_nao_serve_de_padrao(self):
        empresa = Empresa.objects.create(
            tenant=self.tenant, nome="Inside Solutions Ltda", cnpj="11222333000181"
        )
        empresa.ativa = False
        empresa.save()

        self.assertIsNone(self.tenant.empresa_padrao)

    def test_tenant_com_empresa_nao_pode_ser_apagado(self):
        # PROTECT: apagar um tenant com dados é erro de operação, nunca
        # intenção.
        from django.db.models import ProtectedError

        Empresa.objects.create(tenant=self.tenant, nome="Inside Solutions Ltda", cnpj="11222333000181")

        with self.assertRaises(ProtectedError):
            self.tenant.delete()
