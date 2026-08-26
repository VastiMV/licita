"""Tasks Celery do app `capag` — ver docs/ARQUITETURA.md, seção "Assíncrono"."""

from __future__ import annotations

import logging

from celery import shared_task

from . import sync

logger = logging.getLogger(__name__)


@shared_task(name="capag.sincronizar_capag")
def sincronizar_capag() -> dict[str, int]:
    """Agendada no Celery Beat (ver migration `0002_agenda_sync_capag`) — mensal.

    Thin wrapper: a lógica de verdade mora em `sync.sincronizar`, também
    usada pelo management command `sincronizar_capag` (que não depende de
    Celery/RabbitMQ rodando).
    """

    resultado = sync.sincronizar()
    logger.info("CAPAG sincronizado: %s", resultado)
    return resultado
