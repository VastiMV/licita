"""Cifra dos segredos guardados no banco.

A configuração de armazenamento mora em tabela (e não em `Secret` do
Kubernetes) porque precisa ser **por cliente e mudável pela tela** — mas isso
põe uma secret key de bucket dentro do Postgres, onde um dump de banco
compartilhado por engano vale um vazamento. Então o que é segredo entra
cifrado e nunca sai pela API (ver `ConfigArmazenamento`).

A chave da cifra é a única coisa que continua vindo do ambiente — é ela que
não pode estar junto do dado que protege.
"""

from __future__ import annotations

import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from config.settings.environment import env

from .base import ErroArmazenamento


def _chave() -> bytes:
    """A chave configurada ou, na falta dela, uma derivada da `SECRET_KEY`.

    O default existe para o desenvolvimento local subir sem configuração
    nenhuma. **Em produção configure `ARMAZENAMENTO_CHAVE_CIFRA`**: sem ela,
    trocar a `SECRET_KEY` do Django (rotação de rotina) torna ilegíveis os
    segredos já gravados, e a tela passa a pedir as credenciais de novo.
    """

    if env.armazenamento_chave_cifra:
        return env.armazenamento_chave_cifra.encode()
    derivada = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(derivada)


def cifrar(valores: dict[str, str]) -> str:
    return Fernet(_chave()).encrypt(json.dumps(valores).encode()).decode()


def decifrar(texto: str) -> dict[str, str]:
    if not texto:
        return {}
    try:
        return json.loads(Fernet(_chave()).decrypt(texto.encode()).decode())
    except InvalidToken:
        raise ErroArmazenamento(
            "Não foi possível ler as credenciais gravadas — a chave de cifra do "
            "backend mudou. Preencha o segredo de novo na tela de armazenamento."
        ) from None
