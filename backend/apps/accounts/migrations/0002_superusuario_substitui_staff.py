from django.db import migrations


def staff_vira_superusuario(apps, schema_editor):
    """Até aqui quem configurava o armazenamento era o `is_staff`. Agora é o
    super usuário — quem já tinha o acesso continua tendo."""

    User = apps.get_model("accounts", "User")
    User.objects.filter(is_staff=True).update(is_superuser=True)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(staff_vira_superusuario, migrations.RunPython.noop),
    ]
