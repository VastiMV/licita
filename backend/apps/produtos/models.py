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

from decimal import Decimal

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


class OrigemPreco(models.TextChoices):
    MANUAL = "manual", "Registrado à mão"
    COTADOR = "cotador", "Aprendido no Cotador"


class PrecoFornecedorQuerySet(models.QuerySet):
    def buscar(self, termo: str) -> "PrecoFornecedorQuerySet":
        """"Onde eu tenho preço de caneta?" — a descrição livre e os nomes do
        produto cadastrado (fabricante, marca, modelo), comparados
        normalizados: "canéta" acha "CANETA"."""

        termo = normalizar_nome(termo)
        if not termo:
            return self
        return self.filter(
            models.Q(descricao_normalizada__contains=termo)
            | models.Q(modelo__nome_normalizado__contains=termo)
            | models.Q(modelo__marca__nome_normalizado__contains=termo)
            | models.Q(modelo__marca__fabricante__nome_normalizado__contains=termo)
        )

    def atuais(self) -> "PrecoFornecedorQuerySet":
        """Só a linha mais recente de cada oferta — mesmo fornecedor, mesmo
        produto, mesma embalagem. O preço antigo continua no banco (é o
        histórico), mas não aparece duas vezes na lista."""

        chave = ["fornecedor_id", "modelo_id", "descricao_normalizada", "quantidade_embalagem"]
        recentes = (
            self.model.objects.order_by(*chave, "-registrado_em", "-id")
            .distinct(*chave)
            .values("id")
        )
        return self.filter(id__in=models.Subquery(recentes))


class PrecoFornecedor(models.Model):
    """Por quanto um fornecedor **me vende** um produto — o lado
    fornecedor → empresa. Não confundir com o Cotador, que é o lado
    empresa → órgão público (por quanto eu vendo).

    Nasce de dois jeitos (`origem`): registrado à mão, na hora em que o
    fornecedor passa o preço ("caixa com 10 canetas a R$ 34"), ou aprendido
    ao salvar uma cotação que usou esse fornecedor.

    **O produto pode ser só uma descrição.** No telefone ninguém sabe o
    fabricante — "caneta esferográfica azul" basta. Quando o produto já está
    no cadastro (`modelo`), a descrição é opcional.

    **O preço é da embalagem; o custo é da unidade.** O fornecedor fala em
    caixa, o edital fala em unidade. `custo` é sempre o unitário
    (`preco_embalagem / quantidade_embalagem`) — é o número que o Cotador
    usa e o que a busca ordena.

    **Preço tem histórico.** Mudou o preço, entra uma linha nova; a lista
    mostra a mais recente (`atuais()`).
    """

    fornecedor = models.ForeignKey(
        "fornecedores.Fornecedor",
        verbose_name="fornecedor",
        related_name="precos",
        on_delete=models.CASCADE,
    )
    modelo = models.ForeignKey(
        Modelo,
        verbose_name="modelo",
        related_name="precos",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    descricao = models.CharField(
        "produto",
        max_length=255,
        blank=True,
        help_text="Como o fornecedor chama o produto. Ex.: Caneta esferográfica azul.",
    )
    descricao_normalizada = models.CharField(max_length=255, blank=True, editable=False)

    embalagem = models.CharField(
        "embalagem", max_length=40, default="Unidade", help_text="Caixa, pacote, resma…"
    )
    quantidade_embalagem = models.PositiveIntegerField("unidades por embalagem", default=1)
    preco_embalagem = models.DecimalField(
        "preço da embalagem", max_digits=16, decimal_places=4, null=True, blank=True
    )
    custo = models.DecimalField("custo do produto (un.)", max_digits=16, decimal_places=4)
    observacoes = models.CharField("observações", max_length=255, blank=True)

    origem = models.CharField(
        "origem", max_length=10, choices=OrigemPreco.choices, default=OrigemPreco.MANUAL
    )
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

    objects = PrecoFornecedorQuerySet.as_manager()

    class Meta:
        verbose_name = "preço de fornecedor"
        verbose_name_plural = "tabela de preços"
        ordering = ["-registrado_em", "-id"]
        indexes = [models.Index(fields=["fornecedor", "modelo", "-registrado_em"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(modelo__isnull=False) | ~models.Q(descricao=""),
                name="preco_tem_produto",
            )
        ]

    def save(self, *args, **kwargs):
        self.descricao = " ".join((self.descricao or "").split())
        self.descricao_normalizada = normalizar_nome(self.descricao)
        if self.preco_embalagem is None:
            self.preco_embalagem = self.custo * self.quantidade_embalagem
        else:
            self.custo = (self.preco_embalagem / self.quantidade_embalagem).quantize(
                Decimal("0.0001")
            )
        if self.registrado_por and not self.registrado_por_nome:
            self.registrado_por_nome = (
                getattr(self.registrado_por, "nome", "") or self.registrado_por.email
            )
        super().save(*args, **kwargs)

    @property
    def produto(self) -> str:
        """O nome que a tela mostra: a descrição, ou o produto cadastrado."""

        if self.descricao:
            return self.descricao
        if self.modelo_id:
            marca = self.modelo.marca
            return f"{marca.fabricante.nome} › {marca.nome} › {self.modelo.nome}"
        return ""
