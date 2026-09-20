from django.contrib import admin

from .models import Documento, TipoDocumento, VersaoDocumento


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(admin.ModelAdmin):
    """O catálogo. É aqui que se acrescenta um tipo sem esperar deploy."""

    list_display = ["nome", "bloco", "orgao_emissor", "exige_validade", "obrigatorio", "ativo"]
    list_filter = ["bloco", "exige_validade", "obrigatorio", "ativo"]
    search_fields = ["nome", "orgao_emissor"]


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ["__str__", "situacao", "validade", "arquivado_em"]
    list_filter = ["tipo__bloco"]
    search_fields = ["empresa__nome", "tipo__nome", "titulo"]


@admin.register(VersaoDocumento)
class VersaoDocumentoAdmin(admin.ModelAdmin):
    list_display = ["__str__", "validade", "enviado_por", "enviado_em"]
    readonly_fields = ["arquivo", "hash_sha256", "tamanho"]
