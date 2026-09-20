"""Cadastro de empresas — os CNPJs com que a equipe **disputa**.

Não confundir com `apps.fornecedores`, que é de quem a empresa *compra* para
revender. São duas perguntas diferentes e por isso dois cadastros:

- Do fornecedor importam preço, prazo e condição de pagamento; são dezenas ou
  centenas de registros e quem usa é o Cotador.
- Da empresa importa **habilitação**: porte, inscrições, certidões em dia.
  São poucos registros (matriz, filial, a segunda empresa que cobre outro
  CNAE) e quem usa é a proposta e o kit de habilitação.

**Por que mais de um CNPJ.** Matriz e filial disputam lotes diferentes, e uma
segunda empresa cobre CNAE que a primeira não tem. Quem monta a proposta
escolhe qual usar — com um CNPJ só, o seletor nem aparece na tela.

**Não existe excluir.** Empresa que já disputou está amarrada a propostas e
processos; o que existe é inativar (`ativa = False`): some do seletor de
CNPJ, continua no histórico. É a mesma disciplina da remoção lógica da
oportunidade salva, e o oposto do fornecedor — que pode ser apagado de
verdade justamente porque a cotação guarda o nome dele como snapshot.

O dígito verificador vem de `apps.fornecedores.documentos`, que já nasceu
isolado do model de fornecedor para servir qualquer cadastro que viesse
depois — ver a docstring de lá.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models, transaction

from apps.fornecedores.documentos import formatar_documento, somente_digitos
from apps.tenants.models import TenantQuerySet, tenant_campo


class Porte(models.TextChoices):
    """O que a licitação pergunta da empresa — e não "categoria", que é
    classificação de fornecedor.

    Porte não é papelada: ME e EPP têm direito a empate ficto (art. 44 da LC
    123) e a prazo para regularizar certidão fiscal depois de vencer a
    disputa. É o campo que mais muda o que acontece no pregão."""

    MEI = "mei", "MEI"
    ME = "me", "Microempresa (ME)"
    EPP = "epp", "Empresa de pequeno porte (EPP)"
    DEMAIS = "demais", "Demais"


class EmpresaQuerySet(TenantQuerySet):
    def buscar(self, termo: str) -> "EmpresaQuerySet":
        """A caixa única da tela: razão social, fantasia, CNPJ e cidade.

        O CNPJ entra pelos dígitos, então "12.345" acha "12345678000199" —
        quem digita com máscara casa igual, porque o termo é normalizado
        antes de comparar (mesma regra de `Fornecedor.buscar`)."""

        termo = (termo or "").strip()
        if not termo:
            return self

        filtro = (
            models.Q(nome__icontains=termo)
            | models.Q(fantasia__icontains=termo)
            | models.Q(cidade__icontains=termo)
        )

        digitos = somente_digitos(termo)
        if digitos:
            filtro |= models.Q(cnpj__contains=digitos)

        return self.filter(filtro)

    def ativas(self) -> "EmpresaQuerySet":
        """As que podem ser escolhidas numa proposta nova. A inativa continua
        no cadastro e nos processos antigos — só não é oferecida."""

        return self.filter(ativa=True)


class Empresa(models.Model):
    tenant = tenant_campo()

    nome = models.CharField("razão social", max_length=255)
    fantasia = models.CharField("nome fantasia", max_length=255, blank=True)
    cnpj = models.CharField(
        "CNPJ",
        max_length=14,
        help_text="Só dígitos — a máscara é da tela (ver apps/fornecedores/documentos.py).",
    )
    porte = models.CharField("porte", max_length=8, choices=Porte.choices, default=Porte.DEMAIS)
    inscricao_estadual = models.CharField("inscrição estadual", max_length=40, blank=True)
    inscricao_municipal = models.CharField("inscrição municipal", max_length=40, blank=True)
    cnae_principal = models.CharField(
        "CNAE principal",
        max_length=10,
        blank=True,
        help_text="É o que decide se esta empresa pode disputar um objeto ou não.",
    )

    cep = models.CharField("CEP", max_length=8, blank=True)
    logradouro = models.CharField("logradouro", max_length=255, blank=True)
    numero = models.CharField("número", max_length=20, blank=True)
    complemento = models.CharField("complemento", max_length=120, blank=True)
    bairro = models.CharField("bairro", max_length=120, blank=True)
    uf = models.CharField("UF", max_length=2, blank=True)
    cidade = models.CharField("cidade", max_length=120, blank=True)

    responsavel_legal = models.CharField(
        "responsável legal",
        max_length=150,
        blank=True,
        help_text="Quem assina proposta e contrato — é o nome que entra nas declarações geradas.",
    )
    email = models.EmailField("e-mail", blank=True)
    telefone = models.CharField("telefone", max_length=20, blank=True)

    observacoes = models.TextField("observações", blank=True)

    padrao = models.BooleanField(
        "empresa padrão",
        default=False,
        help_text="A que já vem escolhida na proposta. Uma por tenant.",
    )
    ativa = models.BooleanField("ativa", default=True)

    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="cadastrada por",
        related_name="empresas_cadastradas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    criado_em = models.DateTimeField("cadastrada em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizada em", auto_now=True)

    objects = EmpresaQuerySet.as_manager()

    class Meta:
        verbose_name = "empresa"
        verbose_name_plural = "empresas"
        ordering = ["nome"]
        constraints = [
            # Unicidade **por tenant**, e não global como no fornecedor: dois
            # clientes diferentes do produto podem ser a mesma empresa? Não —
            # mas podem cadastrar o mesmo CNPJ de uma sociedade que
            # compartilham, e um não pode impedir o outro de cadastrar.
            models.UniqueConstraint(fields=["tenant", "cnpj"], name="empresa_cnpj_unico_por_tenant"),
            # Uma padrão por tenant, garantido pelo banco — `save()` já
            # desmarca a anterior, mas duas transações concorrentes não se
            # veem, e o índice parcial vê.
            models.UniqueConstraint(
                fields=["tenant"],
                condition=models.Q(padrao=True),
                name="empresa_padrao_unica_por_tenant",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.nome} ({self.cnpj_formatado})"

    @property
    def cnpj_formatado(self) -> str:
        return formatar_documento(self.cnpj)

    @property
    def cidade_uf(self) -> str:
        if not self.cidade:
            return self.uf or "—"
        return f"{self.cidade} / {self.uf}" if self.uf else self.cidade

    def save(self, *args, **kwargs):
        """Duas conveniências que a tela não deveria ter que lembrar:

        a **primeira** empresa do tenant nasce padrão (não faz sentido um
        cadastro com uma empresa só e nenhuma escolhida), e marcar uma como
        padrão desmarca a anterior — em transação, senão o índice parcial de
        `Meta.constraints` recusa o estado intermediário com duas."""

        with transaction.atomic():
            if not self.pk and not Empresa.objects.do_tenant(self.tenant).exists():
                self.padrao = True

            if self.padrao:
                outras = Empresa.objects.do_tenant(self.tenant).filter(padrao=True)
                if self.pk:
                    outras = outras.exclude(pk=self.pk)
                outras.update(padrao=False)

            super().save(*args, **kwargs)
