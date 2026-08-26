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

from apps.catalogo.search import buscar_pdms
from apps.integracoes.clients.compras_gov import ComprasGovClient, ComprasGovClientError

from .serializers import OportunidadeSerializer
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
            with ComprasGovClient() as client:
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
