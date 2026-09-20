"""Endpoints do dossiê da empresa.

Tudo sob `/api/documentos/`, com `?empresa=` para recortar — e não
`/api/empresas/<id>/documentos/`, para o app de empresas não precisar
conhecer o de documentos. A dependência é de mão única: `documentos` →
`empresas`.
"""

from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.armazenamento.base import ErroArmazenamento
from apps.tenants.atual import tenant_atual

from .models import Documento, EventoDocumento, Situacao, TipoDocumento, TipoEvento, VersaoDocumento
from .serializers import (
    DocumentoSerializer,
    EventoSerializer,
    NovaVersaoSerializer,
    TipoDocumentoSerializer,
    VersaoSerializer,
)
from .upload import ErroUpload, gravar_versao


def _documentos_do_tenant(request: Request):
    return Documento.objects.do_tenant(tenant_atual(request)).com_versao_atual()


class TiposView(APIView):
    """`GET /api/documentos/tipos/` — o catálogo para o seletor de "adicionar
    documento": os padrão mais os que este cliente acrescentou."""

    def get(self, request: Request) -> Response:
        tenant = tenant_atual(request)
        tipos = TipoDocumento.objects.filter(
            Q(tenant__isnull=True) | Q(tenant=tenant), ativo=True
        )
        return Response(TipoDocumentoSerializer(tipos, many=True).data)


class DocumentosView(APIView):
    """`GET/POST /api/documentos/?empresa=<id>`.

    O `GET` devolve a lista **e os contadores** no mesmo lugar: são os três
    números do topo do modal, e pedi-los em outra chamada faria a tela
    mostrar contador de um momento e lista de outro.
    """

    def get(self, request: Request) -> Response:
        documentos = _documentos_do_tenant(request).ativos()

        if empresa_id := request.query_params.get("empresa"):
            documentos = documentos.filter(empresa_id=empresa_id)

        documentos = list(documentos)
        # Ordena por quem vence primeiro, não por nome: a pergunta da tela é
        # "o que vai me derrubar primeiro". Sem validade vai para o fim.
        documentos.sort(key=lambda d: (d.validade is None, d.validade or timezone.localdate()))

        contagem = {situacao: 0 for situacao in Situacao.values}
        for documento in documentos:
            contagem[documento.situacao] += 1

        return Response(
            {
                "results": DocumentoSerializer(documentos, many=True).data,
                # Os quatro são disjuntos e somam o total: "a vencer" não
                # entra em "válidos", senão os cartões do topo se
                # sobrepõem e o número deixa de dizer o que fazer.
                "validos": contagem[Situacao.VALIDO],
                "a_vencer": contagem[Situacao.A_VENCER],
                "vencidos": contagem[Situacao.VENCIDO],
                "pendentes": contagem[Situacao.PENDENTE],
            }
        )

    def post(self, request: Request) -> Response:
        """Abre uma vaga nova. Os tipos obrigatórios já vêm abertos quando a
        empresa é cadastrada (ver `vagas.py`) — isto é para o opcional e para
        o "outro documento" que um edital específico pediu."""

        tenant = tenant_atual(request)
        serializer = DocumentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return Response(serializer.data, status=201)


class DocumentoView(APIView):
    """`GET/PUT/DELETE /api/documentos/<id>/`.

    `DELETE` **arquiva**: o documento sai das listas e das contagens, mas
    continua existindo e continua preso ao processo em que foi usado. Nada
    some — é a mesma disciplina da remoção lógica da oportunidade salva.
    """

    def get(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)
        return Response(DocumentoSerializer(documento).data)

    def put(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)
        serializer = DocumentoSerializer(documento, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)

        if documento.arquivado_em is None:
            documento.arquivado_em = timezone.now()
            documento.save(update_fields=["arquivado_em", "atualizado_em"])
            EventoDocumento.registrar(documento, TipoEvento.ARQUIVADO, autor=request.user)

        return Response(DocumentoSerializer(documento).data)


class RestaurarView(APIView):
    """`POST /api/documentos/<id>/restaurar/` — desfaz o arquivamento."""

    def post(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)

        if documento.arquivado_em is not None:
            documento.arquivado_em = None
            documento.save(update_fields=["arquivado_em", "atualizado_em"])
            EventoDocumento.registrar(documento, TipoEvento.RESTAURADO, autor=request.user)

        return Response(DocumentoSerializer(documento).data)


class VersoesView(APIView):
    """`GET/POST /api/documentos/<id>/versoes/`.

    O `POST` é o gesto principal da tela — "+ versão" —, porque renovar o
    FGTS acontece doze vezes por ano. Recebe `multipart`.
    """

    def get(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)
        return Response(VersaoSerializer(documento.versoes.all(), many=True).data)

    def post(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)

        entrada = NovaVersaoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        dados = dict(entrada.validated_data)
        arquivo = dados.pop("arquivo")

        try:
            versao = gravar_versao(documento, arquivo, autor=request.user, **dados)
        except ErroUpload as erro:
            # Recusa do arquivo: é erro de quem mandou.
            return Response({"arquivo": [str(erro)]}, status=400)
        except ErroArmazenamento as erro:
            # Bucket não configurado ou credencial recusada: não é culpa de
            # quem tentou subir, e a mensagem diz onde resolver.
            return Response({"detail": str(erro)}, status=503)

        documento.refresh_from_db()
        return Response(
            {
                "versao": VersaoSerializer(versao).data,
                "documento": DocumentoSerializer(documento).data,
            },
            status=201,
        )


class DownloadView(APIView):
    """`GET /api/documentos/versoes/<id>/download/`.

    Devolve a **URL assinada** em JSON, e não o arquivo: o bucket nunca é
    público, e o arquivo não precisa trafegar pelo backend só para chegar ao
    navegador. Também é aqui que o "baixou" entra no histórico.
    """

    def get(self, request: Request, pk: int) -> Response:
        versao = get_object_or_404(
            VersaoDocumento.objects.select_related("documento").filter(
                documento__tenant=tenant_atual(request)
            ),
            pk=pk,
        )

        try:
            from apps.armazenamento.servico import armazenamento_do_tenant

            url = armazenamento_do_tenant(versao.documento.tenant).url_temporaria(versao.arquivo)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)

        EventoDocumento.registrar(
            versao.documento, TipoEvento.BAIXADO, autor=request.user, detalhe=f"v{versao.versao}"
        )
        return Response({"url": url, "nome": versao.nome_original})


class EventosView(APIView):
    """`GET /api/documentos/<id>/eventos/` — o histórico daquela vaga."""

    def get(self, request: Request, pk: int) -> Response:
        documento = get_object_or_404(_documentos_do_tenant(request), pk=pk)
        return Response(EventoSerializer(documento.eventos.all(), many=True).data)
