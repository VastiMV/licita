"""Endpoints da configuração de armazenamento.

Só `is_staff` mexe aqui. O produto ainda não tem papéis de acesso (ver
`apps/accounts/models.py`), e `is_staff` é o único recorte que já existe —
trocar por um papel de verdade depois é mudar esta linha. Configuração de
bucket não é coisa para todo usuário logado: quem a troca redireciona para
onde vão os documentos da empresa.
"""

from __future__ import annotations

from django.http import FileResponse
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.atual import tenant_atual

from .base import ErroArmazenamento
from .drivers.local import ArmazenamentoLocal, caminho_do_token
from .models import ConfigArmazenamento
from .serializers import ConfigEscritaSerializer, ConfigLeituraSerializer, drivers_instalados
from .servico import config_do_tenant, testar


class DriversView(APIView):
    """`GET /api/armazenamento/drivers/` — o que está instalado e quais
    campos cada um precisa.

    A tela monta o seletor e o formulário a partir disto. Driver novo
    instalado como pacote aparece aqui sem uma linha de frontend."""

    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        return Response(drivers_instalados())


class ConfigView(APIView):
    """`GET/PUT /api/armazenamento/config/`."""

    permission_classes = [IsAdminUser]

    def get(self, request: Request) -> Response:
        config = config_do_tenant(tenant_atual(request))
        if config is None:
            # 200 com nulo, e não 404: "ainda não configurado" é um estado
            # normal da tela, não um erro de rota.
            return Response(None)
        return Response(ConfigLeituraSerializer(config).data)

    def put(self, request: Request) -> Response:
        tenant = tenant_atual(request)
        entrada = ConfigEscritaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data

        config, _ = ConfigArmazenamento.objects.get_or_create(tenant=tenant, defaults={"driver": dados["driver"]})
        trocou_de_driver = config.driver != dados["driver"]

        config.driver = dados["driver"]
        config.opcoes = dados.get("opcoes", {})
        config.definir_segredos(dados.get("segredos", {}))
        if trocou_de_driver:
            config.limpar_segredos_de_outro_driver()
            # O teste anterior valia para o driver anterior.
            config.testado_em = None
        config.atualizado_por = request.user if request.user.is_authenticated else None
        config.save()

        return Response(ConfigLeituraSerializer(config).data)


class TestarView(APIView):
    """`POST /api/armazenamento/testar/` — grava um byte, lê, confere, apaga.

    Responde 200 `{ok: true}` ou 400 com a mensagem do provedor já
    traduzida (ver `drivers/s3.py`) — é o texto que a tela mostra.
    """

    permission_classes = [IsAdminUser]

    def post(self, request: Request) -> Response:
        config = config_do_tenant(tenant_atual(request))
        if config is None:
            return Response({"ok": False, "erro": "Nada configurado ainda."}, status=400)

        try:
            testar(config)
        except ErroArmazenamento as erro:
            return Response({"ok": False, "erro": str(erro)}, status=400)
        return Response({"ok": True})


class DownloadLocalView(APIView):
    """`GET /api/armazenamento/local/<token>/` — serve o arquivo do driver
    `local`, e só dele.

    Existe para que o driver de desenvolvimento cumpra a mesma promessa do
    bucket: link assinado que expira. Os drivers de nuvem não passam por
    aqui — a URL deles é assinada pelo próprio provedor e o arquivo nunca
    trafega pelo backend.
    """

    def get(self, request: Request, token: str) -> Response:
        config = config_do_tenant(tenant_atual(request))
        if config is None or config.driver != ArmazenamentoLocal.CHAVE:
            return Response({"detail": "Link de download inválido."}, status=404)

        try:
            caminho = caminho_do_token(token)
            return FileResponse(config.instanciar().abrir(caminho), as_attachment=True)
        except ErroArmazenamento as erro:
            return Response({"detail": str(erro)}, status=404)
