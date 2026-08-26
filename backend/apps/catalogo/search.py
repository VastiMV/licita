"""Busca no catálogo local de PDM — camadas 1 (produto) e 2 (categoria) da
busca textual (ver docs/DOMINIO.md, seção "Busca textual — camadas").

Puramente determinístico: `TrigramSimilarity` (extensão `pg_trgm` do
Postgres) ranqueia linhas que já existem na tabela — nunca gera nem inventa
nada. Cobre erro de digitação/variação do nome do produto (camada 1,
`nome_normalizado`) e busca por categoria quando o termo não bate com nome de
produto nenhum, só com a classe/grupo oficial do governo (camada 2,
`nome_classe_normalizado`/`nome_grupo_normalizado`).
"""

from __future__ import annotations

from django.contrib.postgres.search import TrigramSimilarity
from django.db.models.functions import Greatest

from apps.integracoes.clients.compras_gov import normalizar

from .models import Pdm

LIMITE_PADRAO = 30

# Abaixo disso, a similaridade é ruído (termos sem nenhuma raiz em comum) —
# melhor devolver vazio (e cair para o modo navegação) do que lixo.
SIMILARIDADE_MINIMA = 0.25


def buscar_pdms(termo: str, limite: int = LIMITE_PADRAO) -> list[Pdm]:
    """PDMs cujo nome de produto OU categoria (classe/grupo) casa com o termo."""

    alvo = normalizar(termo)
    if not alvo:
        return []

    return list(
        Pdm.objects.annotate(
            similaridade=Greatest(
                TrigramSimilarity("nome_normalizado", alvo),
                TrigramSimilarity("nome_grupo_normalizado", alvo),
                TrigramSimilarity("nome_classe_normalizado", alvo),
            )
        )
        .filter(similaridade__gte=SIMILARIDADE_MINIMA)
        .order_by("-similaridade", "nome_pdm")[:limite]
    )
