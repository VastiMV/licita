"""A conta da situação — o coração do módulo.

Nenhuma coluna guarda "vencido": é sempre comparação com hoje. Estes testes
andam pelas datas de fronteira, que é onde esse tipo de regra costuma errar.
"""

from __future__ import annotations

import datetime as dt

from django.test import TestCase
from django.utils import timezone

from apps.empresas.models import Empresa
from apps.tenants.atual import tenant_atual

from .models import DIAS_A_VENCER, Documento, Situacao, TipoDocumento, VersaoDocumento


def empresa(**overrides) -> Empresa:
    base = {"tenant": tenant_atual(), "nome": "Inside Solutions Ltda", "cnpj": "11222333000181"}
    return Empresa.objects.create(**{**base, **overrides})


def documento(emp: Empresa, nome="Certificado de Regularidade do FGTS (CRF)") -> Documento:
    return Documento.objects.get(empresa=emp, tipo__nome=nome)


def versao(doc: Documento, validade: dt.date | None = None, **extras) -> VersaoDocumento:
    return VersaoDocumento.objects.create(
        documento=doc,
        versao=doc.proxima_versao(),
        validade=validade,
        arquivo=f"tenant/x/v{doc.proxima_versao()}.pdf",
        nome_original="certidao.pdf",
        tamanho=1024,
        **extras,
    )


class CatalogoTests(TestCase):
    def test_a_migracao_semeia_os_quatro_blocos(self):
        blocos = set(TipoDocumento.objects.values_list("bloco", flat=True))

        self.assertEqual(blocos, {"juridica", "fiscal", "economica", "tecnica", "outros"})

    def test_catalogo_padrao_nao_pertence_a_tenant_nenhum(self):
        # Tenant nulo = serve a todo cliente; preenchido = o que aquele
        # cliente acrescentou.
        self.assertFalse(TipoDocumento.objects.filter(tenant__isnull=False).exists())

    def test_contrato_social_e_atestado_nao_vencem(self):
        for nome in ("Contrato social consolidado", "Atestado de capacidade técnica"):
            with self.subTest(nome=nome):
                self.assertFalse(TipoDocumento.objects.get(nome=nome).exige_validade)


class VagasTests(TestCase):
    def test_empresa_nova_nasce_com_as_vagas_obrigatorias_abertas(self):
        # Tela em branco não diz o que falta; "nove pendentes" diz.
        emp = empresa()

        obrigatorios = TipoDocumento.objects.filter(obrigatorio=True).count()
        self.assertEqual(emp.documentos.count(), obrigatorios)
        self.assertTrue(all(d.situacao == Situacao.PENDENTE for d in emp.documentos.all()))

    def test_tipo_opcional_nao_abre_vaga_sozinho(self):
        emp = empresa()

        self.assertFalse(
            emp.documentos.filter(tipo__nome="Registro em entidade profissional").exists()
        )

    def test_editar_a_empresa_nao_reabre_vaga_arquivada(self):
        emp = empresa()
        doc = documento(emp)
        doc.arquivado_em = timezone.now()
        doc.save()

        emp.telefone = "1133334444"
        emp.save()

        doc.refresh_from_db()
        self.assertIsNotNone(doc.arquivado_em)


class SituacaoTests(TestCase):
    def setUp(self):
        self.empresa = empresa()
        self.hoje = timezone.localdate()

    def test_sem_versao_e_pendente(self):
        self.assertEqual(documento(self.empresa).situacao, Situacao.PENDENTE)

    def test_validade_no_futuro_distante_e_valido(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje + dt.timedelta(days=DIAS_A_VENCER + 1))

        self.assertEqual(doc.situacao, Situacao.VALIDO)

    def test_fronteira_de_a_vencer(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje + dt.timedelta(days=DIAS_A_VENCER))

        self.assertEqual(doc.situacao, Situacao.A_VENCER)

    def test_vence_hoje_ainda_vale(self):
        # Certidão vale o dia inteiro do vencimento — tratar como vencida
        # tiraria a empresa de uma disputa em que ela está habilitada.
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje)

        self.assertEqual(doc.situacao, Situacao.A_VENCER)
        self.assertEqual(doc.situacao_label, "Vence hoje")

    def test_venceu_ontem_e_vencido(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje - dt.timedelta(days=1))

        self.assertEqual(doc.situacao, Situacao.VENCIDO)
        self.assertEqual(doc.situacao_label, "Vencido ontem")

    def test_label_diz_o_numero_porque_e_o_numero_que_faz_agir(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje + dt.timedelta(days=4))

        self.assertEqual(doc.situacao_label, "Vence em 4 dias")

    def test_tipo_sem_validade_com_arquivo_fica_vigente(self):
        doc = documento(self.empresa, nome="Contrato social consolidado")
        versao(doc, validade=None)

        self.assertEqual(doc.situacao, Situacao.VALIDO)
        self.assertEqual(doc.situacao_label, "Vigente")

    def test_tipo_sem_validade_nunca_entra_na_conta_de_vencidos(self):
        doc = documento(self.empresa, nome="Contrato social consolidado")
        # Mesmo com uma data antiga gravada por engano na versão.
        versao(doc, validade=self.hoje - dt.timedelta(days=500))

        self.assertNotEqual(doc.situacao, Situacao.VENCIDO)

    def test_arquivado_vence_qualquer_outra_conta(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje - dt.timedelta(days=1))
        doc.arquivado_em = timezone.now()

        self.assertEqual(doc.situacao, Situacao.ARQUIVADO)


class VersoesTests(TestCase):
    def setUp(self):
        self.empresa = empresa()
        self.hoje = timezone.localdate()

    def test_renovar_empurra_a_anterior_para_o_historico(self):
        # O CRF vence de 30 em 30 dias: isso acontece doze vezes por ano e
        # nunca pode virar "CRF (1).pdf".
        doc = documento(self.empresa)
        antiga = versao(doc, validade=self.hoje - dt.timedelta(days=1))
        nova = versao(doc, validade=self.hoje + dt.timedelta(days=29))

        self.assertEqual(doc.versao_atual, nova)
        self.assertEqual(nova.versao, 2)
        self.assertEqual(doc.situacao, Situacao.A_VENCER)
        # E a anterior continua recuperável — é o que se prova depois.
        self.assertIn(antiga, doc.versoes.all())

    def test_a_validade_e_da_versao_nao_do_documento(self):
        doc = documento(self.empresa)
        versao(doc, validade=self.hoje + dt.timedelta(days=10))
        versao(doc, validade=self.hoje + dt.timedelta(days=40))

        self.assertEqual(doc.validade, self.hoje + dt.timedelta(days=40))

    def test_duas_versoes_nao_podem_ter_o_mesmo_numero(self):
        from django.db import IntegrityError

        doc = documento(self.empresa)
        versao(doc)

        with self.assertRaises(IntegrityError):
            VersaoDocumento.objects.create(
                documento=doc, versao=1, arquivo="x", nome_original="x.pdf", tamanho=1
            )


class UnicidadeTests(TestCase):
    def test_uma_vaga_por_tipo_na_mesma_empresa(self):
        from django.db import IntegrityError

        emp = empresa()
        tipo = TipoDocumento.objects.get(nome="Certificado de Regularidade do FGTS (CRF)")

        with self.assertRaises(IntegrityError):
            Documento.objects.create(tenant=emp.tenant, empresa=emp, tipo=tipo)

    def test_o_tipo_livre_aceita_varios_com_titulos_diferentes(self):
        emp = empresa()
        livre = TipoDocumento.objects.get(nome="Outro documento")

        Documento.objects.create(tenant=emp.tenant, empresa=emp, tipo=livre, titulo="Alvará sanitário")
        Documento.objects.create(tenant=emp.tenant, empresa=emp, tipo=livre, titulo="Licença ambiental")

        self.assertEqual(emp.documentos.filter(tipo=livre).count(), 2)

    def test_duas_empresas_tem_cada_uma_a_sua_vaga(self):
        primeira = empresa()
        segunda = empresa(nome="Inside Log Ltda", cnpj="45723174000110")

        self.assertEqual(documento(primeira).empresa, primeira)
        self.assertEqual(documento(segunda).empresa, segunda)
