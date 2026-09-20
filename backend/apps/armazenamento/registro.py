"""O registro de drivers — o que faz o armazenamento ser um plugin.

Um driver se registra no `ready()` do app dele (ver
`apps/armazenamento/apps.py` para os que vêm na caixa). Instalar um pacote
que registra outro driver basta para ele aparecer no seletor da tela de
configuração, sem tocar em nada aqui e sem tocar no frontend.

Um driver pode estar **registrado e indisponível**: é o caso do S3 quando o
`boto3` não está instalado. O registro é de propósito tolerante a isso — o
produto sobe, a tela lista o driver dizendo o que falta, e ninguém descobre a
dependência ausente por um `ImportError` no meio de um upload.
"""

from __future__ import annotations

from .base import Armazenamento, ErroArmazenamento

_DRIVERS: dict[str, type[Armazenamento]] = {}


def registrar(classe: type[Armazenamento]) -> type[Armazenamento]:
    """Registra pela `CHAVE` da própria classe. Devolve a classe, para poder
    ser usado como decorador."""

    _DRIVERS[classe.CHAVE] = classe
    return classe


def driver(chave: str) -> type[Armazenamento]:
    try:
        return _DRIVERS[chave]
    except KeyError:
        registrados = ", ".join(sorted(_DRIVERS)) or "nenhum"
        raise ErroArmazenamento(
            f'Driver de armazenamento "{chave}" não está instalado. Disponíveis: {registrados}.'
        ) from None


def drivers() -> dict[str, type[Armazenamento]]:
    """Cópia do registro — é o que a tela lista no seletor."""

    return dict(_DRIVERS)
