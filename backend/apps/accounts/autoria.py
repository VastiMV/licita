"""O nome de quem fez fica no próprio registro.

Todo campo que aponta para o usuário (`salva_por`, `autor`, `criado_por`…)
tem um irmão `<campo>_nome`. Este `pre_save` preenche o irmão com o nome do
usuário a cada gravação, e ninguém precisa lembrar de fazer isso na view.

O motivo é o usuário poder ser excluído (Configurações → Usuários). A FK cai
para nulo (`SET_NULL`, que é um `UPDATE` direto, sem passar por aqui), e o
nome que já estava gravado fica — o histórico continua dizendo quem fez.
"""

from __future__ import annotations

from django.conf import settings
from django.db.models.signals import pre_save


def nome_do_usuario(usuario) -> str:
    return (usuario.nome or usuario.email) if usuario else ""


def _campos_de_autoria(modelo) -> list[tuple[str, str]]:
    nomes = {campo.name for campo in modelo._meta.concrete_fields}
    return [
        (campo.name, f"{campo.name}_nome")
        for campo in modelo._meta.concrete_fields
        if campo.is_relation
        and campo.related_model is not None
        and campo.related_model._meta.label == settings.AUTH_USER_MODEL
        and f"{campo.name}_nome" in nomes
    ]


def _gravar_nomes(sender, instance, raw=False, **kwargs) -> None:
    if raw:  # loaddata: o que vem no fixture é o que vale
        return
    for campo, campo_nome in _campos_de_autoria(sender):
        if getattr(instance, f"{campo}_id") is not None:
            setattr(instance, campo_nome, nome_do_usuario(getattr(instance, campo)))


def conectar() -> None:
    pre_save.connect(_gravar_nomes, dispatch_uid="accounts.autoria.gravar_nomes")


def preencher_nomes_existentes(*modelos: tuple[str, str, list[str]]):
    """Para as migrações que criam os campos `_nome`: grava o nome de quem já
    estava apontado nos registros antigos. Cada item é
    `(app_label, model, [campos FK])`."""

    from django.db import migrations
    from django.db.models import CharField, OuterRef, Subquery, Value
    from django.db.models.functions import Coalesce, NullIf

    def preencher(apps, schema_editor):
        User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
        for app_label, nome_modelo, campos in modelos:
            Modelo = apps.get_model(app_label, nome_modelo)
            for campo in campos:
                nome = User.objects.filter(pk=OuterRef(f"{campo}_id")).values(
                    rotulo=Coalesce(NullIf("nome", Value("")), "email", output_field=CharField())
                )[:1]
                Modelo.objects.filter(**{f"{campo}__isnull": False}).update(
                    **{f"{campo}_nome": Subquery(nome)}
                )

    return migrations.RunPython(preencher, migrations.RunPython.noop)

