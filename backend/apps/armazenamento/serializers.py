"""Serializers da configuração de armazenamento.

A regra que molda tudo aqui: **segredo entra e não volta**. O serializer de
leitura devolve quais segredos estão definidos e desde quando, nunca o valor.
Quem precisa trocar, digita outro.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import ConfigArmazenamento
from .registro import drivers


class CampoDriverSerializer(serializers.Serializer):
    """Um campo do formulário. É isto que faz a tela se desenhar sozinha para
    o driver escolhido — o frontend não conhece R2, conhece esta lista."""

    nome = serializers.CharField()
    rotulo = serializers.CharField()
    obrigatorio = serializers.BooleanField()
    segredo = serializers.BooleanField()
    ajuda = serializers.CharField()
    placeholder = serializers.CharField()


class DriverSerializer(serializers.Serializer):
    chave = serializers.CharField()
    rotulo = serializers.CharField()
    campos = CampoDriverSerializer(many=True)


def drivers_instalados() -> list[dict]:
    return [
        {"chave": chave, "rotulo": classe.ROTULO, "campos": [vars(c) for c in classe.CAMPOS]}
        for chave, classe in sorted(drivers().items())
    ]


class ConfigLeituraSerializer(serializers.ModelSerializer):
    segredos_definidos = serializers.ListField(child=serializers.CharField(), read_only=True)
    completa = serializers.BooleanField(read_only=True)

    class Meta:
        model = ConfigArmazenamento
        fields = [
            "driver",
            "opcoes",
            "segredos_definidos",
            "segredos_definidos_em",
            "completa",
            "testado_em",
            "atualizado_em",
        ]


class ConfigEscritaSerializer(serializers.Serializer):
    """O `PUT` da tela: o driver escolhido, os campos comuns e só os segredos
    que a pessoa digitou agora."""

    driver = serializers.CharField()
    opcoes = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)
    segredos = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)

    def validate_driver(self, chave: str) -> str:
        if chave not in drivers():
            instalados = ", ".join(sorted(drivers()))
            raise serializers.ValidationError(
                f'Driver "{chave}" não está instalado neste backend. Instalados: {instalados}.'
            )
        return chave

    def validate(self, dados: dict) -> dict:
        """Campo que o driver não declarou não entra: um `opcoes` com chave
        inventada viraria configuração morta no banco, do tipo que ninguém
        descobre estar sendo ignorada."""

        campos = {c.nome: c for c in drivers()[dados["driver"]].CAMPOS}
        enviados = {**dados.get("opcoes", {}), **dados.get("segredos", {})}

        desconhecidos = sorted(set(enviados) - set(campos))
        if desconhecidos:
            raise serializers.ValidationError(
                {"opcoes": f'Campos que este driver não usa: {", ".join(desconhecidos)}.'}
            )

        # Segredo só pode chegar por `segredos` — se viesse em `opcoes` seria
        # gravado em claro no JSON.
        em_claro = sorted(n for n in dados.get("opcoes", {}) if campos[n].segredo)
        if em_claro:
            raise serializers.ValidationError(
                {"opcoes": f'Estes campos são segredo e vão em "segredos": {", ".join(em_claro)}.'}
            )
        return dados
