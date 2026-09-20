"""O driver de bucket, **sem rede**.

O que dá para verificar sem falar com a Cloudflare é o que costuma quebrar:
o endpoint usado, a assinatura da URL temporária, o prefixo aplicado na
chave e a tradução do erro do provedor para uma frase que a tela mostra.

Pulam se o `boto3` não estiver instalado — que é o mesmo motivo de o driver
importá-lo dentro do método: o produto tem que subir sem ele.
"""

from __future__ import annotations

import io
import unittest

from django.test import SimpleTestCase

from .base import ErroArmazenamento
from .drivers.s3 import ArmazenamentoR2, ArmazenamentoS3

try:
    from botocore.exceptions import ClientError
    from botocore.stub import Stubber

    TEM_BOTO = True
except ImportError:  # pragma: no cover - depende do ambiente
    TEM_BOTO = False


def r2(**overrides) -> ArmazenamentoR2:
    base = {
        "endpoint_url": "https://conta.r2.cloudflarestorage.com",
        "bucket": "licita-documentos",
        "access_key": "chave",
        "secret_key": "segredo",
    }
    return ArmazenamentoR2(**{**base, **overrides})


@unittest.skipUnless(TEM_BOTO, "boto3 não instalado neste ambiente")
class R2Tests(SimpleTestCase):
    def test_usa_o_endpoint_da_conta(self):
        # É o que distingue R2 de S3 — errar aqui manda o upload para a AWS.
        cliente = r2()._cliente()

        self.assertEqual(
            cliente.meta.endpoint_url, "https://conta.r2.cloudflarestorage.com"
        )

    def test_url_temporaria_e_assinada_e_expira(self):
        url = r2().url_temporaria("tenant/inside/a.pdf", expira_em=60)

        self.assertIn("tenant/inside/a.pdf", url)
        self.assertIn("X-Amz-Signature", url)
        self.assertIn("X-Amz-Expires=60", url)

    def test_prefixo_entra_na_chave(self):
        url = r2(prefixo="licita/").url_temporaria("a.pdf")

        self.assertIn("licita/a.pdf", url)

    def test_credencial_recusada_vira_frase_para_a_tela(self):
        driver = r2()
        cliente = driver._cliente()
        driver._cliente = lambda: cliente

        with Stubber(cliente) as stub:
            stub.add_client_error("put_object", service_error_code="InvalidAccessKeyId")
            with self.assertRaises(ErroArmazenamento) as erro:
                driver.salvar("a.pdf", io.BytesIO(b"."))

        self.assertIn("Credencial recusada", str(erro.exception))

    def test_bucket_inexistente_diz_qual(self):
        driver = r2()
        cliente = driver._cliente()
        driver._cliente = lambda: cliente

        with Stubber(cliente) as stub:
            stub.add_client_error("get_object", service_error_code="NoSuchBucket")
            with self.assertRaises(ErroArmazenamento) as erro:
                driver.abrir("a.pdf")

        self.assertIn("licita-documentos", str(erro.exception))

    def test_erro_desconhecido_nao_vaza_como_ClientError(self):
        driver = r2()
        cliente = driver._cliente()
        driver._cliente = lambda: cliente

        with Stubber(cliente) as stub:
            stub.add_client_error("delete_object", service_error_code="SlowDown")
            with self.assertRaises(ErroArmazenamento):
                driver.remover("a.pdf")
        self.assertTrue(issubclass(ErroArmazenamento, Exception))
        self.assertFalse(issubclass(ErroArmazenamento, ClientError))


@unittest.skipUnless(TEM_BOTO, "boto3 não instalado neste ambiente")
class S3Tests(SimpleTestCase):
    def test_s3_usa_o_endpoint_padrao_da_amazon_e_pede_regiao(self):
        # Por isso `endpoint_url` nem aparece no formulário do S3.
        driver = ArmazenamentoS3(bucket="b", access_key="k", secret_key="s", regiao="sa-east-1")

        self.assertIn("amazonaws.com", driver._cliente().meta.endpoint_url)
        self.assertIn("regiao", [campo.nome for campo in ArmazenamentoS3.CAMPOS])


class SemBotoTests(SimpleTestCase):
    @unittest.skipIf(TEM_BOTO, "só faz sentido sem boto3")
    def test_sem_o_pacote_a_mensagem_diz_o_que_falta(self):  # pragma: no cover
        with self.assertRaises(ErroArmazenamento) as erro:
            r2().url_temporaria("a.pdf")

        self.assertIn("boto3", str(erro.exception))
