"""Endpoints do cadastro de empresas.

Mesmo contrato de tabela do resto do app (`busca`, `ordering`, `page`,
`page_size`) porque a tela é a mesma tabela — o `DataTableComponent` do
frontend não conhece domínio, só esse contrato. Ver `apps/fornecedores/views.py`.

Toda consulta passa por `do_tenant(tenant_atual(request))`. Hoje isso não
filtra nada (há um tenant), e é justamente esse o ponto: no dia em que houver
dois, não há nenhum queryset para lembrar de corrigir.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.atual import tenant_atual

from .models import Empresa
from .serializers import EmpresaOpcaoSerializer, EmpresaSerializer


class EmpresasPaginacao(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# Colunas da tabela -> campo real. Whitelist pelo mesmo motivo das outras
# listas: nome de coluna é contrato de tela, e ordenar por campo interno
# (observações, CNAE) não faz sentido nenhum.
ORDENACOES = {
    "nome": "nome",
    "cnpj": "cnpj",
    "cidade": "cidade",
    "porte": "porte",
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


class EmpresasView(APIView):
    """`GET/POST /api/empresas/`."""

    def get(self, request: Request) -> Response:
        tenant = tenant_atual(request)
        empresas = (
            Empresa.objects.do_tenant(tenant)
            .buscar(request.query_params.get("busca", ""))
            .order_by(_ordenacao(request.query_params.get("ordering")))
        )

        paginacao = EmpresasPaginacao()
        pagina = paginacao.paginate_queryset(empresas, request, view=self)
        return paginacao.get_paginated_response(
            EmpresaSerializer(pagina, many=True, context={"tenant": tenant}).data
        )

    def post(self, request: Request) -> Response:
        tenant = tenant_atual(request)
        serializer = EmpresaSerializer(data=request.data, context={"tenant": tenant})
        serializer.is_valid(raise_exception=True)
        serializer.save(
            tenant=tenant,
            criado_por=request.user if request.user.is_authenticated else None,
        )
        return Response(serializer.data, status=201)


class EmpresaView(APIView):
    """`GET/PUT/DELETE /api/empresas/<id>/`.

    `PUT` (e não `PATCH`) porque a tela manda o formulário inteiro — mesma
    razão do cadastro de fornecedores.
    """

    def get(self, request: Request, pk: int) -> Response:
        tenant = tenant_atual(request)
        empresa = get_object_or_404(Empresa.objects.do_tenant(tenant), pk=pk)
        return Response(EmpresaSerializer(empresa, context={"tenant": tenant}).data)

    def put(self, request: Request, pk: int) -> Response:
        tenant = tenant_atual(request)
        empresa = get_object_or_404(Empresa.objects.do_tenant(tenant), pk=pk)
        serializer = EmpresaSerializer(empresa, data=request.data, context={"tenant": tenant})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request: Request, pk: int) -> Response:
        """Inativa — não apaga. A empresa está amarrada a propostas e
        processos, e o que foi entregue com o CNPJ dela tem que continuar
        podendo ser provado (ver a docstring do model).

        Responde 200 com o registro, e não 204: a tela precisa do estado novo
        para redesenhar a linha, já que ela continua na lista.
        """

        tenant = tenant_atual(request)
        empresa = get_object_or_404(Empresa.objects.do_tenant(tenant), pk=pk)

        if empresa.padrao:
            return Response(
                {"detail": "Esta é a empresa padrão. Escolha outra como padrão antes de inativá-la."},
                status=400,
            )

        empresa.ativa = False
        empresa.save(update_fields=["ativa", "atualizado_em"])
        return Response(EmpresaSerializer(empresa, context={"tenant": tenant}).data)


class EmpresasOpcoesView(APIView):
    """`GET /api/empresas/opcoes/` — o seletor de "com qual CNPJ eu disputo".

    Sem paginação: são poucas empresas e quem está montando uma proposta
    precisa escolher ali. `?todas=1` inclui as inativas — é o que a tela usa
    ao **abrir uma proposta antiga**, para não sumir o CNPJ que já estava
    escolhido nela (mesma razão do `?todos=1` do Cotador).
    """

    def get(self, request: Request) -> Response:
        empresas = Empresa.objects.do_tenant(tenant_atual(request))
        if request.query_params.get("todas") not in ("1", "true"):
            empresas = empresas.ativas()
        return Response(EmpresaOpcaoSerializer(empresas.order_by("nome"), many=True).data)
