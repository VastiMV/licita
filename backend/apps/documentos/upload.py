"""Receber um arquivo e virar uma versão.

O upload passa pelo backend (e não direto do navegador para o bucket) por
três coisas que só dá para fazer aqui: recusar o que não é documento, gravar
o hash do que entrou e escrever o evento no histórico. Enquanto o teto for
50 MB isso é barato; quando houver arquivo grande, o mesmo driver emite URL
de envio direto e nada mais muda (ver `apps/armazenamento/base.py`).
"""

from __future__ import annotations

import hashlib

from django.db import transaction

from apps.armazenamento.base import ErroArmazenamento
from apps.armazenamento.caminhos import caminho
from apps.armazenamento.servico import armazenamento_do_tenant

from .models import Documento, EventoDocumento, TipoEvento, VersaoDocumento

#: 50 MB — o que o handoff do mockup promete na dropzone.
TAMANHO_MAXIMO = 50 * 1024 * 1024

#: O que é documento de habilitação: certidão em PDF, foto de um documento
#: carimbado, balanço em planilha, contrato em Word, kit em ZIP. Executável e
#: afins não entram — o campo é de documento, não é um Drive.
EXTENSOES = {"pdf", "png", "jpg", "jpeg", "xlsx", "xls", "docx", "doc", "zip", "p7s"}


class ErroUpload(Exception):
    """Recusa com texto pronto para a tela."""


def _extensao(nome: str) -> str:
    _, _, ext = nome.rpartition(".")
    return ext.lower() if ext else ""


def validar(arquivo) -> str:
    ext = _extensao(arquivo.name)
    if not ext or ext not in EXTENSOES:
        aceitas = ", ".join(sorted(EXTENSOES))
        raise ErroUpload(f'Tipo de arquivo não aceito (.{ext or "sem extensão"}). Aceitos: {aceitas}.')
    if arquivo.size > TAMANHO_MAXIMO:
        mb = arquivo.size / 1024 / 1024
        raise ErroUpload(f"Arquivo de {mb:.1f} MB — o limite é 50 MB.")
    if arquivo.size == 0:
        raise ErroUpload("O arquivo está vazio.")
    return ext


def _hash(arquivo) -> str:
    """Lido em pedaços: um balanço de 20 MB não precisa caber na memória duas
    vezes."""

    sha = hashlib.sha256()
    for pedaco in arquivo.chunks():
        sha.update(pedaco)
    arquivo.seek(0)
    return sha.hexdigest()


@transaction.atomic
def gravar_versao(documento: Documento, arquivo, autor=None, **campos) -> VersaoDocumento:
    """Sobe o arquivo e cria a versão. Levanta `ErroUpload` (recusa) ou
    `ErroArmazenamento` (bucket não configurado, credencial errada).

    O número da versão é calculado aqui dentro da transação — duas pessoas
    renovando a mesma certidão ao mesmo tempo esbarram na unicidade de
    `(documento, versao)` em vez de sobrescrever uma à outra.
    """

    ext = validar(arquivo)
    numero_versao = documento.proxima_versao()

    destino = caminho(
        documento.tenant,
        "empresas",
        str(documento.empresa_id),
        documento.nome,
        f"v{numero_versao}.{ext}",
    )

    armazenamento = armazenamento_do_tenant(documento.tenant)
    hash_arquivo = _hash(arquivo)
    gravado = armazenamento.salvar(destino, arquivo, content_type=arquivo.content_type or "")

    versao = VersaoDocumento.objects.create(
        documento=documento,
        versao=numero_versao,
        arquivo=gravado,
        nome_original=arquivo.name,
        tamanho=arquivo.size,
        content_type=arquivo.content_type or "",
        hash_sha256=hash_arquivo,
        enviado_por=autor if (autor and autor.is_authenticated) else None,
        **campos,
    )

    EventoDocumento.registrar(
        documento,
        TipoEvento.ENVIADO if numero_versao == 1 else TipoEvento.RENOVADO,
        autor=autor,
        detalhe=f"v{numero_versao} · {arquivo.name}",
    )
    return versao


__all__ = ["ErroUpload", "ErroArmazenamento", "gravar_versao", "validar", "TAMANHO_MAXIMO", "EXTENSOES"]
