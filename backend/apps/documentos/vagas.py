"""Empresa nova nasce com as vagas abertas.

Uma tela de documentos em branco não diz o que falta — e o que falta é
justamente a informação. Abrindo a vaga de cada tipo obrigatório no momento
em que a empresa é cadastrada, o dossiê já nasce dizendo "nove pendentes",
que é trabalho a fazer, e não "nenhum documento", que não é nada.

Roda por signal (ver `apps.py`) e não no endpoint de empresa: quem depende de
quem é `documentos` → `empresas`, nunca o contrário.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from apps.empresas.models import Empresa

from .models import Documento, TipoDocumento


def tipos_do_tenant(tenant) -> list[TipoDocumento]:
    """O catálogo padrão mais o que aquele cliente acrescentou."""

    return list(
        TipoDocumento.objects.filter(Q(tenant__isnull=True) | Q(tenant=tenant), ativo=True)
    )


@transaction.atomic
def abrir_vagas(empresa: Empresa) -> int:
    """Cria a vaga de cada tipo obrigatório que a empresa ainda não tem.

    Idempotente de propósito: serve tanto para a empresa nova quanto para
    quando um tipo obrigatório entrar no catálogo depois — rodar de novo só
    acrescenta o que falta.
    """

    ja_existem = set(
        Documento.objects.filter(empresa=empresa).values_list("tipo_id", flat=True)
    )
    novos = [
        Documento(tenant=empresa.tenant, empresa=empresa, tipo=tipo)
        for tipo in tipos_do_tenant(empresa.tenant)
        if tipo.obrigatorio and tipo.id not in ja_existem
    ]
    Documento.objects.bulk_create(novos)
    return len(novos)
