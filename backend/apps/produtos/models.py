"""Produtos — Fabricante › Marca › Modelo, a afinidade com fornecedores e a
tabela de preços.

**O produto é o modelo.** Não há entidade "produto" acima: o que se cota é
um modelo de uma marca de um fabricante (Jaguaribe › Prolife › CR-40).

**Não duplicar é regra do banco.** O nome é comparado normalizado (caixa
alta, sem acento, espaços colapsados):

- fabricante é único no cadastro inteiro — se outro fornecedor também
  vende a Jaguaribe, é a mesma Jaguaribe com mais um fornecedor na
  afinidade, nunca uma segunda;
- marca é única dentro do fabricante (a mesma marca em outro fabricante é
  outro produto);
- modelo é único dentro da marca.

**Afinidade é por fabricante.** O fornecedor que vende um fabricante vende
todas as marcas e modelos dele. O Cotador usa isso para sugerir primeiro
os fabricantes do fornecedor escolhido — e aprende: salvar uma cotação com
um fornecedor e um fabricante grava a afinidade.

**Preço tem histórico.** Cada custo cotado para (fornecedor, modelo) vira
uma linha de `PrecoFornecedor`; a sugestão da próxima cotação é a mais
recente.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models


def normalizar_nome(nome: str) -> str:
    from apps.integracoes.clients.compras_gov import normalizar

    return " ".join(normalizar(nome or "").split())


class ComNomeNormalizado(models.Model):
    nome = models.CharField("nome", max_length=150)
    nome_normalizado = models.CharField(
        "nome normalizado",
        max_length=150,
        editable=False,
        help_text="Caixa alta e sem acento — é por ele que se detecta duplicata.",
    )
    criado_por_nome = models.CharField("cadastrado por (nome)", max_length=150, blank=True)
    criado_em = models.DateTimeField("cadastrado em", auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ["nome"]

    def save(self, *args, **kwargs):
        self.nome = " ".join((self.nome or "").split())
        self.nome_normalizado = normalizar_nome(self.nome)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.nome


class Fabricante(ComNomeNormalizado):
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="cadastrado por",
        related_name="fabricantes_cadastrados",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    fornecedores = models.ManyToManyField(
        "fornecedores.Fornecedor",
        verbose_name="fornecedores",
        related_name="fabricantes",
        blank=True,
        help_text="Afinidade: quem vende este fabricante (e todas as marcas e modelos dele).",
    )

    class Meta(ComNomeNormalizado.Meta):
        verbose_name = "fabricante"
        verbose_name_plural = "fabricantes"
        constraints = [
            models.UniqueConstraint(fields=["nome_normalizado"], name="fabricante_nome_unico")
        ]


class Marca(ComNomeNormalizado):
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="cadastrado por",
        related_name="marcas_cadastradas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    fabricante = models.ForeignKey(
        Fabricante, verbose_name="fabricante", related_name="marcas", on_delete=models.CASCADE
    )

    class Meta(ComNomeNormalizado.Meta):
        verbose_name = "marca"
        verbose_name_plural = "marcas"
        constraints = [
            models.UniqueConstraint(
                fields=["fabricante", "nome_normalizado"], name="marca_nome_unico_no_fabricante"
            )
        ]


class Modelo(ComNomeNormalizado):
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="cadastrado por",
        related_name="modelos_cadastrados",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    marca = models.ForeignKey(
        Marca, verbose_name="marca", related_name="modelos", on_delete=models.CASCADE
    )

    class Meta(ComNomeNormalizado.Meta):
        verbose_name = "modelo"
        verbose_name_plural = "modelos"
        constraints = [
            models.UniqueConstraint(
                fields=["marca", "nome_normalizado"], name="modelo_nome_unico_na_marca"
            )
        ]


class PrecoFornecedor(models.Model):
    """Um custo que um fornecedor deu para um modelo, numa cotação. A
    sugestão da próxima cotação é a linha mais recente do par."""

    fornecedor = models.ForeignKey(
        "fornecedores.Fornecedor",
        verbose_name="fornecedor",
        related_name="precos",
        on_delete=models.CASCADE,
    )
    modelo = models.ForeignKey(
        Modelo, verbose_name="modelo", related_name="precos", on_delete=models.CASCADE
    )
    custo = models.DecimalField("custo do produto (un.)", max_digits=16, decimal_places=4)
    cotacao = models.ForeignKey(
        "cotador.Cotacao",
        verbose_name="cotação",
        related_name="precos_registrados",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="registrado por",
        related_name="precos_registrados",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    registrado_por_nome = models.CharField("registrado por (nome)", max_length=150, blank=True)
    registrado_em = models.DateTimeField("registrado em", auto_now_add=True)

    class Meta:
        verbose_name = "preço de fornecedor"
        verbose_name_plural = "tabela de preços"
        ordering = ["-registrado_em", "-id"]
        indexes = [models.Index(fields=["fornecedor", "modelo", "-registrado_em"])]
