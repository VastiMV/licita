from django.apps import AppConfig


class ArmazenamentoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.armazenamento"
    label = "armazenamento"
    verbose_name = "Armazenamento"

    def ready(self):
        """Registra os drivers que vêm na caixa.

        Importar aqui (e não no topo do módulo) é o que permite a um driver
        externo fazer o mesmo no `ready()` do app dele: quando a primeira
        requisição chegar, o registro já está completo, venha de onde vier.
        """

        from .drivers import local, s3  # noqa: F401
