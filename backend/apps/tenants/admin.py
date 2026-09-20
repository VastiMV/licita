from django.contrib import admin

from .models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    """Só leitura na prática: há um tenant, criado por migração. Está aqui
    para conferir o slug (que compõe o caminho dos arquivos no bucket)."""

    list_display = ["nome", "slug", "ativo", "criado_em"]
