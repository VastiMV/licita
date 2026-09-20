"""Regras do model `Empresa` que nenhuma tela garante: empresa padrão única,
unicidade de CNPJ por tenant e inativação em vez de exclusão.

Precisam de banco (`manage.py test apps.empresas`).
"""

from __future__ import annotations

from django.db import IntegrityError
from django.test import TestCase

from apps.tenants.atual import tenant_atual

from .models import Empresa, Porte

CNPJ_A = "11222333000181"
CNPJ_B = "45723174000110"


def criar(**overrides) -> Empresa:
    base = {
        "tenant": tenant_atual(),
        "nome": "Inside Solutions Ltda",
        "cnpj": CNPJ_A,
        "porte": Porte.EPP,
        "cidade": "São Paulo",
        "uf": "SP",
    }
    return Empresa.objects.create(**{**base, **overrides})


class PadraoTests(TestCase):
    def test_primeira_empresa_do_tenant_nasce_padrao(self):
        # Cadastro com uma empresa só e nenhuma escolhida não faz sentido —
        # a proposta abriria sem CNPJ.
        self.assertTrue(criar().padrao)

    def test_segunda_empresa_nao_rouba_o_padrao(self):
        primeira = criar()
        segunda = criar(nome="Inside Log Ltda", cnpj=CNPJ_B)

        primeira.refresh_from_db()
        self.assertTrue(primeira.padrao)
        self.assertFalse(segunda.padrao)

    def test_marcar_como_padrao_desmarca_a_anterior(self):
        primeira = criar()
        segunda = criar(nome="Inside Log Ltda", cnpj=CNPJ_B)

        segunda.padrao = True
        segunda.save()

        primeira.refresh_from_db()
        self.assertFalse(primeira.padrao)
        self.assertTrue(Empresa.objects.filter(padrao=True).count() == 1)

    def test_salvar_a_propria_padrao_de_novo_nao_a_desmarca(self):
        # O `exclude(pk=...)` do save existe para isto: editar o telefone da
        # empresa padrão não pode deixar o tenant sem padrão nenhuma.
        empresa = criar()
        empresa.telefone = "1133334444"
        empresa.save()

        empresa.refresh_from_db()
        self.assertTrue(empresa.padrao)


class CadastroTests(TestCase):
    def test_cnpj_repetido_no_mesmo_tenant_e_recusado_pelo_banco(self):
        criar()
        with self.assertRaises(IntegrityError):
            Empresa.objects.create(tenant=tenant_atual(), nome="Outra", cnpj=CNPJ_A)

    def test_inativar_nao_apaga(self):
        empresa = criar()
        empresa.ativa = False
        empresa.save()

        self.assertEqual(Empresa.objects.count(), 1)
        self.assertEqual(Empresa.objects.ativas().count(), 0)

    def test_busca_acha_pelo_cnpj_com_e_sem_mascara(self):
        criar()
        self.assertEqual(Empresa.objects.buscar("11.222").count(), 1)
        self.assertEqual(Empresa.objects.buscar("11222").count(), 1)
        self.assertEqual(Empresa.objects.buscar("99999").count(), 0)

    def test_cnpj_formatado_e_cidade_uf_saem_prontos_para_a_tabela(self):
        empresa = criar()
        self.assertEqual(empresa.cnpj_formatado, "11.222.333/0001-81")
        self.assertEqual(empresa.cidade_uf, "São Paulo / SP")
