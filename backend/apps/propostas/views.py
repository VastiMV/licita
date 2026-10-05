"""`POST /api/propostas/` — gerar a proposta de uma licitação em cotação.

Idempotente: gerar de novo devolve a existente (200), sem evento novo no
histórico. Sem cotação não há o que propor (400).
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.licitacoes.models import EventoOportunidadeSalva, OportunidadeSalva, nome_de_usuario

from .models import Proposta


def _resposta(proposta: Proposta) -> dict:
    return {
        "id": proposta.pk,
        "oportunidade_id": proposta.oportunidade_id,
        "valor": float(proposta.valor),
        "gerada_por": proposta.gerada_por_nome or None,
        "gerada_em": proposta.gerada_em,
    }


class PropostasView(APIView):
    def post(self, request: Request) -> Response:
        oportunidade = get_object_or_404(
            OportunidadeSalva.objects.ativas().select_related("cotacao"),
            pk=request.data.get("oportunidade_id"),
        )
        if existente := Proposta.objects.filter(oportunidade=oportunidade).first():
            return Response(_resposta(existente))

        cotacao = getattr(oportunidade, "cotacao", None)
        if cotacao is None:
            raise serializers.ValidationError(
                {"oportunidade_id": "Salve a cotação antes de gerar a proposta."}
            )

        usuario = request.user if request.user.is_authenticated else None
        proposta = Proposta.objects.create(
            oportunidade=oportunidade,
            valor=cotacao.valor_cotado,
            gerada_por=usuario,
            gerada_por_nome=nome_de_usuario(usuario) if usuario else "",
        )
        oportunidade.registrar(
            EventoOportunidadeSalva.Tipo.PROPOSTA,
            autor=usuario,
            descricao=(
                f"Proposta gerada por {nome_de_usuario(usuario)} — "
                f"valor R$ {proposta.valor}."
            ),
            dados={"proposta_id": proposta.pk, "valor": float(proposta.valor)},
        )
        return Response(_resposta(proposta), status=201)
