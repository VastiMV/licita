from django.apps import AppConfig


class DocumentosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.documentos"
    label = "documentos"
    verbose_name = "Documentos da empresa"

    def ready(self):
        """Liga o signal que abre as vagas da empresa nova.

        Importar aqui, e não no topo, é o de sempre: o app tem que estar
        carregado antes de o model de empresa ser referenciado.
        """

        from . import signals  # noqa: F401
