"""O Cotador — a formação de preço de uma oportunidade, item a item, com
comparação de fornecedores.

**Por que um app próprio, e não um campo novo no cotador antigo.** O de
`apps.licitacoes` (`licitacoes.Cotacao`) responde a outra pergunta: um item,
um fornecedor implícito, cinco alíquotas soltas e um lance de disputa. Este
responde "de quem eu compro cada item e por quanto disputo" — vários
fornecedores por item, margem mínima e máxima, tributo próprio por item. Os
nomes de campo colidiriam (`itens`, `parametros`, `valor_total` significam
coisas diferentes nos dois) e a migração de um para o outro seria uma
reescrita, não um `AlterField`. Apps separados = tabelas separadas
(`licitacoes_cotacao` e `cotador_cotacao`), e o antigo continua de pé até
ser extinto.

**Tabelas, não JSON.** O cotador antigo guarda item e percentual em
`JSONField` porque a lista de tributos mudava com o regime da empresa.
Aqui a forma é estável (item -> ofertas de fornecedor -> uma escolhida) e
tem uma ligação real com outro registro: a oferta aponta para o
`Fornecedor` cadastrado. Isso é relacionamento, e num JSON viraria um id
solto que nada garante.

**Salvar a cotação é o que salva a oportunidade.** Não existe rascunho
persistido: o modal abre com os itens da oportunidade *pesquisada* e vive na
memória do navegador. Só quando alguém salva a cotação é que a oportunidade
entra na lista de salvas (ver `views.CotacoesView.post`) — quem abre o
Cotador, olha e desiste não deixa rastro.

**Os totais são materializados e recalculados no servidor.** Ficam gravados
porque a lista de salvas mostra o valor cotado sem reprocessar item a item —
mas nunca vêm do cliente: `recalcular()` os refaz a partir dos itens com
`formulas.py`. Total enviado pelo frontend é ignorado de propósito.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from . import formulas

# Os percentuais em que uma cotação nova abre — os mesmos do protótipo
# (docs/Mockups/cotador). Ficam aqui, e não só no frontend, para que uma
# cotação criada pela API (ou pelo admin) nasça com a mesma régua.
PADRAO_TRANSPORTE = Decimal("8")
PADRAO_GARANTIA = Decimal("0")
PADRAO_LUCRO_MINIMO = Decimal("10")
PADRAO_LUCRO_MAXIMO = Decimal("35")
PADRAO_IMPOSTOS = Decimal("10")


class Cotacao(models.Model):
    """A cotação de uma oportunidade salva — uma por oportunidade.

    Um-para-um porque o Cotador responde "por quanto eu disputo *este*
    edital": salvar de novo sobrescreve a mesma linha. Se um dia a equipe
    precisar comparar cenários do mesmo edital, isto vira `ForeignKey` — e
    aí a tela ganha nome/versão por cenário, que hoje não existe.
    """

    oportunidade = models.OneToOneField(
        "licitacoes.OportunidadeSalva",
        verbose_name="oportunidade salva",
        # `cotacao` já é do cotador antigo (`licitacoes.Cotacao`). Os dois
        # convivem até o antigo ser extinto — ver docstring do módulo.
        related_name="cotacao_cotador",
        on_delete=models.CASCADE,
    )

    titulo = models.CharField(
        "título",
        max_length=255,
        blank=True,
        help_text="Como a equipe chama esta cotação. Vazio = usa o objeto do edital.",
    )

    # Percentuais em pontos percentuais (8 = 8%), como aparecem nos sliders
    # da tela — ver a docstring de `formulas.py` para o porquê de não serem
    # fração aqui (o cotador antigo usa fração).
    transporte = models.DecimalField(
        "transporte (% do custo)", max_digits=6, decimal_places=2, default=PADRAO_TRANSPORTE
    )
    garantia = models.DecimalField(
        "garantia extra (% do custo)", max_digits=6, decimal_places=2, default=PADRAO_GARANTIA
    )
    lucro_minimo = models.DecimalField(
        "lucro mínimo (% do custo)", max_digits=6, decimal_places=2, default=PADRAO_LUCRO_MINIMO
    )
    lucro_maximo = models.DecimalField(
        "lucro máximo (% do custo)", max_digits=6, decimal_places=2, default=PADRAO_LUCRO_MAXIMO
    )
    impostos = models.DecimalField(
        "tributos (% da venda)",
        max_digits=6,
        decimal_places=2,
        default=PADRAO_IMPOSTOS,
        help_text="ICMS/Simples + PIS + COFINS + IPI + ISS somados.",
    )

    # Derivados de `itens`, recalculados em `save()`. Ver docstring do módulo.
    valor_cotado = models.DecimalField(
        "valor cotado", max_digits=16, decimal_places=2, default=0
    )
    preco_reserva = models.DecimalField(
        "preço de reserva", max_digits=16, decimal_places=2, default=0
    )
    lucro_total = models.DecimalField("lucro", max_digits=16, decimal_places=2, default=0)
    capital = models.DecimalField(
        "capital necessário", max_digits=16, decimal_places=2, default=0
    )
    impostos_embutidos = models.DecimalField(
        "impostos embutidos", max_digits=16, decimal_places=2, default=0
    )
    custo_produtos = models.DecimalField(
        "custo dos produtos", max_digits=16, decimal_places=2, default=0
    )

    criada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="criada por",
        related_name="cotacoes_criadas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    atualizada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="atualizada por",
        related_name="cotacoes_atualizadas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    criada_em = models.DateTimeField("criada em", auto_now_add=True)
    atualizada_em = models.DateTimeField("atualizada em", auto_now=True)

    class Meta:
        verbose_name = "cotação"
        verbose_name_plural = "cotações"
        ordering = ["-atualizada_em"]

    def __str__(self) -> str:
        return self.titulo or f"Cotação da oportunidade {self.oportunidade_id}"

    @property
    def padroes(self) -> formulas.Padroes:
        return formulas.Padroes(
            transporte=self.transporte,
            garantia=self.garantia,
            lucro_minimo=self.lucro_minimo,
            lucro_maximo=self.lucro_maximo,
            impostos=self.impostos,
        )

    def para_calculo(self) -> list[formulas.Item]:
        """Traduz as linhas do banco para as estruturas de `formulas.py` —
        que não conhecem Django de propósito, para dar pra testar a conta
        sem banco."""

        return [
            formulas.Item(
                descricao=item.descricao,
                quantidade=item.quantidade,
                margem_minima=item.margem_minima,
                margem_maxima=item.margem_maxima,
                impostos=item.impostos,
                ofertas=[
                    formulas.Oferta(
                        identificador=oferta.pk,
                        nome=oferta.nome,
                        custo_produto=oferta.custo_produto,
                        frete=oferta.frete,
                        outros=oferta.outros,
                        escolhida=oferta.escolhida,
                    )
                    for oferta in item.ofertas.all()
                ],
            )
            for item in self.itens.all()
        ]

    def totais(self) -> formulas.Totais:
        return formulas.totalizar(self.para_calculo(), self.padroes)

    def recalcular(self, *, salvar: bool = True) -> formulas.Totais:
        """Refaz os totais a partir dos itens gravados.

        Chamado **depois** de gravar itens e ofertas (o `save()` da cotação
        acontece antes deles quando a cotação é nova), por isso é um método
        explícito e não um `save()` sobrescrito: no momento do primeiro
        `save()` ainda não existe item nenhum para somar.
        """

        totais = self.totais()
        self.valor_cotado = totais.valor_cotado
        self.preco_reserva = totais.preco_reserva
        self.lucro_total = totais.lucro_total
        self.capital = totais.capital
        self.impostos_embutidos = totais.impostos
        self.custo_produtos = totais.custo_produtos
        if salvar:
            self.save(
                update_fields=[
                    "valor_cotado",
                    "preco_reserva",
                    "lucro_total",
                    "capital",
                    "impostos_embutidos",
                    "custo_produtos",
                    "atualizada_em",
                ]
            )
        return totais


class ItemCotacao(models.Model):
    """Um item do edital dentro da cotação.

    Nasce preenchido a partir da oportunidade pesquisada (descrição,
    unidade, quantidade e valor de referência vêm do PNCP) — o operador só
    amarra os fornecedores e ajusta o que precisar. `numero_item` e
    `valor_referencia` são o vínculo com o edital: é o que deixa a planilha
    exportada ser conferida linha a linha contra a publicação original.
    """

    cotacao = models.ForeignKey(
        Cotacao, verbose_name="cotação", related_name="itens", on_delete=models.CASCADE
    )
    ordem = models.PositiveIntegerField("ordem", default=0)

    numero_item = models.CharField("nº do item no edital", max_length=20, blank=True)
    descricao = models.TextField("descrição", blank=True)
    unidade = models.CharField("unidade de medida", max_length=40, blank=True)
    quantidade = models.DecimalField(
        "quantidade", max_digits=16, decimal_places=4, default=0
    )
    valor_referencia = models.DecimalField(
        "valor unitário de referência",
        max_digits=16,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="O estimado do edital — base do desconto mostrado na planilha.",
    )

    # Nulo = usa o padrão da cotação. Zero é valor legítimo (margem zero,
    # item isento), então o ausente não pode ser 0 — ver `formulas.Item`.
    margem_minima = models.DecimalField(
        "margem mínima (%)", max_digits=6, decimal_places=2, null=True, blank=True
    )
    margem_maxima = models.DecimalField(
        "margem máxima (%)", max_digits=6, decimal_places=2, null=True, blank=True
    )
    impostos = models.DecimalField(
        "tributos próprios (% da venda)",
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "item da cotação"
        verbose_name_plural = "itens da cotação"
        ordering = ["ordem", "id"]

    def __str__(self) -> str:
        return self.descricao[:60] or f"Item {self.ordem + 1}"


class OfertaFornecedor(models.Model):
    """O preço de um fornecedor para um item — a linha que o operador
    compara antes de escolher de quem comprar.

    `fornecedor` aponta para o cadastro, mas `nome` é gravado junto de
    propósito: excluir um fornecedor do cadastro não pode apagar de quem a
    equipe cotou naquele pregão. A FK cai para nulo e a cotação continua
    legível.
    """

    item = models.ForeignKey(
        ItemCotacao, verbose_name="item", related_name="ofertas", on_delete=models.CASCADE
    )
    fornecedor = models.ForeignKey(
        "fornecedores.Fornecedor",
        verbose_name="fornecedor",
        related_name="ofertas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    nome = models.CharField(
        "fornecedor (snapshot)",
        max_length=255,
        blank=True,
        help_text="Preservado para a cotação sobreviver à exclusão do cadastro.",
    )
    ordem = models.PositiveIntegerField("ordem", default=0)

    custo_produto = models.DecimalField(
        "custo do produto (un.)", max_digits=16, decimal_places=4, default=0
    )
    frete = models.DecimalField("frete (un.)", max_digits=16, decimal_places=4, default=0)
    outros = models.DecimalField(
        "outros custos (un.)", max_digits=16, decimal_places=4, default=0
    )

    escolhida = models.BooleanField(
        "escolhida",
        default=False,
        help_text="A oferta que entra no cálculo. No máximo uma por item.",
    )

    class Meta:
        verbose_name = "oferta de fornecedor"
        verbose_name_plural = "ofertas de fornecedor"
        ordering = ["ordem", "id"]
        constraints = [
            # O banco garante o que a tela promete (um radio marcado por
            # item) — uma escrita concorrente não pode deixar duas ofertas
            # entrando na mesma conta.
            models.UniqueConstraint(
                fields=["item"],
                condition=Q(escolhida=True),
                name="cotador_uma_oferta_escolhida_por_item",
            )
        ]

    def __str__(self) -> str:
        return f"{self.nome or 'sem fornecedor'} — {self.custo_produto}"

    @property
    def custo_unitario(self) -> Decimal:
        return self.custo_produto + self.frete + self.outros
