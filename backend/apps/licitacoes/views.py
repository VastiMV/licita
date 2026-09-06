"""Endpoints do app de licitações.

**Busca** (`OportunidadesView`, `CompraDetalheView`): consulta ao vivo, não
persiste (ver docs/DOMINIO.md). Parâmetros batem 1:1 com
`OportunidadeBuscaParams` no frontend
(`frontend/src/app/contracts/licitacoes/oportunidade.contracts.ts`).

**Oportunidades salvas** (`OportunidadesSalvasView` e as demais no fim do
arquivo): a lista que a equipe monta a partir da busca — persiste, com
histórico. Ver `models.py` para as duas decisões que moldam essas views (a
lista é compartilhada por todos os usuários; remover é lógico, para o log
sobreviver).
"""

from __future__ import annotations

import datetime as dt

from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.capag.lookup import nota_para
from apps.catalogo.search import buscar_pdms
from apps.integracoes.clients.compras_gov import ComprasGovClientError
from apps.integracoes.clients.pncp import PncpClient, PncpClientError
from apps.integracoes.plataformas import identificar_plataforma, plataforma_padrao

from .models import Cotacao, OportunidadeSalva, registrar_prazos_vencidos
from .salvas import garantir_salva
from .serializers import (
    CompraDetalheSerializer,
    CotacaoSerializer,
    EventoOportunidadeSalvaSerializer,
    OportunidadeSalvaSerializer,
    OportunidadeSerializer,
)
from .services import (
    BuscaSemCorrespondenciaNoCatalogo,
    buscar_oportunidades,
    detalhar_compra_cacheada,
)

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

        _resolver_capag(resultados)
        serializer = OportunidadeSerializer(resultados, many=True)
        return Response(serializer.data)


def _resolver_capag(resultados: list[dict]) -> None:
    """Preenche `capag` nas oportunidades cujos insumos (esfera + IBGE) a
    busca já trouxe — o caminho da busca textual os pega do mesmo detalhe
    que filtra a plataforma, de graça. Importa porque o `/api/consulta/` do
    PNCP tem rate limit por IP (ver docs/DOMINIO.md, 28/08/2026): a chamada
    de detalhe do card, disparada logo após a busca, leva 429 — se o selo
    dependesse só dela, sumiria. Nos caminhos sem insumos (navegação/PDM),
    `capag` fica nulo e o detalhe do card continua sendo quem resolve.

    Resolve aqui, e não em services, porque a nota vem do banco
    (`apps.capag`) e a orquestração de busca é deliberadamente sem banco.
    """

    memo: dict[tuple, dict | None] = {}
    for op in resultados:
        chave = (op.get("capag_esfera_id"), op.get("capag_codigo_ibge"), op.get("contratacao_uf"))
        if chave not in memo:
            memo[chave] = nota_para(esfera_id=chave[0], codigo_ibge=chave[1], uf=chave[2])
        op["capag"] = memo[chave]


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
                # Cacheado: a busca que gerou este card provavelmente acabou
                # de detalhar esta mesma compra — e o /api/consulta/ tem rate
                # limit por IP que a rajada dela consome (ver services).
                detalhe = detalhar_compra_cacheada(
                    client, cnpj=cnpj, ano=ano, sequencial=sequencial
                )
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


class OportunidadesSalvasPaginacao(PageNumberPagination):
    """Paginação só desta lista (o resto da API não é paginado). Página
    pequena porque a tabela do frontend é o consumidor — quem quiser mais
    pede `page_size`."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# Colunas ordenáveis da tabela do frontend -> campo real. Whitelist, não
# `OrderingFilter` aberto: o nome da coluna é contrato de tela, e ordenar por
# um campo interno (`texto_busca`, `itens`) não faz sentido nenhum. O objeto
# do edital não está aqui porque saiu da tabela — continua sendo o texto que
# a busca varre (`texto_busca`), só não é coluna.
ORDENACOES = {
    "uasg": "uasg",
    "modalidade": "modalidade",
    "cidade": "municipio",
    "data_publicacao": "data_publicacao",
    "prazo": "data_encerramento_proposta",
    "valor": "valor_total_estimado",
    "criada_em": "criada_em",
}
ORDENACAO_PADRAO = "-criada_em"


def _ordenacao(pedida: str | None) -> str:
    """Traduz `ordering=-prazo` (nome de coluna) para o campo do model.
    Coluna desconhecida cai no padrão em vez de estourar 400 — ordenação é
    preferência de exibição, não parâmetro crítico."""

    pedida = (pedida or "").strip()
    descendente = pedida.startswith("-")
    campo = ORDENACOES.get(pedida.lstrip("-"))
    if not campo:
        return ORDENACAO_PADRAO
    return f"-{campo}" if descendente else campo


class OportunidadesSalvasView(APIView):
    """`GET/POST /api/licitacoes/salvas/`.

    A lista é da equipe inteira, não do usuário logado (decisão de produto —
    ver docstring de `models.py`): não há filtro por dono nem no GET nem no
    DELETE.
    """

    def get(self, request: Request) -> Response:
        # O log ganha a linha "prazo encerrado" no momento em que alguém
        # abre a lista — ver `registrar_prazos_vencidos` para o porquê de
        # não haver task periódica.
        registrar_prazos_vencidos()

        salvas = (
            OportunidadeSalva.objects.ativas()
            .select_related("salva_por")
            .buscar(request.query_params.get("busca", ""))
            .order_by(_ordenacao(request.query_params.get("ordering")))
        )

        paginacao = OportunidadesSalvasPaginacao()
        pagina = paginacao.paginate_queryset(salvas, request, view=self)
        resposta = paginacao.get_paginated_response(
            OportunidadeSalvaSerializer(pagina, many=True).data
        )
        # Contagem do conjunto inteiro, não da página nem da busca em curso:
        # é o número do aviso "N oportunidades sem prazo para proposta" e o
        # que o link de apagar do aviso vai remover.
        resposta.data["expiradas"] = OportunidadeSalva.objects.ativas().expiradas().count()
        return resposta

    def post(self, request: Request) -> Response:
        # Idempotente (salvar de novo devolve o registro existente, sem
        # evento novo) — a regra mora em `salvas.garantir_salva`, porque o
        # Cotador também salva a oportunidade por esse mesmo caminho.
        salva, criada = garantir_salva(request.data, request=request)
        return Response(
            OportunidadeSalvaSerializer(salva).data, status=201 if criada else 200
        )


class OportunidadeSalvaView(APIView):
    """`DELETE /api/licitacoes/salvas/<id>/` — tira da lista. Remoção lógica:
    o histórico continua existindo (ver `models.OportunidadeSalva.remover`)."""

    def delete(self, request: Request, pk: int) -> Response:
        salva = get_object_or_404(OportunidadeSalva.objects.ativas(), pk=pk)
        salva.remover(por=request.user)
        return Response(status=204)


class OportunidadesSalvasExpiradasView(APIView):
    """`DELETE /api/licitacoes/salvas/expiradas/` — remove de uma vez todas
    as que perderam o prazo de proposta. É o link do aviso que a tela mostra
    ao abrir."""

    def delete(self, request: Request) -> Response:
        expiradas = list(OportunidadeSalva.objects.ativas().expiradas())
        for salva in expiradas:
            salva.remover(por=request.user)
        return Response({"removidas": len(expiradas)})


class OportunidadesSalvasChavesView(APIView):
    """`GET /api/licitacoes/salvas/chaves/` — só as chaves (`cnpj-ano-seq`)
    das que estão na lista.

    Existe para a tela de busca saber quais cards já estão salvos sem baixar
    a lista inteira (e sem lidar com a paginação dela) — salvar não é mais um
    toggle: o que já está salvo só sai pelo módulo de salvas.
    """

    def get(self, request: Request) -> Response:
        chaves = [
            f"{cnpj}-{ano}-{seq}"
            for cnpj, ano, seq in OportunidadeSalva.objects.ativas().values_list(
                "cnpj_orgao", "ano_compra", "sequencial_compra"
            )
        ]
        return Response({"chaves": chaves})


class OportunidadeSalvaEventosView(APIView):
    """`GET /api/licitacoes/salvas/<id>/eventos/` — o histórico de uma
    oportunidade salva: o registro principal (o que foi salvo, por quem,
    quando) e a lista do que aconteceu depois, em ordem.

    O módulo de tela que lê isso ainda não existe (ver docs/DOMINIO.md,
    "Histórico da oportunidade salva"); o endpoint existe porque o log já é
    escrito — inclusive para oportunidades removidas, que continuam
    consultáveis por aqui.
    """

    def get(self, request: Request, pk: int) -> Response:
        salva = get_object_or_404(OportunidadeSalva, pk=pk)
        eventos = salva.eventos.select_related("autor")
        return Response(
            {
                "id": salva.id,
                "chave": salva.chave,
                "resumo": salva.resumo,
                "salva_por": (salva.salva_por.nome or salva.salva_por.email)
                if salva.salva_por
                else None,
                "criada_em": salva.criada_em,
                "removida_em": salva.removida_em,
                "eventos": EventoOportunidadeSalvaSerializer(eventos, many=True).data,
            }
        )


class OportunidadeSalvaCotacaoView(APIView):
    """A cotação de uma oportunidade salva — o Cotador gravado.

    `PUT` cria ou sobrescreve (é um-para-um, ver `Cotacao`), então o
    frontend não precisa saber se já existia: manda o estado da tela e
    pronto. `GET` devolve 404 quando a oportunidade ainda não foi cotada —
    é o que diz à tela para abrir com os valores padrão.

    Só oportunidades **ativas** aceitam cotação: cotar algo que a equipe já
    tirou da lista não faz sentido, e deixaria uma cotação órfã de uma
    oportunidade que ninguém mais vê.
    """

    def get(self, request: Request, pk: int) -> Response:
        salva = get_object_or_404(OportunidadeSalva.objects.ativas(), pk=pk)
        cotacao = get_object_or_404(Cotacao, oportunidade=salva)
        return Response(CotacaoSerializer(cotacao).data)

    def put(self, request: Request, pk: int) -> Response:
        salva = get_object_or_404(OportunidadeSalva.objects.ativas(), pk=pk)
        cotacao = Cotacao.objects.filter(oportunidade=salva).first()

        serializer = CotacaoSerializer(cotacao, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            oportunidade=salva,
            atualizada_por=request.user if request.user.is_authenticated else None,
        )

        return Response(serializer.data, status=200 if cotacao else 201)

    def delete(self, request: Request, pk: int) -> Response:
        salva = get_object_or_404(OportunidadeSalva.objects.ativas(), pk=pk)
        Cotacao.objects.filter(oportunidade=salva).delete()
        return Response(status=204)
