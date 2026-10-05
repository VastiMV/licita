"""Propostas — a etapa depois do Cotador.

Por enquanto só existe o **gerar**: o botão "Gerar proposta" do Cotador cria
o registro, e é ele que move a licitação de etapa (a etapa é calculada, ver
`apps.licitacoes.ciclo`): sai do Cotador e aparece na coluna Proposta do
quadro. A tela de Propostas ainda não existe; quando existir, é aqui que a
proposta ganha o resto (envio, documentos, lances).

Uma por oportunidade, como a cotação. O valor é gravado no momento de gerar:
mexer na cotação depois não muda o que foi proposto.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models


class Proposta(models.Model):
    oportunidade = models.OneToOneField(
        "licitacoes.OportunidadeSalva",
        verbose_name="oportunidade salva",
        related_name="proposta",
        on_delete=models.CASCADE,
    )
    valor = models.DecimalField(
        "valor proposto",
        max_digits=16,
        decimal_places=2,
        help_text="O valor cotado no momento de gerar.",
    )
    gerada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="gerada por",
        related_name="propostas_geradas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    gerada_por_nome = models.CharField("gerada por (nome)", max_length=150, blank=True)
    gerada_em = models.DateTimeField("gerada em", auto_now_add=True)

    class Meta:
        verbose_name = "proposta"
        verbose_name_plural = "propostas"

    def __str__(self) -> str:
        return f"Proposta de {self.oportunidade}"
