from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.empresas.models import Empresa

from .vagas import abrir_vagas


@receiver(post_save, sender=Empresa)
def abrir_vagas_da_empresa_nova(sender, instance: Empresa, created: bool, **kwargs) -> None:
    """Só na criação: editar o telefone da empresa não reabre vaga que
    alguém arquivou de propósito."""

    if created:
        abrir_vagas(instance)
