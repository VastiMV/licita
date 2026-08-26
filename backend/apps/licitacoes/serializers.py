"""Serializa o dict de oportunidade (`services._montar_oportunidade`) no
formato exato que o frontend já consome — ver
`frontend/src/app/contracts/licitacoes/oportunidade.contracts.ts`
(`OportunidadeResponse`). Não é `ModelSerializer`: a busca não persiste (ver
docs/DOMINIO.md), então não há model por trás — só um dict vindo da
orquestração em `services.py`.
"""

from __future__ import annotations

from rest_framework import serializers


class OportunidadeSerializer(serializers.Serializer):
    numero_item = serializers.CharField(allow_null=True)
    descricao_resumida = serializers.CharField(allow_null=True)
    descricao_detalhada = serializers.CharField(allow_null=True)
    quantidade = serializers.FloatField(allow_null=True)
    unidade_medida = serializers.CharField(allow_null=True)
    valor_unitario_estimado = serializers.FloatField(allow_null=True)
    valor_total = serializers.FloatField(allow_null=True)
    tipo_beneficio = serializers.CharField(allow_null=True)
    situacao_item = serializers.CharField(allow_null=True)

    contratacao_uf = serializers.CharField(allow_null=True)
    contratacao_modalidade = serializers.CharField(allow_null=True)
    contratacao_situacao = serializers.CharField(allow_null=True)
    contratacao_data_publicacao = serializers.CharField(allow_null=True)
    contratacao_data_encerramento_proposta = serializers.CharField(allow_null=True)
    contratacao_orgao_nome = serializers.CharField(allow_null=True)
    contratacao_municipio = serializers.CharField(allow_null=True)
    contratacao_uasg = serializers.CharField(allow_null=True)
    contratacao_objeto = serializers.CharField(allow_null=True)

    link_compras_gov = serializers.CharField()
    link_pncp = serializers.CharField(allow_null=True)

    # O contrato do frontend não aceita `null` aqui — `srp` ausente vira
    # "não é SRP" (False), não "não sei".
    contratacao_srp = serializers.SerializerMethodField()

    def get_contratacao_srp(self, obj: dict) -> bool:
        return bool(obj.get("contratacao_srp"))
