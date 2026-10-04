"""Encerradas — as licitações que saíram do Ciclo de Licitação.

Como a etapa, o encerramento é **calculado**, nunca gravado: uma salva está
encerrada quando foi descartada (removida da lista) ou quando o prazo de
proposta venceu antes de ela virar proposta. O motivo e a data saem da
mesma regra, num lugar só, para a lista e o quadro não divergirem.

Motivos de hoje (perdida na disputa e falha no empenho entram quando essas
etapas existirem):

- ``descartada`` — alguém tirou da lista antes do prazo vencer;
- ``prazo_oportunidade`` — o prazo venceu sem a equipe ter cotado;
- ``prazo_cotacao`` — o prazo venceu com a cotação feita, sem proposta.

Quem foi descartada **depois** do prazo vencer encerrou pelo prazo: a
remoção foi só limpeza da lista. A data de encerramento é a do que veio
primeiro.
"""

from __future__ import annotations

import datetime as dt

from django.db.models import Case, CharField, DateField, Exists, OuterRef, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.cotador.models import Cotacao

from .models import OportunidadeSalva, OportunidadeSalvaQuerySet

MOTIVOS = {
    "descartada": "Descartada",
    "prazo_oportunidade": "Prazo perdido sem cotação",
    "prazo_cotacao": "Prazo perdido na cotação",
}


def encerradas(hoje: dt.date | None = None) -> OportunidadeSalvaQuerySet:
    """As encerradas, anotadas com ``encerrada_em``, ``motivo`` e
    ``tem_cotacao``."""

    hoje = hoje or timezone.localdate()
    prazo = "data_encerramento_proposta"
    removida_no_dia = TruncDate("removida_em")
    # O prazo venceu antes de (ou sem) a remoção: encerrou pelo prazo.
    venceu_antes = Q(**{f"{prazo}__lt": hoje}) & (
        Q(removida_em__isnull=True) | Q(**{f"{prazo}__lt": removida_no_dia})
    )

    return (
        OportunidadeSalva.objects.filter(
            Q(removida_em__isnull=False) | Q(**{f"{prazo}__lt": hoje})
        )
        .annotate(
            tem_cotacao=Exists(Cotacao.objects.filter(oportunidade=OuterRef("pk"))),
        )
        .annotate(
            encerrada_em=Case(
                When(venceu_antes, then=prazo),
                default=removida_no_dia,
                output_field=DateField(),
            ),
            motivo=Case(
                When(venceu_antes & Q(tem_cotacao=True), then=Value("prazo_cotacao")),
                When(venceu_antes, then=Value("prazo_oportunidade")),
                default=Value("descartada"),
                output_field=CharField(),
            ),
        )
    )
