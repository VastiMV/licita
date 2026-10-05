from django.contrib import admin

from .models import Fabricante, Marca, Modelo, PrecoFornecedor

admin.site.register(Fabricante)
admin.site.register(Marca)
admin.site.register(Modelo)
admin.site.register(PrecoFornecedor)
