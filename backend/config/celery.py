"""
App Celery do projeto. Primeira task: `catalogo.sincronizar_catalogo_pdm`
(ver apps/catalogo/tasks.py). Mais entram junto com os apps de domínio
(`alertas`) que precisam de execução assíncrona. Ver docs/ARQUITETURA.md,
seção "Assíncrono".
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")

app = Celery("licita")

# Lê CELERY_* de settings/base.py (que por sua vez lê de Environment).
app.config_from_object("django.conf:settings", namespace="CELERY")

# Descobre tasks.py em cada app listado em INSTALLED_APPS automaticamente.
app.autodiscover_tasks()
