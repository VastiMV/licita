"""Índice local do catálogo de materiais (PDM) do compras.gov.br.

Por que existe: a API não oferece busca textual utilizável sobre o catálogo.
O filtro `descricaoItem` devolve zero resultados para qualquer termo parcial
(ver docs/DOMINIO.md). Mas a lista de PDMs (Padrão Descritivo de Material —
os nomes de produto, como "CAFÉ", "TINTA IMPRESSORA", "TESOURA") tem ~20 mil
registros e a API aceita páginas de até 500 — baixamos uma vez (`apps.catalogo.sync`)
e pesquisamos aqui, o que deixa a busca por nome instantânea e independente da
API (ver `apps.catalogo.search`).
"""

from __future__ import annotations

from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Pdm(models.Model):
    """Um produto do catálogo oficial (PDM), com sua categoria (classe/grupo).

    Tabela única, denormalizada de propósito — sem `Grupo`/`Classe` como
    tabelas à parte. Em ~20 mil linhas, JOIN não compensa o ganho de
    normalização, e a busca interativa fica mais rápida lendo uma tabela só.
    Ver docs/DOMINIO.md, seção "Busca textual — camadas", para o porquê dos
    três índices trigram (produto e categoria são buscados do mesmo jeito).
    """

    codigo_pdm = models.IntegerField(primary_key=True)
    nome_pdm = models.CharField(max_length=255)
    # Caixa alta, sem acento — o que a busca por similaridade casa (camada 1).
    nome_normalizado = models.CharField(max_length=255)

    codigo_classe = models.IntegerField(null=True, blank=True, db_index=True)
    nome_classe = models.CharField(max_length=255, null=True, blank=True)
    nome_classe_normalizado = models.CharField(max_length=255, null=True, blank=True)

    codigo_grupo = models.IntegerField(null=True, blank=True, db_index=True)
    nome_grupo = models.CharField(max_length=255, null=True, blank=True)
    nome_grupo_normalizado = models.CharField(max_length=255, null=True, blank=True)

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "PDM"
        verbose_name_plural = "PDMs"
        ordering = ["nome_pdm"]
        indexes = [
            GinIndex(fields=["nome_normalizado"], name="pdm_nome_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(
                fields=["nome_grupo_normalizado"], name="pdm_grupo_trgm", opclasses=["gin_trgm_ops"]
            ),
            GinIndex(
                fields=["nome_classe_normalizado"], name="pdm_classe_trgm", opclasses=["gin_trgm_ops"]
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo_pdm} — {self.nome_pdm}"
