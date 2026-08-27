"""`manage.py sincronizar_capag` — roda o sync das notas CAPAG na hora, sem
depender de Celery/RabbitMQ estarem no ar. Útil em desenvolvimento local e
para popular a tabela antes do primeiro agendamento do Celery Beat rodar.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.capag import sync


class Command(BaseCommand):
    help = "Baixa/atualiza as notas CAPAG de municípios e estados (ver apps/capag/sync.py)."

    def handle(self, *args, **options):
        self.stdout.write("Sincronizando CAPAG (Tesouro Transparente)...")
        resultado = sync.sincronizar()
        self.stdout.write(
            self.style.SUCCESS(
                f"CAPAG sincronizado: {resultado['municipios']} municípios, "
                f"{resultado['estados']} estados."
            )
        )
