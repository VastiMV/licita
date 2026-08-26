"""Sincronização do catálogo de PDM contra o compras.gov.br.

Baixa o catálogo inteiro (~20 mil registros, ~41 páginas de 500) e grava em
`Pdm` — ver docs/DOMINIO.md, seção "Integrações externas", para o porquê de
rodar sequencial e com um intervalo entre páginas: é uma API pública e
gratuita do governo, e uma varredura completa não precisa (nem deve) virar
uma rajada de requisições.

Chamado por `apps/catalogo/tasks.py` (Celery Beat, periódico) e pelo
management command `sincronizar_catalogo` (manual, sem depender de
Celery/RabbitMQ rodando).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from config.settings.environment import env

from apps.integracoes.clients.compras_gov import (
    TAMANHO_PAGINA_MAX,
    ComprasGovClient,
    normalizar,
)

from .models import Pdm

logger = logging.getLogger(__name__)

CAMPOS_ATUALIZAVEIS = [
    "nome_pdm",
    "nome_normalizado",
    "codigo_classe",
    "nome_classe",
    "nome_classe_normalizado",
    "codigo_grupo",
    "nome_grupo",
    "nome_grupo_normalizado",
]


def _para_registro(pdm: dict[str, Any]) -> Pdm:
    nome_classe = pdm.get("nome_classe") or None
    nome_grupo = pdm.get("nome_grupo") or None
    return Pdm(
        codigo_pdm=pdm["codigo_pdm"],
        nome_pdm=pdm.get("nome_pdm") or "",
        nome_normalizado=normalizar(pdm.get("nome_pdm") or ""),
        codigo_classe=pdm.get("codigo_classe"),
        nome_classe=nome_classe,
        nome_classe_normalizado=normalizar(nome_classe) if nome_classe else None,
        codigo_grupo=pdm.get("codigo_grupo"),
        nome_grupo=nome_grupo,
        nome_grupo_normalizado=normalizar(nome_grupo) if nome_grupo else None,
    )


def sincronizar(client: ComprasGovClient | None = None) -> int:
    """Baixa o catálogo de PDMs inteiro e grava localmente. Retorna quantos gravou.

    Uma página por vez, em memória (não os ~20 mil de uma vez) — leve mesmo
    num pod com pouca RAM. `bulk_create(update_conflicts=True)` grava a
    página inteira num round-trip só ao banco, criando ou atualizando pela PK
    (`codigo_pdm`) conforme o registro já exista ou não.
    """

    proprio = client is None
    cliente = client or ComprasGovClient()
    gravados = 0
    try:
        pagina = 1
        while True:
            pdms, total_paginas = cliente.listar_pdms(pagina=pagina, tamanho_pagina=TAMANHO_PAGINA_MAX)
            if not pdms:
                break

            Pdm.objects.bulk_create(
                [_para_registro(p) for p in pdms],
                update_conflicts=True,
                unique_fields=["codigo_pdm"],
                update_fields=CAMPOS_ATUALIZAVEIS,
            )
            gravados += len(pdms)

            logger.info("Catálogo PDM: página %s/%s (%s gravados)", pagina, total_paginas, gravados)

            if pagina >= (total_paginas or 1):
                break
            pagina += 1
            # Throttle deliberado — ver docstring do módulo.
            time.sleep(env.catalogo_sync_intervalo_segundos)
    finally:
        if proprio:
            cliente.close()

    return gravados
