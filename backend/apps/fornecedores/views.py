"""Endpoints do cadastro de fornecedores.

A lista segue o mesmo contrato da tabela de oportunidades salvas (`busca`,
`ordering`, `page`, `page_size`) porque a tela é a mesma tabela — o
`DataTableComponent` do frontend não conhece domínio, só esse contrato. Ver
`apps/licitacoes/views.py` para o original.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Fornecedor
from .serializers import FornecedorOpcaoSerializer, FornecedorSerializer


class FornecedoresPaginacao(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# Colunas da tabela -> campo real. Whitelist pelo mesmo motivo da lista de
# salvas: o nome da coluna é contrato de tela, e ordenar por campo interno
# (observações, PIX) não faz sentido nenhum.
ORDENACOES = {
    "nome": "nome",
    "cnpj": "cnpj",
    "cidade": "cidade",
    "categoria": "categoria",
    "situacao": "situacao",
    "criado_em": "criado_em",
}
ORDENACAO_PADRAO = "nome"


def _ordenacao(pedida: str | None) -> str:
    pedida = (pedida or "").strip()
    descendente = pedida.startswith("-")
    campo = ORDENACOES.get(pedida.lstrip("-"))
    if not campo:
        return ORDENACAO_PADRAO
    return f"-{campo}" if descendente else campo


class FornecedoresView(APIView):
    """`GET/POST /api/fornecedores/`."""

    def get(self, request: Request) -> Response:
        fornecedores = Fornecedor.objects.buscar(
            request.query_params.get("busca", "")
        ).order_by(_ordenacao(request.query_params.get("ordering")))

        paginacao = FornecedoresPaginacao()
        pagina = paginacao.paginate_queryset(fornecedores, request, view=self)
        resposta = paginacao.get_paginated_response(
            FornecedorSerializer(pagina, many=True).data
        )
        # Do cadastro inteiro, não da busca em curso: é o número do aviso
        # "N fornecedores com documentação vencida" que a tela mostra ao abrir.
        resposta.data["documentacao_vencida"] = Fornecedor.objects.filter(
            situacao="documentacao_vencida"
        ).count()
        return resposta

    def post(self, request: Request) -> Response:
        serializer = FornecedorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(criado_por=request.user if request.user.is_authenticated else None)
        return Response(serializer.data, status=201)


class FornecedorView(APIView):
    """`GET/PUT/DELETE /api/fornecedores/<id>/`.

    `PUT` (e não `PATCH`) porque a tela manda o formulário inteiro: o modal
    de edição abre preenchido com o registro completo, então mandar parcial
    esconderia um campo apagado de propósito.
    """

    def get(self, request: Request, pk: int) -> Response:
        fornecedor = get_object_or_404(Fornecedor, pk=pk)
        return Response(FornecedorSerializer(fornecedor).data)

    def put(self, request: Request, pk: int) -> Response:
        fornecedor = get_object_or_404(Fornecedor, pk=pk)
        serializer = FornecedorSerializer(fornecedor, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request: Request, pk: int) -> Response:
        fornecedor = get_object_or_404(Fornecedor, pk=pk)
        # Exclusão de verdade: as cotações que já usaram este fornecedor
        # guardam o nome como snapshot e a FK cai para nulo (ver
        # `apps.cotador.models.OfertaFornecedor`), então nada fica órfão.
        fornecedor.delete()
        return Response(status=204)


class FornecedoresOpcoesView(APIView):
    """`GET /api/fornecedores/opcoes/` — o cadastro inteiro, enxuto, para o
    seletor de fornecedor do Cotador.

    Sem paginação de propósito: o operador está no meio de uma cotação e
    precisa achar o fornecedor ali, não navegar por páginas. `?todos=1`
    inclui inativos e com documentação vencida — é o que a tela usa ao
    **abrir uma cotação antiga**, para não sumir o fornecedor que já estava
    escolhido nela.
    """

    def get(self, request: Request) -> Response:
        fornecedores = Fornecedor.objects.all()
        if request.query_params.get("todos") not in ("1", "true"):
            fornecedores = fornecedores.disponiveis()
        return Response(
            FornecedorOpcaoSerializer(fornecedores.order_by("nome"), many=True).data
        )
