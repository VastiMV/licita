from django.contrib import admin

from .models import Fornecedor


@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    """Só para operação interna (corrigir um cadastro sem passar pela tela);
    o fluxo normal é o módulo Fornecedores do frontend."""

    list_display = ["nome", "cnpj_formatado", "categoria", "cidade_uf", "situacao"]
    list_filter = ["situacao", "categoria", "uf"]
    search_fields = ["nome", "fantasia", "cnpj"]
