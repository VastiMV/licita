from django.contrib import admin

from .models import Empresa


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    """Só para operação interna; o fluxo normal é o módulo Empresas do
    frontend."""

    list_display = ["nome", "cnpj_formatado", "porte", "cidade_uf", "padrao", "ativa"]
    list_filter = ["porte", "ativa", "uf"]
    search_fields = ["nome", "fantasia", "cnpj"]
