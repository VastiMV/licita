# Cria o agendamento do Celery Beat (django_celery_beat, DatabaseScheduler)
# para a task `capag.sincronizar_capag` — mensal (a fonte, Tesouro
# Transparente, só publica ~3x/ano — ver apps/capag/sync.py). Mesmo padrão
# de apps/catalogo/migrations/0002_agenda_sync_catalogo.py.
from django.db import migrations


def criar_agendamento(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    intervalo, _ = IntervalSchedule.objects.get_or_create(every=30, period="days")
    PeriodicTask.objects.get_or_create(
        name="Sincronizar notas CAPAG",
        defaults={
            "task": "capag.sincronizar_capag",
            "interval": intervalo,
        },
    )


def remover_agendamento(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Sincronizar notas CAPAG").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("capag", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(criar_agendamento, remover_agendamento),
    ]
