"""`manage.py sincronizar_catalogo` — roda o sync do catálogo PDM na hora,
sem depender de Celery/RabbitMQ estarem no ar. Útil em desenvolvimento local
e para popular o catálogo antes do primeiro agendamento do Celery Beat rodar.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.catalogo import sync


class Command(BaseCommand):
    help = "Baixa/atualiza o catálogo de PDM do compras.gov.br (ver apps/catalogo/sync.py)."

    def handle(self, *args, **options):
        self.stdout.write("Sincronizando catálogo de PDM (pode levar alguns minutos)...")
        gravados = sync.sincronizar()
        self.stdout.write(self.style.SUCCESS(f"Catálogo sincronizado: {gravados} PDMs gravados."))
