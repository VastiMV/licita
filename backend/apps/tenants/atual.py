"""De quem é esta requisição.

**Este é o único lugar do projeto que responde essa pergunta.** Todo o resto
chama `tenant_atual(request)` e não sabe se existe um cliente ou trezentos —
é isso que torna a virada multiempresa uma mudança de uma função, e não uma
varredura por todo filtro de queryset já escrito.

Hoje devolve o único tenant que existe. Amanhã lê do usuário autenticado
(`request.user.tenant`) ou do subdomínio; a assinatura não muda.
"""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

from .models import TENANT_PADRAO_SLUG, Tenant


def tenant_atual(request=None) -> Tenant:
    """`request` já entra na assinatura, mesmo sem uso, porque o dia em que
    passar a ser usado não pode ser o dia de mexer em toda chamada."""

    tenant = Tenant.objects.filter(slug=TENANT_PADRAO_SLUG).first()
    if tenant is None:
        # Acontece se alguém rodar contra um banco sem a migração inicial de
        # `tenants`. Erro explícito vale mais do que um `None` que só quebra
        # três camadas adiante, na hora de salvar.
        raise ImproperlyConfigured(
            f'Tenant "{TENANT_PADRAO_SLUG}" não existe — rode as migrações de apps.tenants.'
        )
    return tenant
