"""Nota CAPAG (Capacidade de Pagamento) de municípios e estados.

CAPAG é uma classificação do Tesouro Nacional da saúde fiscal de entes
subnacionais — usada aqui só como selo informativo no card de oportunidade
(ver apps/licitacoes). Não existe por órgão: é por ente (município OU
estado, conforme a esfera da compra — ver apps/capag/lookup.py).

Publicada só como arquivo estático (XLSX/CSV), atualizado ~3x/ano — não é
uma API. `apps/capag/sync.py` baixa e grava aqui; ver esse módulo para de
onde vêm as colunas.
"""

from __future__ import annotations

from django.db import models


class MunicipioCapag(models.Model):
    """Nota CAPAG de um município, pelo código IBGE (mesmo que o PNCP devolve
    em `unidadeOrgao.codigoIbge` — ver apps/integracoes/clients/pncp.py)."""

    codigo_ibge = models.IntegerField(primary_key=True)
    nome_municipio = models.CharField(max_length=255)
    uf = models.CharField(max_length=2)
    nota = models.CharField(max_length=2)  # escala do Tesouro: A+ A B+ B C D

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Município (CAPAG)"
        verbose_name_plural = "Municípios (CAPAG)"
        ordering = ["nome_municipio"]

    def __str__(self) -> str:
        return f"{self.nome_municipio}/{self.uf} — {self.nota}"


class EstadoCapag(models.Model):
    """Nota CAPAG de um estado, pela sigla da UF."""

    uf = models.CharField(max_length=2, primary_key=True)
    nota = models.CharField(max_length=2)  # mesma escala de MunicipioCapag

    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Estado (CAPAG)"
        verbose_name_plural = "Estados (CAPAG)"
        ordering = ["uf"]

    def __str__(self) -> str:
        return f"{self.uf} — {self.nota}"
