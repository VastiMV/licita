"""Endpoints do Cotador.

Duas entradas, um só jeito de gravar:

- **da busca** — o operador clica "Cotar" num card de oportunidade
  pesquisada. O modal abre com os itens do edital já preenchidos, mas
  **nada é persistido**: enquanto ele mexe, a cotação existe só no
  navegador. Ao salvar, o payload traz a oportunidade inteira
  (`oportunidade`) e ela entra na lista de salvas junto com a cotação.
- **das salvas** — a oportunidade já está na lista; o payload traz só o id
  (`oportunidade_id`).

`POST` cria **ou sobrescreve** a cotação daquela oportunidade. É idempotente
de propósito (a cotação é um-para-um com a oportunidade, ver `models.py`), o
que deixa o frontend salvar sem precisar saber se já existia uma.
"""

from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers as drf_serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.licitacoes.models import EventoOportunidadeSalva, OportunidadeSalva, nome_de_usuario
from apps.licitacoes.salvas import garantir_salva

from .models import Cotacao
from .planilha import gerar_planilha, nome_do_arquivo
from .serializers import CotacaoSerializer

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _com_relacionados(queryset):
    """A resposta serializa itens, ofertas e o fornecedor de cada uma — sem
    isto, uma cotação de 30 itens vira dezenas de consultas."""

    return queryset.select_related("oportunidade").prefetch_related("itens__ofertas__fornecedor")


class CotacoesView(APIView):
    """`POST /api/cotador/cotacoes/` — salvar a cotação (e, com ela, a
    oportunidade)."""

    def post(self, request: Request) -> Response:
        dados = dict(request.data)
        oportunidade, oportunidade_criada = self._resolver_oportunidade(dados, request)

        existente = Cotacao.objects.filter(oportunidade=oportunidade).first()
        serializer = CotacaoSerializer(existente, data=dados)
        serializer.is_valid(raise_exception=True)

        usuario = request.user if request.user.is_authenticated else None
        if existente:
            cotacao = serializer.save(atualizada_por=usuario)
        else:
            cotacao = serializer.save(
                oportunidade=oportunidade, criada_por=usuario, atualizada_por=usuario
            )

        # O histórico da oportunidade registra a cotação — é o que responde
        # "por que este edital está na lista" quando ninguém lembra mais.
        oportunidade.registrar(
            EventoOportunidadeSalva.Tipo.PROPOSTA_GERADA,
            autor=usuario,
            descricao=(
                f"Cotação {'criada' if not existente else 'atualizada'} por "
                f"{nome_de_usuario(usuario)} — valor cotado R$ {cotacao.valor_cotado}."
            ),
            dados={"cotacao_id": cotacao.pk},
        )

        resposta = CotacaoSerializer(_com_relacionados(Cotacao.objects).get(pk=cotacao.pk)).data
        # O frontend precisa saber se a oportunidade acabou de entrar na
        # lista para avisar o usuário ("salva também em Oportunidades /
        # Salvas") — a cotação sozinha não conta essa história.
        resposta["oportunidade_criada"] = oportunidade_criada
        return Response(resposta, status=201 if not existente else 200)

    @staticmethod
    def _resolver_oportunidade(dados: dict, request) -> tuple[OportunidadeSalva, bool]:
        """`oportunidade_id` (já salva) ou `oportunidade` (o payload da
        busca, que é salvo agora). Um dos dois é obrigatório: cotação sem
        edital não existe."""

        # `dados` vem do corpo da requisição e vai direto pro serializer da
        # cotação; as duas chaves de oportunidade não são campos dele.
        oportunidade_id = dados.pop("oportunidade_id", None)
        payload = dados.pop("oportunidade", None)

        if oportunidade_id:
            return get_object_or_404(OportunidadeSalva.objects.ativas(), pk=oportunidade_id), False
        if payload:
            return garantir_salva(payload, request=request)

        raise drf_serializers.ValidationError(
            {"oportunidade": "Informe `oportunidade_id` ou o payload `oportunidade` da busca."}
        )


class CotacaoView(APIView):
    """`GET/DELETE /api/cotador/cotacoes/<id>/`."""

    def get(self, request: Request, pk: int) -> Response:
        cotacao = get_object_or_404(_com_relacionados(Cotacao.objects), pk=pk)
        return Response(CotacaoSerializer(cotacao).data)

    def delete(self, request: Request, pk: int) -> Response:
        cotacao = get_object_or_404(Cotacao.objects, pk=pk)
        # Só a cotação: a oportunidade continua salva. Quem quiser tirá-la
        # da lista faz isso no módulo de salvas — apagar as duas juntas
        # descartaria trabalho que ninguém pediu para descartar.
        cotacao.delete()
        return Response(status=204)


class OportunidadeCotacaoView(APIView):
    """`GET /api/cotador/oportunidades/<id>/cotacao/` — a cotação de uma
    oportunidade salva.

    404 quando ainda não foi cotada: é o sinal de que o modal abre em
    branco, com os itens do snapshot da oportunidade. Existe porque a tela
    de salvas conhece o id da oportunidade, não o da cotação.
    """

    def get(self, request: Request, pk: int) -> Response:
        oportunidade = get_object_or_404(OportunidadeSalva.objects.ativas(), pk=pk)
        cotacao = get_object_or_404(_com_relacionados(Cotacao.objects), oportunidade=oportunidade)
        return Response(CotacaoSerializer(cotacao).data)


class CotacaoPlanilhaView(APIView):
    """`GET /api/cotador/cotacoes/<id>/planilha/` — a proposta em .xlsx.

    A planilha sai com fórmulas, não com números congelados (ver
    `planilha.py`): quem recebe pode mexer no custo e ver o preço se
    refazer.
    """

    def get(self, request: Request, pk: int) -> Response:
        cotacao = get_object_or_404(_com_relacionados(Cotacao.objects), pk=pk)
        conteudo = gerar_planilha(cotacao)

        resposta = HttpResponse(conteudo, content_type=XLSX)
        resposta["Content-Disposition"] = f'attachment; filename="{nome_do_arquivo(cotacao)}"'
        # O download é feito por fetch autenticado (o token vai no header,
        # então não dá pra usar um <a href> puro) — sem expor o nome aqui, o
        # frontend não teria como nomear o arquivo que salva.
        resposta["Access-Control-Expose-Headers"] = "Content-Disposition"
        return resposta
