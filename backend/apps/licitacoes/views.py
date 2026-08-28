"""`GET /api/licitacoes/oportunidades/` — busca de oportunidades ao vivo, não
persiste (ver docs/DOMINIO.md). Parâmetros batem 1:1 com
`OportunidadeBuscaParams` no frontend
(`frontend/src/app/contracts/licitacoes/oportunidade.contracts.ts`).
"""

from __future__ import annotations

import datetime as dt

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.capag.lookup import nota_para
from apps.catalogo.search import buscar_pdms
from apps.integracoes.clients.compras_gov import ComprasGovClientError
from apps.integracoes.clients.pncp import PncpClient, PncpClientError
from apps.integracoes.plataformas import identificar_plataforma, plataforma_padrao

from .serializers import CompraDetalheSerializer, OportunidadeSerializer
from .services import BuscaSemCorrespondenciaNoCatalogo, buscar_oportunidades

# Mesma janela padrão do protótipo (`app/routers/licitacoes.py`) para o modo
# interativo — diferente do lookback de 2 dias usado pelo scanner de
# `Filtro`/`Alerta` (que roda com muito mais frequência).
JANELA_PADRAO_DIAS = 30


class OportunidadesView(APIView):
    def get(self, request: Request) -> Response:
        params = request.query_params

        hoje = dt.date.today()
        data_final = params.get("data_final") or hoje.isoformat()
        data_inicial = (
            params.get("data_inicial") or (hoje - dt.timedelta(days=JANELA_PADRAO_DIAS)).isoformat()
        )
        palavra_chave = (params.get("palavra_chave") or "").strip()
        uf = params.get("uf") or None
        codigo_unidade = params.get("codigo_unidade") or None
        modalidade = params.get("modalidade") or ""

        # Resolvido ANTES de chamar a orquestração — camadas 1+2 da busca
        # textual (ver apps/catalogo/search.py e docs/DOMINIO.md). Só entra
        # em jogo se o PNCP (camada preferida, dentro de services.py) falhar
        # ou não achar nada.
        codigos_pdm = [p.codigo_pdm for p in buscar_pdms(palavra_chave)] if palavra_chave else None

        try:
            # O client de navegação/fallback vem do registro de plataformas
            # (`apps/integracoes/plataformas.py`) — é lá que uma plataforma
            # nova entra, não aqui.
            with plataforma_padrao().criar_client() as client:
                resultados = buscar_oportunidades(
                    client,
                    data_inicial=data_inicial,
                    data_final=data_final,
                    codigo_modalidade=modalidade,
                    palavra_chave=palavra_chave,
                    codigos_pdm=codigos_pdm,
                    uf=uf,
                    codigo_unidade=codigo_unidade,
                )
        except BuscaSemCorrespondenciaNoCatalogo:
            # Não é erro — nem PNCP nem catálogo acharam nada para o termo.
            # Frontend trata lista vazia como "sem resultados", não como falha.
            resultados = []
        except ComprasGovClientError as exc:
            return Response({"detail": str(exc)}, status=502)

        serializer = OportunidadeSerializer(resultados, many=True)
        return Response(serializer.data)


class CompraDetalheView(APIView):
    """`GET /api/licitacoes/compras/<cnpj>/<ano>/<sequencial>/detalhe/` —
    documentos do edital (com link de download direto), selo CAPAG e a
    plataforma de origem de uma compra específica.

    Uma chamada por card, disparada pelo frontend quando o resultado da busca
    chega — nunca N chamadas dentro da própria busca (não queremos voltar à
    lentidão já corrigida, ver docs/DOMINIO.md).
    """

    def get(self, request: Request, cnpj: str, ano: int, sequencial: int) -> Response:
        capag = None
        documentos: list[dict] = []
        plataforma = None

        with PncpClient() as client:
            try:
                detalhe = client.detalhar_compra(cnpj=cnpj, ano=ano, sequencial=sequencial)
            except PncpClientError:
                detalhe = None
            if detalhe:
                capag = nota_para(
                    esfera_id=detalhe.get("esfera_id"),
                    codigo_ibge=detalhe.get("codigo_ibge"),
                    uf=detalhe.get("uf"),
                )
                # O link de origem é a resposta definitiva de "em qual
                # plataforma essa compra acontece" — corrige o palpite da
                # busca (ver `services._montar_oportunidade`). Plataforma não
                # registrada ainda assim tem link e nome (os que o PNCP deu);
                # só fica sem `id` (logo, sem ícone próprio no frontend).
                link_plataforma = detalhe.get("link_plataforma")
                if link_plataforma:
                    conhecida = identificar_plataforma(link_plataforma)
                    plataforma = {
                        "id": conhecida.id if conhecida else None,
                        "nome": conhecida.nome if conhecida else detalhe.get("plataforma_nome"),
                        "link": link_plataforma,
                    }

            try:
                documentos = client.listar_arquivos(cnpj=cnpj, ano=ano, sequencial=sequencial)
            except PncpClientError:
                documentos = []

        serializer = CompraDetalheSerializer(
            {"documentos": documentos, "capag": capag, "plataforma": plataforma}
        )
        return Response(serializer.data)
