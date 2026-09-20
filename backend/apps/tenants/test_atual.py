from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase

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
