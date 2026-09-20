"""Tenant — a operação de licitação dona dos registros.

**Hoje existe uma linha só**, a Inside Solutions, criada por migração. Não há
tela para cadastrar tenant e não há seletor: o produto se comporta como se
fosse de um cliente só, porque é.

Então por que o model existe? Porque o campo que falta é caro de acrescentar
depois. Quando o segundo cliente aparecer, uma coluna que nasceu nula em
milhares de linhas já gravadas não tem como ser preenchida — não há de quem
sejam aquelas empresas, aqueles documentos, aquele bucket. Nascendo
obrigatória com um tenant só, a resposta é sempre a mesma e a migração do dia
seguinte é mecânica.

**Tenant não é empresa.** Um cliente tem *várias* empresas — matriz,
filial, a segunda que cobre outro CNAE —, e é com uma delas que ele disputa
cada licitação. Daí `tenant.empresas` (ver `tenant_campo`): a relação é
um-para-muitos e o caminho de volta faz parte do model, não só do banco.

**Os models antigos ficam de fora de propósito.** `Fornecedor`,
`OportunidadeSalva` e `Cotacao` continuam sem tenant: eles já existem, já têm
dados, e acrescentar a FK neles é exatamente a migração trivial descrita
acima — que se faz no dia em que houver um segundo tenant, não antes. Quem
nasce daqui para frente (`Empresa`, documentos, configuração de
armazenamento) já nasce com o campo.
"""

from __future__ import annotations

from django.db import models

# Slug do único tenant existente, criado em `migrations/0001_initial.py`.
# Ficar aqui (e não solto em `tenant_atual`) deixa a migração e a resolução
# lendo a mesma constante.
TENANT_PADRAO_SLUG = "inside-solutions"
TENANT_PADRAO_NOME = "Inside Solutions"


class Tenant(models.Model):
    nome = models.CharField("nome", max_length=120)
    slug = models.SlugField(
        "identificador",
        max_length=60,
        unique=True,
        help_text="Usado no caminho dos arquivos no bucket — mudar quebra o que já foi gravado.",
    )
    ativo = models.BooleanField("ativo", default=True)

    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "tenant"
        verbose_name_plural = "tenants"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome

    @property
    def empresa_padrao(self):
        """A empresa que já vem escolhida ao montar uma proposta.

        `None` só antes de a primeira ser cadastrada: a primeira empresa de
        um tenant nasce padrão (ver `apps.empresas.models.Empresa.save`).
        """

        return self.empresas.filter(padrao=True, ativa=True).first()


class TenantQuerySet(models.QuerySet):
    """Base dos querysets de quem tem `tenant`. Uma chamada só — `do_tenant`
    — para que o dia da virada multiempresa seja "achar quem não chamou",
    e não "reler todo filtro do projeto"."""

    def do_tenant(self, tenant: Tenant) -> "TenantQuerySet":
        return self.filter(tenant=tenant)


def tenant_campo(related_name: str) -> models.ForeignKey:
    """A FK padronizada. Obrigatória (ver docstring do módulo) e `PROTECT`:
    apagar um tenant com dados é sempre erro de operação, nunca intenção.

    `related_name` é obrigatório e nunca `"+"`: **o caminho de volta faz
    parte do model**. Um cliente tem várias empresas, e `tenant.empresas` é
    como se pergunta quais são — sem isso o vínculo existe só no banco, e no
    Django ele não existe.
    """

    return models.ForeignKey(
        Tenant,
        verbose_name="tenant",
        related_name=related_name,
        on_delete=models.PROTECT,
    )
