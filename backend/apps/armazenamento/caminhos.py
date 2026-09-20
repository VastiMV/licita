"""Como uma chave de arquivo é montada.

`tenant/<slug>/...` desde o primeiro arquivo gravado, mesmo com um cliente
só: um bucket com prefixo por tenant atende tanto o mundo de hoje quanto o
de vários clientes, e quem preferir bucket separado por cliente só preenche
outro bucket na configuração. O que não dá é começar sem prefixo e querer
separar depois — aí é mover arquivo, não mudar código.

Nome de arquivo é do sistema, nunca o que veio do computador de alguém:
metade da confusão de pasta compartilhada é "proposta_final_v2 (1).pdf".
"""

from __future__ import annotations

import re
import unicodedata

from apps.tenants.models import Tenant


def limpar(pedaco: str) -> str:
    """Um pedaço de caminho seguro: sem acento, sem espaço, sem barra."""

    sem_acento = unicodedata.normalize("NFKD", pedaco).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", sem_acento).strip("-.").lower() or "arquivo"


def caminho(tenant: Tenant, *partes: str) -> str:
    """`caminho(tenant, "empresas", "12", "cnd-federal", "v3.pdf")`."""

    return "/".join(["tenant", limpar(tenant.slug), *(limpar(p) for p in partes)])
