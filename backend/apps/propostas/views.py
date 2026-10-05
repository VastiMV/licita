"""Endpoints de Propostas, sob `/api/propostas/`.

- `GET /` — a lista de Ciclo › Propostas (as salvas na etapa Proposta);
  `POST /` — gerar a proposta de uma licitação em cotação (idempotente: gerar
  de novo devolve a existente, sem evento novo; sem cotação, 400).
- `GET/PATCH /<id>/` — o modal: a proposta, as empresas para escolher e os
  arquivos desta licitação. Os documentos da empresa a tela pede a
  `/api/documentos/?empresa=` — moram lá.
- `GET /<id>/documento/` — a proposta comercial em Word, preenchida a partir
  do modelo (ver `documento.py`). Fica guardada entre os arquivos quando há
  armazenamento configurado.
- `POST /<id>/arquivos/`, `GET /arquivos/<id>/download/`,
  `DELETE /arquivos/<id>/` — o que a equipe sobe para esta licitação.
- `GET/POST/DELETE /modelo/`, `GET /modelo/download/` — o Word do cliente.
"""

from __future__ import annotations

import io

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.armazenamento.base import ErroArmazenamento
from apps.armazenamento.caminhos import caminho
from apps.armazenamento.servico import armazenamento_do_tenant
from apps.documentos.upload import ErroUpload, validar
from apps.empresas.models import Empresa
from apps.licitacoes.models import EventoOportunidadeSalva, OportunidadeSalva, nome_de_usuario
from apps.licitacoes.serializers import OportunidadeSalvaSerializer
from apps.licitacoes.views import ORDENACOES, OportunidadesSalvasPaginacao
from apps.tenants.atual import tenant_atual

from .documento import MODELO_PADRAO, gerar_docx, nome_do_arquivo
from .models import ArquivoProposta, ModeloProposta, Proposta

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _usuario(request: Request):
    return request.user if request.user.is_authenticated else None


def _nome(request: Request) -> str:
    usuario = _usuario(request)
    return nome_de_usuario(usuario) if usuario else ""


def _empresas(request: Request):
    return Empresa.objects.do_tenant(tenant_atual(request)).ativas().order_by("-padrao", "nome")


def _empresa_inicial(request: Request) -> Empresa | None:
    """Com uma empresa só, é ela; com várias, a marcada como padrão."""

    empresas = list(_empresas(request)[:2])
    if len(empresas) == 1:
        return empresas[0]
    return next((e for e in empresas if e.padrao), None)


def _arquivo(arquivo: ArquivoProposta) -> dict:
    return {
        "id": arquivo.pk,
        "origem": arquivo.origem,
        "nome": arquivo.nome_original,
        "tamanho": arquivo.tamanho,
        "enviado_por": arquivo.enviado_por_nome or None,
        "enviado_em": arquivo.enviado_em,
    }


def _resposta(proposta: Proposta) -> dict:
    empresa = proposta.empresa
    return {
        "id": proposta.pk,
        "oportunidade_id": proposta.oportunidade_id,
        "valor": float(proposta.valor),
        "validade_dias": proposta.validade_dias,
        "empresa": {"id": empresa.pk, "nome": empresa.nome, "cnpj": empresa.cnpj}
        if empresa
        else None,
        "gerada_por": proposta.gerada_por_nome or None,
        "gerada_em": proposta.gerada_em,
    }


# ---------- lista e gerar ----------


class PropostasView(APIView):
    def get(self, request: Request) -> Response:
        pedida = (request.query_params.get("ordering") or "").strip()
        ordenacoes = {**ORDENACOES, "gerada_em": "proposta__gerada_em", "valor_proposto": "proposta__valor"}
        campo = ordenacoes.get(pedida.lstrip("-"))
        ordem = (f"-{campo}" if pedida.startswith("-") else campo) if campo else "data_encerramento_proposta"

        lista = (
            OportunidadeSalva.objects.ativas()
            .filter(proposta__isnull=False)
            .buscar(request.query_params.get("busca", ""))
            .select_related("proposta__empresa")
            .prefetch_related("proposta__arquivos")
            .order_by(ordem, "id")
        )
        paginacao = OportunidadesSalvasPaginacao()
        pagina = paginacao.paginate_queryset(lista, request, view=self)
        linhas = [
            {
                **OportunidadeSalvaSerializer(salva).data,
                "proposta": {
                    **_resposta(salva.proposta),
                    "arquivos": len(salva.proposta.arquivos.all()),
                    "documento_gerado": any(
                        a.origem == ArquivoProposta.Origem.GERADO
                        for a in salva.proposta.arquivos.all()
                    ),
                },
            }
            for salva in pagina
        ]
        return paginacao.get_paginated_response(linhas)

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

        usuario = _usuario(request)
        proposta = Proposta.objects.create(
            oportunidade=oportunidade,
            valor=cotacao.valor_cotado,
            empresa=_empresa_inicial(request),
            gerada_por=usuario,
            gerada_por_nome=_nome(request),
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


# ---------- uma proposta ----------


def _proposta(pk: int) -> Proposta:
    return get_object_or_404(
        Proposta.objects.select_related("oportunidade", "empresa").filter(
            oportunidade__removida_em__isnull=True
        ),
        pk=pk,
    )


class PropostaView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        proposta = _proposta(pk)
        modelo = ModeloProposta.objects.filter(tenant=tenant_atual(request)).first()
        return Response(
            {
                **_resposta(proposta),
                "oportunidade": OportunidadeSalvaSerializer(proposta.oportunidade).data,
                "empresas": [
                    {"id": e.pk, "nome": e.nome, "cnpj": e.cnpj} for e in _empresas(request)
                ],
                "arquivos": [_arquivo(a) for a in proposta.arquivos.all()],
                "modelo": _modelo(modelo),
            }
        )

    def patch(self, request: Request, pk: int) -> Response:
        proposta = _proposta(pk)
        campos = []
        if "empresa_id" in request.data:
            proposta.empresa = get_object_or_404(_empresas(request), pk=request.data["empresa_id"])
            campos.append("empresa")
        if "validade_dias" in request.data:
            try:
                dias = int(request.data["validade_dias"])
            except (TypeError, ValueError):
                dias = 0
            if dias < 1:
                raise serializers.ValidationError({"validade_dias": "Informe os dias de validade."})
            proposta.validade_dias = dias
            campos.append("validade_dias")
        if campos:
            proposta.save(update_fields=campos)
        return Response(_resposta(proposta))


def _armazenamento(request: Request):
    return armazenamento_do_tenant(tenant_atual(request))


def _ler_modelo(request: Request):
    """O Word do cliente, ou `None` para o padrão do sistema."""

    modelo = ModeloProposta.objects.filter(tenant=tenant_atual(request)).first()
    if modelo is None:
        return None
    with _armazenamento(request).abrir(modelo.arquivo) as lido:
        return io.BytesIO(lido.read())


class DocumentoView(APIView):
    """A proposta comercial em Word. Gerar de novo substitui a gerada antes
    (é sempre a mesma proposta, com o dado de agora)."""

    def get(self, request: Request, pk: int) -> Response:
        proposta = _proposta(pk)
        if proposta.empresa is None:
            return Response(
                {"detail": "Escolha a empresa (CNPJ) da proposta antes de gerar o documento."},
                status=400,
            )
        try:
            conteudo = gerar_docx(proposta, _ler_modelo(request))
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)
        except Exception as erro:  # o modelo do cliente pode ter campo mal escrito
            return Response(
                {"detail": f"O modelo de proposta tem um campo inválido: {erro}"}, status=400
            )

        nome = nome_do_arquivo(proposta)
        _guardar_gerado(request, proposta, conteudo, nome)

        resposta = HttpResponse(conteudo, content_type=DOCX)
        resposta["Content-Disposition"] = f'attachment; filename="{nome}"'
        resposta["Access-Control-Expose-Headers"] = "Content-Disposition"
        return resposta


def _guardar_gerado(request: Request, proposta: Proposta, conteudo: bytes, nome: str) -> None:
    """Guarda entre os arquivos da proposta. Sem armazenamento configurado o
    download acontece do mesmo jeito — só não fica guardado."""

    tenant = tenant_atual(request)
    try:
        armazenamento = armazenamento_do_tenant(tenant)
    except ErroArmazenamento:
        return
    destino = caminho(tenant, "propostas", str(proposta.pk), "proposta-comercial.docx")
    gravado = armazenamento.salvar(destino, io.BytesIO(conteudo), content_type=DOCX)
    with transaction.atomic():
        proposta.arquivos.filter(origem=ArquivoProposta.Origem.GERADO).delete()
        ArquivoProposta.objects.create(
            tenant=tenant,
            proposta=proposta,
            origem=ArquivoProposta.Origem.GERADO,
            arquivo=gravado,
            nome_original=nome,
            tamanho=len(conteudo),
            content_type=DOCX,
            enviado_por_nome=_nome(request),
        )


# ---------- arquivos desta licitação ----------


class ArquivosView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        proposta = _proposta(pk)
        arquivo = request.FILES.get("arquivo")
        if arquivo is None:
            return Response({"detail": "Envie o arquivo no campo `arquivo`."}, status=400)
        try:
            ext = validar(arquivo)
            tenant = tenant_atual(request)
            armazenamento = armazenamento_do_tenant(tenant)
        except ErroUpload as erro:
            return Response({"detail": str(erro)}, status=400)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)

        registro = ArquivoProposta.objects.create(
            tenant=tenant,
            proposta=proposta,
            origem=ArquivoProposta.Origem.SUBIDO,
            arquivo="",
            nome_original=arquivo.name,
            tamanho=arquivo.size,
            content_type=arquivo.content_type or "",
            enviado_por_nome=_nome(request),
        )
        destino = caminho(tenant, "propostas", str(proposta.pk), f"{registro.pk}.{ext}")
        registro.arquivo = armazenamento.salvar(
            destino, arquivo, content_type=arquivo.content_type or ""
        )
        registro.save(update_fields=["arquivo"])
        return Response(_arquivo(registro), status=201)


def _arquivo_do_tenant(request: Request, pk: int) -> ArquivoProposta:
    return get_object_or_404(ArquivoProposta.objects.filter(tenant=tenant_atual(request)), pk=pk)


class ArquivoView(APIView):
    def delete(self, request: Request, pk: int) -> Response:
        arquivo = _arquivo_do_tenant(request, pk)
        try:
            _armazenamento(request).remover(arquivo.arquivo)
        except ErroArmazenamento:
            pass  # o registro sai do mesmo jeito; o arquivo órfão não aparece em lugar nenhum
        arquivo.delete()
        return Response(status=204)


class ArquivoDownloadView(APIView):
    """URL assinada em JSON, como em `apps.documentos` — o bucket nunca é
    público."""

    def get(self, request: Request, pk: int) -> Response:
        arquivo = _arquivo_do_tenant(request, pk)
        try:
            url = _armazenamento(request).url_temporaria(arquivo.arquivo)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)
        return Response({"url": url, "nome": arquivo.nome_original})


# ---------- o modelo Word ----------


def _modelo(modelo: ModeloProposta | None) -> dict:
    if modelo is None:
        return {"padrao": True, "nome": "Modelo padrão do sistema", "enviado_por": None, "enviado_em": None}
    return {
        "padrao": False,
        "nome": modelo.nome_original,
        "enviado_por": modelo.enviado_por_nome or None,
        "enviado_em": modelo.enviado_em,
    }


class ModeloView(APIView):
    def get(self, request: Request) -> Response:
        return Response(_modelo(ModeloProposta.objects.filter(tenant=tenant_atual(request)).first()))

    def post(self, request: Request) -> Response:
        arquivo = request.FILES.get("arquivo")
        if arquivo is None or not arquivo.name.lower().endswith(".docx"):
            return Response({"detail": "O modelo precisa ser um arquivo Word (.docx)."}, status=400)

        from docxtpl import DocxTemplate

        try:
            DocxTemplate(arquivo).get_undeclared_template_variables()
        except Exception as erro:
            return Response(
                {"detail": f"O modelo tem um campo mal escrito: {erro}"}, status=400
            )
        arquivo.seek(0)

        tenant = tenant_atual(request)
        try:
            armazenamento = armazenamento_do_tenant(tenant)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)
        gravado = armazenamento.salvar(
            caminho(tenant, "propostas", "modelo.docx"), arquivo, content_type=DOCX
        )
        modelo, _ = ModeloProposta.objects.update_or_create(
            tenant=tenant,
            defaults={
                "arquivo": gravado,
                "nome_original": arquivo.name,
                "enviado_por_nome": _nome(request),
            },
        )
        return Response(_modelo(modelo), status=201)

    def delete(self, request: Request) -> Response:
        """Volta para o modelo padrão."""

        ModeloProposta.objects.filter(tenant=tenant_atual(request)).delete()
        return Response(_modelo(None))


class ModeloDownloadView(APIView):
    """O Word do modelo em uso, para a equipe ver os campos e montar o seu."""

    def get(self, request: Request) -> HttpResponse:
        try:
            lido = _ler_modelo(request)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=503)
        conteudo = lido.getvalue() if lido else MODELO_PADRAO.read_bytes()
        resposta = HttpResponse(conteudo, content_type=DOCX)
        resposta["Content-Disposition"] = 'attachment; filename="Modelo de proposta.docx"'
        resposta["Access-Control-Expose-Headers"] = "Content-Disposition"
        return resposta
