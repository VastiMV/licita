"""Tasks Celery do app `catalogo` — ver docs/ARQUITETURA.md, seção "Assíncrono"."""

from __future__ import annotations

import logging

from celery import shared_task

from . import sync

logger = logging.getLogger(__name__)


@shared_task(name="catalogo.sincronizar_catalogo_pdm")
def sincronizar_catalogo_pdm() -> int:
    """Agendada no Celery Beat (ver migration `0002_periodic_task`) — 1x/dia.

    Thin wrapper: a lógica de verdade mora em `sync.sincronizar`, também
    usada pelo management command `sincronizar_catalogo` (que não depende de
    Celery/RabbitMQ rodando).
    """

    gravados = sync.sincronizar()
    logger.info("Catálogo PDM sincronizado: %s registros", gravados)
    return gravados
