from django.contrib import admin

from .models import ConfigArmazenamento


@admin.register(ConfigArmazenamento)
class ConfigArmazenamentoAdmin(admin.ModelAdmin):
    """Para conferir o que está configurado sem abrir a tela. O segredo não
    aparece aqui tampouco — é campo cifrado (ver `cripto.py`)."""

    list_display = ["tenant", "driver", "segredos_definidos_em", "testado_em", "atualizado_em"]
    readonly_fields = ["segredos_cifrados", "segredos_definidos_em", "testado_em"]
