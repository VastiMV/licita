"""Disco do próprio container — o driver do desenvolvimento e **dos testes**.

Nenhum teste do projeto pode tocar em bucket de verdade, pela mesma
disciplina de `apps/integracoes` (que nunca faz rede em teste): o que se
quer verificar é a regra do documento, não a disponibilidade da Cloudflare.

Não serve para produção com mais de uma réplica — o pod é efêmero e não
compartilha disco (ver docs/ARQUITETURA.md, "Pods"). A tela diz isso.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.core import signing
from django.urls import reverse

from ..base import CampoConfig, ErroArmazenamento
from ..registro import registrar

#: Namespace do token de download (ver `url_temporaria` e a view que o lê).
SAL_DOWNLOAD = "armazenamento.local.download"


@registrar
class ArmazenamentoLocal:
    CHAVE = "local"
    ROTULO = "Disco local (desenvolvimento)"
    CAMPOS = (
        CampoConfig(
            nome="raiz",
            rotulo="Pasta",
            obrigatorio=False,
            ajuda="Em branco usa MEDIA_ROOT. Não sobrevive a um pod novo — só para desenvolvimento.",
            placeholder="/var/lib/licita/arquivos",
        ),
    )

    def __init__(self, raiz: str = "", **_ignorado):
        self.raiz = Path(raiz or settings.MEDIA_ROOT)

    def _absoluto(self, caminho: str) -> Path:
        """Resolve e confere que continua dentro da raiz.

        Um caminho é montado pelo produto, nunca digitado pelo usuário — mas
        um nome de arquivo vindo de upload já apareceu com `../` em produto
        que ninguém suspeitava, e o custo de conferir é uma linha."""

        destino = (self.raiz / caminho).resolve()
        if not destino.is_relative_to(self.raiz.resolve()):
            raise ErroArmazenamento(f'Caminho fora da área de arquivos: "{caminho}".')
        return destino

    def salvar(self, caminho: str, arquivo: BinaryIO, content_type: str = "") -> str:
        destino = self._absoluto(caminho)
        try:
            destino.parent.mkdir(parents=True, exist_ok=True)
            with destino.open("wb") as saida:
                shutil.copyfileobj(arquivo, saida)
        except OSError as erro:
            # Pasta inexistente, sem permissão, disco cheio: quem chama não
            # deveria precisar capturar OSError — o contrato é
            # `ErroArmazenamento`, com texto que dá para mostrar na tela.
            raise ErroArmazenamento(
                f'Não foi possível gravar em "{self.raiz}": {erro.strerror or erro}.'
            ) from erro
        return caminho

    def abrir(self, caminho: str) -> BinaryIO:
        destino = self._absoluto(caminho)
        try:
            return destino.open("rb")
        except FileNotFoundError:
            raise ErroArmazenamento(f'Arquivo não encontrado: "{caminho}".') from None
        except OSError as erro:
            raise ErroArmazenamento(
                f'Não foi possível ler "{caminho}": {erro.strerror or erro}.'
            ) from erro

    def url_temporaria(self, caminho: str, expira_em: int = 300) -> str:
        """Mesma promessa do driver de bucket: link que expira. Aqui quem
        assina é o próprio Django (`signing`), e quem serve é a view de
        `apps/armazenamento/views.py` — o arquivo não fica exposto por
        caminho adivinhável nem no desenvolvimento."""

        token = signing.dumps({"caminho": caminho}, salt=SAL_DOWNLOAD)
        return reverse("armazenamento-local-download", args=[token])

    def remover(self, caminho: str) -> None:
        try:
            self._absoluto(caminho).unlink(missing_ok=True)
        except OSError as erro:
            raise ErroArmazenamento(
                f'Não foi possível remover "{caminho}": {erro.strerror or erro}.'
            ) from erro


def caminho_do_token(token: str, expira_em: int = 300) -> str:
    """Lê o token de `url_temporaria`. Fica aqui, ao lado de quem assina,
    para a view não conhecer o formato do token."""

    try:
        return signing.loads(token, salt=SAL_DOWNLOAD, max_age=expira_em)["caminho"]
    except signing.BadSignature:
        raise ErroArmazenamento("Link de download inválido ou expirado.") from None
