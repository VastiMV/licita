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
    criterio_julgamento = serializers.CharField(allow_null=True)
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

    # Identificam a compra no PNCP (cnpj do órgão + ano + sequencial) — é o
    # que o frontend usa pra agrupar os itens de um mesmo edital num card só
    # e pra chamar `CompraDetalheView` (documentos + CAPAG, sob demanda).
    contratacao_cnpj_orgao = serializers.CharField(allow_null=True)
    contratacao_ano_compra = serializers.CharField(allow_null=True)
    contratacao_sequencial_compra = serializers.CharField(allow_null=True)

    # `plataforma_id` casa com o registro em `apps/integracoes/plataformas.py`
    # (o frontend usa pra escolher o ícone do botão). Na busca é o palpite da
    # plataforma padrão; o definitivo vem no detalhe (`CompraDetalheSerializer`).
    plataforma_id = serializers.CharField(allow_null=True)
    link_plataforma = serializers.CharField(allow_null=True)
    link_pncp = serializers.CharField(allow_null=True)

    # O contrato do frontend não aceita `null` aqui — `srp` ausente vira
    # "não é SRP" (False), não "não sei".
    contratacao_srp = serializers.SerializerMethodField()

    def get_contratacao_srp(self, obj: dict) -> bool:
        return bool(obj.get("contratacao_srp"))


class DocumentoSerializer(serializers.Serializer):
    """Um arquivo do edital (aviso, anexo, termo de referência...), com link
    de download direto — ver `PncpClient.listar_arquivos`."""

    titulo = serializers.CharField(allow_null=True)
    tipo_documento = serializers.CharField(allow_null=True)
    url = serializers.CharField(allow_null=True)


class CapagSerializer(serializers.Serializer):
    """Ver `apps.capag.lookup.nota_para`."""

    nota = serializers.CharField()
    cor = serializers.CharField()


class PlataformaSerializer(serializers.Serializer):
    """A plataforma onde a compra de fato acontece, resolvida pelo
    `linkSistemaOrigem` do PNCP (ver `apps/integracoes/plataformas.py`).
    `id` nulo = plataforma que existe mas não está registrada aqui — o link
    e o nome continuam valendo."""

    id = serializers.CharField(allow_null=True)
    nome = serializers.CharField(allow_null=True)
    link = serializers.CharField()


class CompraDetalheSerializer(serializers.Serializer):
    """Resposta de `CompraDetalheView` — uma chamada por card, disparada
    quando o resultado da busca chega (ver docs/DOMINIO.md)."""

    documentos = DocumentoSerializer(many=True)
    capag = CapagSerializer(allow_null=True)
    plataforma = PlataformaSerializer(allow_null=True)
