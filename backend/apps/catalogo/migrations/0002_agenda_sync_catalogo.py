# Cria o agendamento do Celery Beat (django_celery_beat, DatabaseScheduler)
# para a task `catalogo.sincronizar_catalogo_pdm` — 1x/dia. Assim o
# agendamento já existe depois do `migrate` (que já roda no initContainer do
# backend — ver k8s/backend/deployment.yaml), sem passo manual no admin.
from django.db import migrations


def criar_agendamento(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    intervalo, _ = IntervalSchedule.objects.get_or_create(every=1, period="days")
    PeriodicTask.objects.get_or_create(
        name="Sincronizar catálogo de PDM",
        defaults={
            "task": "catalogo.sincronizar_catalogo_pdm",
            "interval": intervalo,
        },
    )


def remover_agendamento(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Sincronizar catálogo de PDM").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(criar_agendamento, remover_agendamento),
    ]
