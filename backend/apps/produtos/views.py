"""Endpoints de produtos (`/api/produtos/`).

Criar é **idempotente** em todos os níveis: mandar um nome que já existe
(comparado normalizado, ver `models.normalizar_nome`) devolve o registro
existente com 200 em vez de duplicar. É o que deixa os dropdowns do Cotador
"criar rápido" sem medo — e, no fabricante, mandar `fornecedor` junto grava
a afinidade mesmo quando o fabricante já existia.
"""

from __future__ import annotations

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.fornecedores.models import Fornecedor

from .models import Fabricante, Marca, Modelo, PrecoFornecedor, normalizar_nome
from .serializers import (
    FabricanteSerializer,
    MarcaSerializer,
    ModeloSerializer,
    OpcaoSerializer,
    PrecoSerializer,
)

LIMITE_OPCOES = 30


class ProdutosPaginacao(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def _usuario(request: Request):
    return request.user if request.user.is_authenticated else None


def _nome(dados) -> str:
    nome = " ".join(str(dados.get("nome") or "").split())
    if not nome:
        raise ValidationError({"nome": "Informe o nome."})
    return nome


def _fabricantes():
    return Fabricante.objects.prefetch_related(
        "fornecedores",
        Prefetch("marcas", queryset=Marca.objects.prefetch_related("modelos")),
    )


def _renomear(registro, nome: str, irmaos) -> None:
    """Renomear não pode criar duplicata entre os irmãos (mesmo fabricante,
    mesma marca ou o cadastro inteiro, conforme o nível)."""

    if irmaos.filter(nome_normalizado=normalizar_nome(nome)).exclude(pk=registro.pk).exists():
        raise ValidationError({"nome": f"Já existe “{nome}”."})
    registro.nome = nome
    registro.save()


# ---------- fabricantes ----------

ORDENACOES = {"nome": "nome", "criado_em": "criado_em"}


class FabricantesView(APIView):
    """`GET` a tabela de Produtos (um fabricante por linha); `POST` cria —
    ou devolve o que já existe."""

    def get(self, request: Request) -> Response:
        fabricantes = _fabricantes()
        if termo := normalizar_nome(request.query_params.get("busca", "")):
            fabricantes = fabricantes.filter(
                Q(nome_normalizado__contains=termo)
                | Q(marcas__nome_normalizado__contains=termo)
                | Q(marcas__modelos__nome_normalizado__contains=termo)
                | Q(fornecedores__nome__icontains=request.query_params["busca"].strip())
            ).distinct()
        pedida = (request.query_params.get("ordering") or "").strip()
        campo = ORDENACOES.get(pedida.lstrip("-"), "nome")
        fabricantes = fabricantes.order_by(f"-{campo}" if pedida.startswith("-") else campo)

        paginacao = ProdutosPaginacao()
        pagina = paginacao.paginate_queryset(fabricantes, request, view=self)
        return paginacao.get_paginated_response(FabricanteSerializer(pagina, many=True).data)

    def post(self, request: Request) -> Response:
        nome = _nome(request.data)
        fabricante = Fabricante.objects.filter(nome_normalizado=normalizar_nome(nome)).first()
        criado = fabricante is None
        if criado:
            fabricante = Fabricante.objects.create(nome=nome, criado_por=_usuario(request))
        if ids := request.data.get("fornecedor_ids"):
            fabricante.fornecedores.add(*Fornecedor.objects.filter(pk__in=ids))
        if fornecedor := request.data.get("fornecedor"):
            fabricante.fornecedores.add(get_object_or_404(Fornecedor, pk=fornecedor))
        return Response(
            FabricanteSerializer(_fabricantes().get(pk=fabricante.pk)).data,
            status=status.HTTP_201_CREATED if criado else status.HTTP_200_OK,
        )


class FabricanteView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        return Response(FabricanteSerializer(get_object_or_404(_fabricantes(), pk=pk)).data)

    def put(self, request: Request, pk: int) -> Response:
        fabricante = get_object_or_404(Fabricante, pk=pk)
        _renomear(fabricante, _nome(request.data), Fabricante.objects.all())
        if "fornecedor_ids" in request.data:
            fabricante.fornecedores.set(
                Fornecedor.objects.filter(pk__in=request.data["fornecedor_ids"] or [])
            )
        return Response(FabricanteSerializer(_fabricantes().get(pk=pk)).data)

    def delete(self, request: Request, pk: int) -> Response:
        # As cotações guardam o nome (snapshot) e a FK cai para nulo.
        get_object_or_404(Fabricante, pk=pk).delete()
        return Response(status=204)


class FabricantesOpcoesView(APIView):
    """`GET ?busca=&fornecedor=` — o dropdown de fabricante. Com fornecedor,
    só os que ele vende (`afim`); outro fabricante entra pelo "criar", que é
    idempotente e grava a afinidade."""

    def get(self, request: Request) -> Response:
        fabricantes = Fabricante.objects.all()
        if termo := normalizar_nome(request.query_params.get("busca", "")):
            fabricantes = fabricantes.filter(nome_normalizado__contains=termo)
        fornecedor = request.query_params.get("fornecedor")
        if fornecedor:
            fabricantes = fabricantes.filter(fornecedores=fornecedor)
        return Response(
            [
                {**OpcaoSerializer(f).data, "afim": bool(fornecedor)}
                for f in fabricantes.order_by("nome")[:LIMITE_OPCOES]
            ]
        )


# ---------- marcas e modelos ----------


class MarcasView(APIView):
    def post(self, request: Request) -> Response:
        fabricante = get_object_or_404(Fabricante, pk=request.data.get("fabricante"))
        nome = _nome(request.data)
        marca, criada = Marca.objects.get_or_create(
            fabricante=fabricante,
            nome_normalizado=normalizar_nome(nome),
            defaults={"nome": nome, "criado_por": _usuario(request)},
        )
        return Response(MarcaSerializer(marca).data, status=201 if criada else 200)


class MarcaView(APIView):
    def put(self, request: Request, pk: int) -> Response:
        marca = get_object_or_404(Marca, pk=pk)
        _renomear(marca, _nome(request.data), Marca.objects.filter(fabricante=marca.fabricante))
        return Response(MarcaSerializer(marca).data)

    def delete(self, request: Request, pk: int) -> Response:
        get_object_or_404(Marca, pk=pk).delete()
        return Response(status=204)


class MarcasOpcoesView(APIView):
    def get(self, request: Request) -> Response:
        marcas = Marca.objects.filter(fabricante=request.query_params.get("fabricante") or 0)
        if termo := normalizar_nome(request.query_params.get("busca", "")):
            marcas = marcas.filter(nome_normalizado__contains=termo)
        return Response(OpcaoSerializer(marcas.order_by("nome")[:LIMITE_OPCOES], many=True).data)


class ModelosView(APIView):
    def post(self, request: Request) -> Response:
        marca = get_object_or_404(Marca, pk=request.data.get("marca"))
        nome = _nome(request.data)
        modelo, criado = Modelo.objects.get_or_create(
            marca=marca,
            nome_normalizado=normalizar_nome(nome),
            defaults={"nome": nome, "criado_por": _usuario(request)},
        )
        return Response(ModeloSerializer(modelo).data, status=201 if criado else 200)


class ModeloView(APIView):
    def put(self, request: Request, pk: int) -> Response:
        modelo = get_object_or_404(Modelo, pk=pk)
        _renomear(modelo, _nome(request.data), Modelo.objects.filter(marca=modelo.marca))
        return Response(ModeloSerializer(modelo).data)

    def delete(self, request: Request, pk: int) -> Response:
        get_object_or_404(Modelo, pk=pk).delete()
        return Response(status=204)


class ModelosOpcoesView(APIView):
    def get(self, request: Request) -> Response:
        modelos = Modelo.objects.filter(marca=request.query_params.get("marca") or 0)
        if termo := normalizar_nome(request.query_params.get("busca", "")):
            modelos = modelos.filter(nome_normalizado__contains=termo)
        return Response(OpcaoSerializer(modelos.order_by("nome")[:LIMITE_OPCOES], many=True).data)


# ---------- tabela de preços ----------


class PrecoSugeridoView(APIView):
    """`GET ?fornecedor=&modelo=` — o último custo desse fornecedor para esse
    modelo, ou `null` quando nunca foi cotado."""

    def get(self, request: Request) -> Response:
        preco = PrecoFornecedor.objects.filter(
            fornecedor=request.query_params.get("fornecedor") or 0,
            modelo=request.query_params.get("modelo") or 0,
        ).first()
        return Response(PrecoSerializer(preco).data if preco else None)
