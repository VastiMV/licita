"""Contratos da API de produtos — ver
`frontend/src/app/contracts/produtos/produto.contracts.ts`."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.fornecedores.models import Fornecedor

from .models import Fabricante, Marca, Modelo, PrecoFornecedor


class ModeloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modelo
        fields = ["id", "nome", "marca"]


class MarcaSerializer(serializers.ModelSerializer):
    modelos = ModeloSerializer(many=True, read_only=True)

    class Meta:
        model = Marca
        fields = ["id", "nome", "fabricante", "modelos"]


class FornecedorResumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = ["id", "nome", "fantasia"]


class FabricanteSerializer(serializers.ModelSerializer):
    """Uma linha da tabela de Produtos e o modal do fabricante (com as
    marcas e os modelos dentro). `fornecedores` é a afinidade."""

    fornecedores = FornecedorResumoSerializer(many=True, read_only=True)
    fornecedor_ids = serializers.PrimaryKeyRelatedField(
        source="fornecedores",
        queryset=Fornecedor.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )
    marcas = MarcaSerializer(many=True, read_only=True)
    marcas_total = serializers.SerializerMethodField()
    modelos_total = serializers.SerializerMethodField()
    criado_por = serializers.SerializerMethodField()

    class Meta:
        model = Fabricante
        fields = [
            "id",
            "nome",
            "fornecedores",
            "fornecedor_ids",
            "marcas",
            "marcas_total",
            "modelos_total",
            "criado_por",
            "criado_em",
        ]
        read_only_fields = ["criado_em"]

    def get_marcas_total(self, obj: Fabricante) -> int:
        return len(obj.marcas.all())

    def get_modelos_total(self, obj: Fabricante) -> int:
        return sum(len(marca.modelos.all()) for marca in obj.marcas.all())

    def get_criado_por(self, obj: Fabricante) -> str | None:
        return obj.criado_por_nome or None


class OpcaoSerializer(serializers.Serializer):
    """Uma opção dos dropdowns do Cotador."""

    id = serializers.IntegerField()
    nome = serializers.CharField()


class PrecoSerializer(serializers.ModelSerializer):
    registrado_por = serializers.SerializerMethodField()

    class Meta:
        model = PrecoFornecedor
        fields = ["custo", "registrado_em", "registrado_por"]

    def get_registrado_por(self, obj: PrecoFornecedor) -> str | None:
        return obj.registrado_por_nome or None


class PrecoListaSerializer(serializers.ModelSerializer):
    """Uma linha da tabela de preços — o que o fornecedor me cobra (ver a
    docstring de `PrecoFornecedor`)."""

    fornecedor = FornecedorResumoSerializer(read_only=True)
    produto = serializers.CharField(read_only=True)
    registrado_por = serializers.SerializerMethodField()

    class Meta:
        model = PrecoFornecedor
        fields = [
            "id",
            "fornecedor",
            "produto",
            "descricao",
            "modelo",
            "embalagem",
            "quantidade_embalagem",
            "preco_embalagem",
            "custo",
            "observacoes",
            "origem",
            "registrado_em",
            "registrado_por",
        ]

    def get_registrado_por(self, obj: PrecoFornecedor) -> str | None:
        return obj.registrado_por_nome or None


class PrecoCriarSerializer(serializers.ModelSerializer):
    """Registrar o preço que o fornecedor passou. O custo unitário não vem
    do cliente: é calculado da embalagem no `save()` do model."""

    fornecedor = serializers.PrimaryKeyRelatedField(queryset=Fornecedor.objects.all())
    quantidade_embalagem = serializers.IntegerField(min_value=1, default=1)
    preco_embalagem = serializers.DecimalField(
        max_digits=16, decimal_places=4, min_value=Decimal("0.0001")
    )
    embalagem = serializers.CharField(max_length=40, required=False, allow_blank=True)

    class Meta:
        model = PrecoFornecedor
        fields = [
            "fornecedor",
            "descricao",
            "modelo",
            "embalagem",
            "quantidade_embalagem",
            "preco_embalagem",
            "observacoes",
        ]

    def validate(self, dados):
        dados["descricao"] = " ".join((dados.get("descricao") or "").split())
        if not dados["descricao"] and not dados.get("modelo"):
            raise serializers.ValidationError({"descricao": "Informe o produto."})
        dados["embalagem"] = (dados.get("embalagem") or "").strip() or "Unidade"
        return dados

    def create(self, dados):
        dados["custo"] = dados["preco_embalagem"] / dados["quantidade_embalagem"]
        return super().create(dados)
