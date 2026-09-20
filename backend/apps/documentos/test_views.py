"""Endpoints do dossiê (`/api/documentos/`), incluindo o upload.

O armazenamento usado é o driver `local` num diretório temporário — teste
nenhum do projeto fala com bucket de verdade (mesma disciplina de
`apps/integracoes`, que nunca faz rede).
"""

from __future__ import annotations

import datetime as dt
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.armazenamento.models import ConfigArmazenamento
from apps.empresas.models import Empresa
from apps.tenants.atual import tenant_atual

from .models import Documento, TipoDocumento, TipoEvento

CRF = "Certificado de Regularidade do FGTS (CRF)"


def pdf(nome="certidao.pdf", conteudo=b"%PDF-1.4 conteudo") -> SimpleUploadedFile:
    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


class BaseDocumentos(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="operador@empresa.com", password="x")
        self.client.force_authenticate(self.user)

        self.tenant = tenant_atual()
        self.empresa = Empresa.objects.create(
            tenant=self.tenant, nome="Inside Solutions Ltda", cnpj="11222333000181"
        )
        self.raiz = tempfile.mkdtemp()
        ConfigArmazenamento.objects.create(
            tenant=self.tenant, driver="local", opcoes={"raiz": self.raiz}
        )

    @property
    def crf(self) -> Documento:
        return Documento.objects.get(empresa=self.empresa, tipo__nome=CRF)


class ListaTests(BaseDocumentos):
    def test_exige_autenticacao(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/documentos/").status_code, 401)

    def test_os_contadores_sao_disjuntos_e_somam_o_total(self):
        hoje = timezone.localdate()
        self._subir(self.crf, validade=hoje + dt.timedelta(days=5))

        resposta = self.client.get("/api/documentos/", {"empresa": self.empresa.id})
        soma = (
            resposta.data["validos"]
            + resposta.data["a_vencer"]
            + resposta.data["vencidos"]
            + resposta.data["pendentes"]
        )

        self.assertEqual(resposta.data["a_vencer"], 1)
        self.assertEqual(resposta.data["validos"], 0)
        self.assertEqual(soma, len(resposta.data["results"]))

    def test_lista_traz_os_contadores_junto(self):
        # Contador numa chamada e lista em outra deixaria a tela mostrando
        # número de um momento e linhas de outro.
        resposta = self.client.get("/api/documentos/", {"empresa": self.empresa.id})

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["pendentes"], len(resposta.data["results"]))
        self.assertEqual(resposta.data["vencidos"], 0)
        self.assertEqual(resposta.data["validos"], 0)

    def test_ordena_por_quem_vence_primeiro(self):
        hoje = timezone.localdate()
        self._subir(self.crf, validade=hoje + dt.timedelta(days=40))
        cnd = Documento.objects.get(
            empresa=self.empresa, tipo__nome="CND de tributos federais e dívida ativa"
        )
        self._subir(cnd, validade=hoje + dt.timedelta(days=5))

        resposta = self.client.get("/api/documentos/", {"empresa": self.empresa.id})
        com_validade = [d for d in resposta.data["results"] if d["validade"]]

        self.assertEqual([d["tipo_nome"] for d in com_validade], [cnd.tipo.nome, CRF])

    def test_documento_arquivado_sai_da_lista(self):
        self.client.delete(f"/api/documentos/{self.crf.id}/")

        resposta = self.client.get("/api/documentos/", {"empresa": self.empresa.id})
        self.assertNotIn(CRF, [d["tipo_nome"] for d in resposta.data["results"]])

    def test_lista_de_outra_empresa_nao_se_mistura(self):
        outra = Empresa.objects.create(
            tenant=self.tenant, nome="Inside Log Ltda", cnpj="45723174000110"
        )

        resposta = self.client.get("/api/documentos/", {"empresa": outra.id})
        ids = {d["empresa"] for d in resposta.data["results"]}

        self.assertEqual(ids, {outra.id})

    def test_tipos_traz_o_catalogo_para_o_seletor(self):
        resposta = self.client.get("/api/documentos/tipos/")

        nomes = [t["nome"] for t in resposta.data]
        self.assertIn(CRF, nomes)
        self.assertIn("Outro documento", nomes)

    def _subir(self, documento: Documento, **campos):
        return self.client.post(
            f"/api/documentos/{documento.id}/versoes/",
            {"arquivo": pdf(), **{k: str(v) for k, v in campos.items()}},
            format="multipart",
        )


class UploadTests(BaseDocumentos):
    def test_upload_cria_a_versao_grava_o_arquivo_e_o_evento(self):
        hoje = timezone.localdate()
        resposta = self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/",
            {
                "arquivo": pdf(),
                "numero": "2026082501",
                "emissao": str(hoje),
                "validade": str(hoje + dt.timedelta(days=30)),
                "nota": "Renovação de agosto",
            },
            format="multipart",
        )

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.data["versao"]["versao"], 1)
        # A tela redesenha a linha com o que volta aqui, sem outra chamada.
        self.assertEqual(resposta.data["documento"]["situacao"], "a_vencer")

        versao = self.crf.versoes.get()
        self.assertTrue(Path(self.raiz, versao.arquivo).exists())
        self.assertEqual(len(versao.hash_sha256), 64)
        self.assertEqual(self.crf.eventos.get().tipo, TipoEvento.ENVIADO)

    def test_o_caminho_no_bucket_nasce_com_o_tenant_e_a_empresa(self):
        self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/", {"arquivo": pdf()}, format="multipart"
        )

        caminho = self.crf.versoes.get().arquivo
        self.assertTrue(caminho.startswith(f"tenant/{self.tenant.slug}/empresas/{self.empresa.id}/"))
        self.assertTrue(caminho.endswith("/v1.pdf"))

    def test_o_nome_do_arquivo_e_do_sistema_nao_o_do_computador_de_alguem(self):
        self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/",
            {"arquivo": pdf("CRF final (2) ASSINADO.pdf")},
            format="multipart",
        )

        versao = self.crf.versoes.get()
        self.assertTrue(versao.arquivo.endswith("/v1.pdf"))
        # O nome original continua guardado, para quem baixar reconhecer.
        self.assertEqual(versao.nome_original, "CRF final (2) ASSINADO.pdf")

    def test_segunda_versao_e_renovacao_no_historico(self):
        for _ in range(2):
            self.client.post(
                f"/api/documentos/{self.crf.id}/versoes/", {"arquivo": pdf()}, format="multipart"
            )

        self.assertEqual([v.versao for v in self.crf.versoes.all()], [2, 1])
        self.assertEqual(
            sorted(e.tipo for e in self.crf.eventos.all()),
            sorted([TipoEvento.ENVIADO, TipoEvento.RENOVADO]),
        )

    def test_extensao_nao_aceita_e_recusada_dizendo_o_que_vale(self):
        resposta = self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/",
            {"arquivo": SimpleUploadedFile("virus.exe", b"MZ", content_type="application/exe")},
            format="multipart",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("pdf", resposta.data["arquivo"][0])
        self.assertFalse(self.crf.versoes.exists())

    def test_arquivo_vazio_e_recusado(self):
        resposta = self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/",
            {"arquivo": SimpleUploadedFile("vazio.pdf", b"", content_type="application/pdf")},
            format="multipart",
        )

        self.assertEqual(resposta.status_code, 400)

    def test_validade_anterior_a_emissao_e_recusada(self):
        hoje = timezone.localdate()
        resposta = self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/",
            {
                "arquivo": pdf(),
                "emissao": str(hoje),
                "validade": str(hoje - dt.timedelta(days=1)),
            },
            format="multipart",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("anterior à emissão", str(resposta.data["validade"]))

    def test_sem_armazenamento_configurado_a_mensagem_diz_onde_resolver(self):
        ConfigArmazenamento.objects.all().delete()

        resposta = self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/", {"arquivo": pdf()}, format="multipart"
        )

        self.assertEqual(resposta.status_code, 503)
        self.assertIn("Armazenamento", resposta.data["detail"])


class DownloadTests(BaseDocumentos):
    def test_download_devolve_url_assinada_e_registra_no_historico(self):
        self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/", {"arquivo": pdf()}, format="multipart"
        )
        versao = self.crf.versoes.get()

        resposta = self.client.get(f"/api/documentos/versoes/{versao.id}/download/")

        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.data["url"])
        self.assertEqual(resposta.data["nome"], "certidao.pdf")
        self.assertIn(TipoEvento.BAIXADO, [e.tipo for e in self.crf.eventos.all()])

    def test_a_chave_no_bucket_nunca_sai_pela_api(self):
        self.client.post(
            f"/api/documentos/{self.crf.id}/versoes/", {"arquivo": pdf()}, format="multipart"
        )

        resposta = self.client.get("/api/documentos/", {"empresa": self.empresa.id})

        self.assertNotIn("arquivo", str(resposta.data["results"][0]["versao_atual"]))


class VagaTests(BaseDocumentos):
    def test_abre_vaga_do_tipo_livre_com_titulo(self):
        livre = TipoDocumento.objects.get(nome="Outro documento")

        resposta = self.client.post(
            "/api/documentos/",
            {"empresa": self.empresa.id, "tipo": livre.id, "titulo": "Alvará sanitário"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.data["nome"], "Alvará sanitário")

    def test_tipo_livre_sem_titulo_e_recusado(self):
        # Dois "Outro documento" sem nome seriam indistinguíveis na tela.
        livre = TipoDocumento.objects.get(nome="Outro documento")

        resposta = self.client.post(
            "/api/documentos/",
            {"empresa": self.empresa.id, "tipo": livre.id},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("titulo", resposta.data)

    def test_arquivar_nao_apaga_e_da_para_restaurar(self):
        resposta = self.client.delete(f"/api/documentos/{self.crf.id}/")

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data["situacao"], "arquivado")
        self.assertTrue(Documento.objects.filter(pk=self.crf.id).exists())

        volta = self.client.post(f"/api/documentos/{self.crf.id}/restaurar/")
        self.assertEqual(volta.data["situacao"], "pendente")

    def test_historico_da_vaga(self):
        self.client.delete(f"/api/documentos/{self.crf.id}/")

        resposta = self.client.get(f"/api/documentos/{self.crf.id}/eventos/")

        self.assertEqual(resposta.data[0]["tipo"], TipoEvento.ARQUIVADO)
        self.assertEqual(resposta.data[0]["autor_nome"], self.user.email)
