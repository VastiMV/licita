"""Um driver, quatro provedores.

Cloudflare R2, AWS S3, MinIO, Backblaze B2 e DigitalOcean Spaces falam o
**mesmo protocolo**; o que muda entre eles é o `endpoint_url` e a região. Por
isso não existe um driver por fornecedor: existe este, registrado duas vezes,
com os defaults de cada um já preenchidos — e é essa a "troca de plugin" que
a tela oferece.

O `boto3` é importado **dentro** dos métodos, de propósito: o produto sobe
sem ele instalado, e a tela mostra o driver como indisponível dizendo o que
falta. Descobrir uma dependência ausente na hora de subir uma certidão seria
o pior momento possível.
"""

from __future__ import annotations

from typing import BinaryIO

from ..base import CampoConfig, ErroArmazenamento
from ..registro import registrar

CAMPOS_COMUNS = (
    CampoConfig(nome="bucket", rotulo="Bucket", placeholder="licita-documentos"),
    CampoConfig(
        nome="access_key",
        rotulo="Access key ID",
        placeholder="AKIA… / token do R2",
    ),
    CampoConfig(nome="secret_key", rotulo="Secret access key", segredo=True),
    CampoConfig(
        nome="prefixo",
        rotulo="Prefixo",
        obrigatorio=False,
        ajuda="Pasta dentro do bucket, se ele for compartilhado com outra coisa.",
        placeholder="licita/",
    ),
)


class ArmazenamentoS3Compativel:
    """A implementação. Não é registrada — quem é são as subclasses abaixo,
    que só trocam rótulo e defaults."""

    CHAVE = ""
    ROTULO = ""
    CAMPOS: tuple[CampoConfig, ...] = CAMPOS_COMUNS

    def __init__(
        self,
        bucket: str = "",
        access_key: str = "",
        secret_key: str = "",
        endpoint_url: str = "",
        regiao: str = "auto",
        prefixo: str = "",
        **_ignorado,
    ):
        self.bucket = bucket
        self.access_key = access_key
        self.secret_key = secret_key
        self.endpoint_url = endpoint_url
        self.regiao = regiao or "auto"
        self.prefixo = prefixo.strip("/")

    # -- infraestrutura ----------------------------------------------------

    def _cliente(self):
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ErroArmazenamento(
                f'O driver "{self.ROTULO}" precisa do pacote boto3 instalado no backend.'
            ) from None

        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url or None,
            region_name=self.regiao,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            # `s3v4` é o que o R2 exige para URL assinada; a AWS também
            # aceita, então não precisa ser condicional.
            config=Config(signature_version="s3v4"),
        )

    def _chave(self, caminho: str) -> str:
        return f"{self.prefixo}/{caminho}" if self.prefixo else caminho

    def _traduzir(self, erro: Exception) -> ErroArmazenamento:
        """Erro de biblioteca vira erro de domínio com texto que dá para
        mostrar na tela — é o que a tela de configuração exibe quando o
        "testar conexão" falha."""

        codigo = getattr(erro, "response", {}).get("Error", {}).get("Code", "")
        if codigo in ("InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied", "403"):
            return ErroArmazenamento(
                "Credencial recusada pelo provedor — confira access key, secret e as permissões do token."
            )
        if codigo in ("NoSuchBucket", "404"):
            return ErroArmazenamento(f'O bucket "{self.bucket}" não existe neste endpoint.')
        return ErroArmazenamento(f"Falha ao falar com o armazenamento: {erro}")

    # -- contrato ----------------------------------------------------------

    def salvar(self, caminho: str, arquivo: BinaryIO, content_type: str = "") -> str:
        extras = {"ContentType": content_type} if content_type else {}
        try:
            self._cliente().upload_fileobj(
                arquivo, self.bucket, self._chave(caminho), ExtraArgs=extras
            )
        except ErroArmazenamento:
            raise
        except Exception as erro:
            raise self._traduzir(erro) from erro
        return caminho

    def abrir(self, caminho: str) -> BinaryIO:
        try:
            resposta = self._cliente().get_object(Bucket=self.bucket, Key=self._chave(caminho))
        except ErroArmazenamento:
            raise
        except Exception as erro:
            raise self._traduzir(erro) from erro
        return resposta["Body"]

    def url_temporaria(self, caminho: str, expira_em: int = 300) -> str:
        try:
            return self._cliente().generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": self._chave(caminho)},
                ExpiresIn=expira_em,
            )
        except ErroArmazenamento:
            raise
        except Exception as erro:
            raise self._traduzir(erro) from erro

    def remover(self, caminho: str) -> None:
        try:
            self._cliente().delete_object(Bucket=self.bucket, Key=self._chave(caminho))
        except ErroArmazenamento:
            raise
        except Exception as erro:
            raise self._traduzir(erro) from erro


@registrar
class ArmazenamentoR2(ArmazenamentoS3Compativel):
    """Cloudflare R2 — o escolhido para começar.

    O endpoint tem o id da conta no meio
    (`https://<conta>.r2.cloudflarestorage.com`), então é campo, não
    constante. Região é sempre `auto` no R2."""

    CHAVE = "r2"
    ROTULO = "Cloudflare R2"
    CAMPOS = (
        CampoConfig(
            nome="endpoint_url",
            rotulo="Endpoint da conta",
            ajuda="Está no painel do R2, em "
            '"S3 API" — algo como https://<id-da-conta>.r2.cloudflarestorage.com',
            placeholder="https://<id-da-conta>.r2.cloudflarestorage.com",
        ),
        *CAMPOS_COMUNS,
    )

    def __init__(self, **opcoes):
        # R2 ignora região, mas a assinatura v4 exige alguma — "auto" é a
        # que a Cloudflare documenta.
        super().__init__(**{**opcoes, "regiao": "auto"})


@registrar
class ArmazenamentoS3(ArmazenamentoS3Compativel):
    """AWS S3 — o mesmo código, com região obrigatória e endpoint padrão da
    Amazon (por isso `endpoint_url` nem aparece no formulário)."""

    CHAVE = "s3"
    ROTULO = "Amazon S3"
    CAMPOS = (
        CampoConfig(
            nome="regiao",
            rotulo="Região",
            ajuda="A região do bucket, como aparece no console.",
            placeholder="sa-east-1",
        ),
        *CAMPOS_COMUNS,
    )
