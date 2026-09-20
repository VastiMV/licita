"""Documentos de habilitação da empresa — certidões, contrato social, balanço.

**A pergunta que este módulo responde não é "onde estão meus arquivos", é
"estou habilitado hoje?".** Em pregão a habilitação só é cobrada de quem já
venceu, com prazo de horas para enviar tudo, e o CRF do FGTS vale 30 dias —
doze vencimentos por ano em um documento só. Por isso a validade é o dado
principal e o arquivo é anexo do registro, nunca o contrário.

Três objetos, e a ordem entre eles é a decisão de produto inteira:

- **`TipoDocumento`** é o catálogo: a lista é fixa porque a Lei 14.133
  organiza a habilitação em quatro blocos e são sempre os mesmos documentos.
  O que muda é a data.
- **`Documento`** é a *vaga* daquele tipo naquela empresa. Não guarda arquivo
  nem validade — guarda qual versão está valendo. É a linha da tabela.
- **`VersaoDocumento`** é o arquivo que ocupa a vaga, com o número, a emissão
  e **a validade daquela emissão**. Renovar o FGTS não corrige uma data:
  cria outra certidão, que é outra versão da mesma vaga.

Consequências que valem a indireção: renovar nunca vira "CRF (1).pdf"; a
versão que foi enviada num processo continua recuperável depois de renovada;
e a situação ("vencido") é sempre **calculada**, nunca um campo gravado —
campo gravado envelhece sozinho, que foi exatamente o que aconteceu com
`Fornecedor.situacao`.

Não é o mesmo model dos documentos da **licitação** (edital, proposta do
fornecedor, empenho), e não deveria ser: lá não há lista fixa nem validade,
e o mesmo processo tem três catálogos e nenhum atestado. O que os dois
compartilham é `apps.armazenamento`. Ver `docs/Tarefas/README.md`.
"""

from __future__ import annotations

import datetime as dt

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.empresas.models import Empresa
from apps.tenants.models import Tenant, TenantQuerySet, tenant_campo

#: Quantos dias antes do vencimento o documento entra em "a vencer".
#: 30 porque é o prazo em que ainda dá para pedir a certidão nova sem
#: correria — e porque o CRF do FGTS, que vale 30 dias, sempre aparece.
DIAS_A_VENCER = 30


class Bloco(models.TextChoices):
    """Os quatro blocos de habilitação da Lei 14.133 (arts. 62 a 70), na
    ordem em que os editais costumam pedir. `OUTROS` é a saída para o que um
    edital específico exigir sem caber em nenhum deles."""

    JURIDICA = "juridica", "Habilitação jurídica"
    FISCAL = "fiscal", "Fiscal, social e trabalhista"
    ECONOMICA = "economica", "Econômico-financeira"
    TECNICA = "tecnica", "Técnica"
    OUTROS = "outros", "Outros"


class Situacao(models.TextChoices):
    """**Não existe coluna com isto.** É sempre conta feita contra a data de
    hoje (ver `Documento.situacao`)."""

    PENDENTE = "pendente", "Pendente"
    VALIDO = "valido", "Válido"
    A_VENCER = "a_vencer", "A vencer"
    VENCIDO = "vencido", "Vencido"
    ARQUIVADO = "arquivado", "Arquivado"


class TipoDocumento(models.Model):
    """O catálogo. Vem semeado por migração com os documentos que todo edital
    pede, e aceita acréscimo: o edital que exige um alvará específico não
    pode exigir deploy.

    `tenant` nulo = o catálogo padrão, que serve a todo mundo. Preenchido =
    tipo que aquele cliente criou. É a única FK de tenant opcional do
    projeto, e é opcional por isso.
    """

    tenant = models.ForeignKey(
        Tenant,
        verbose_name="tenant",
        related_name="tipos_documento",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        help_text="Vazio = catálogo padrão, comum a todos.",
    )

    bloco = models.CharField("bloco", max_length=12, choices=Bloco.choices)
    nome = models.CharField("nome", max_length=160)
    orgao_emissor = models.CharField("órgão emissor", max_length=160, blank=True)

    exige_validade = models.BooleanField(
        "exige validade",
        default=True,
        help_text="Contrato social e atestado não vencem — não podem entrar na conta de vencidos.",
    )
    obrigatorio = models.BooleanField(
        "obrigatório",
        default=True,
        help_text="Abre a vaga automaticamente para toda empresa nova.",
    )
    link_emissor = models.URLField(
        "site do emissor",
        blank=True,
        help_text="Para onde o alerta de vencimento manda quem precisa renovar.",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "tipo de documento"
        verbose_name_plural = "tipos de documento"
        ordering = ["bloco", "ordem", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "nome"],
                name="tipo_documento_nome_unico_por_tenant",
            ),
        ]

    def __str__(self) -> str:
        return self.nome


class DocumentoQuerySet(TenantQuerySet):
    def da_empresa(self, empresa: Empresa) -> "DocumentoQuerySet":
        return self.filter(empresa=empresa)

    def ativos(self) -> "DocumentoQuerySet":
        """Os que contam. Arquivado sai das listas e das contagens, mas
        continua existindo — e continua preso ao processo que o usou."""

        return self.filter(arquivado_em__isnull=True)

    def com_versao_atual(self) -> "DocumentoQuerySet":
        """Evita uma consulta por linha na tela do dossiê, que lista dezenas
        de documentos e a versão corrente de cada um."""

        return self.select_related("tipo", "empresa").prefetch_related("versoes")


class Documento(models.Model):
    """A vaga: um tipo de documento naquela empresa."""

    tenant = tenant_campo("documentos")
    empresa = models.ForeignKey(
        Empresa, verbose_name="empresa", related_name="documentos", on_delete=models.CASCADE
    )
    tipo = models.ForeignKey(
        TipoDocumento, verbose_name="tipo", related_name="documentos", on_delete=models.PROTECT
    )

    titulo = models.CharField(
        "título",
        max_length=160,
        blank=True,
        help_text='Só para o tipo livre ("outro documento"): é o que distingue dois deles.',
    )
    observacoes = models.TextField("observações", blank=True)

    arquivado_em = models.DateTimeField("arquivado em", null=True, blank=True)

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    objects = DocumentoQuerySet.as_manager()

    class Meta:
        verbose_name = "documento"
        verbose_name_plural = "documentos"
        ordering = ["tipo__bloco", "tipo__ordem", "tipo__nome"]
        constraints = [
            # Uma vaga por tipo. O `titulo` entra na chave para o tipo livre
            # aceitar mais de um ("Alvará sanitário" e "Licença ambiental"
            # não são o mesmo documento só porque caíram no mesmo tipo).
            models.UniqueConstraint(
                fields=["empresa", "tipo", "titulo"], name="documento_unico_por_empresa_e_tipo"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.nome} — {self.empresa.nome}"

    @property
    def nome(self) -> str:
        return self.titulo or self.tipo.nome

    @property
    def versao_atual(self) -> "VersaoDocumento | None":
        """A última enviada. Usa o `prefetch_related` quando ele existe (ver
        `com_versao_atual`), então listar o dossiê inteiro não vira uma
        consulta por linha."""

        versoes = sorted(self.versoes.all(), key=lambda v: v.versao, reverse=True)
        return versoes[0] if versoes else None

    @property
    def validade(self) -> dt.date | None:
        atual = self.versao_atual
        return atual.validade if atual else None

    @property
    def dias_para_vencer(self) -> int | None:
        """Negativo = vencido há tantos dias. `None` quando não há validade a
        contar (sem versão, ou tipo que não vence)."""

        validade = self.validade
        if validade is None:
            return None
        return (validade - timezone.localdate()).days

    @property
    def situacao(self) -> str:
        """A conta, feita sempre contra hoje.

        Nada no banco guarda "vencido": campo gravado envelhece sozinho, e um
        documento que venceu ontem tem que aparecer vencido hoje sem ninguém
        rodar nada.
        """

        if self.arquivado_em is not None:
            return Situacao.ARQUIVADO
        if self.versao_atual is None:
            return Situacao.PENDENTE
        # Tipo que não vence (contrato social, atestado) com versão enviada
        # está resolvido — e não pode entrar na conta de vencidos.
        if not self.tipo.exige_validade or self.validade is None:
            return Situacao.VALIDO

        dias = self.dias_para_vencer
        if dias < 0:
            return Situacao.VENCIDO
        if dias <= DIAS_A_VENCER:
            return Situacao.A_VENCER
        return Situacao.VALIDO

    @property
    def situacao_label(self) -> str:
        """O texto da pílula. Diz o número quando ele é a informação —
        "vence em 4 dias" age, "A vencer" não."""

        situacao = self.situacao
        dias = self.dias_para_vencer

        if situacao == Situacao.VENCIDO:
            return "Vencido ontem" if dias == -1 else f"Vencido há {-dias} dias"
        if situacao == Situacao.A_VENCER:
            if dias == 0:
                return "Vence hoje"
            return "Vence amanhã" if dias == 1 else f"Vence em {dias} dias"
        if situacao == Situacao.VALIDO and not self.tipo.exige_validade:
            return "Vigente"
        if situacao == Situacao.VALIDO and dias is not None:
            return f"Válido · {dias} dias"
        return Situacao(situacao).label

    def proxima_versao(self) -> int:
        atual = self.versao_atual
        return (atual.versao + 1) if atual else 1


class VersaoDocumento(models.Model):
    """O arquivo, com a validade **daquela** emissão.

    Imutável depois de gravada: renovar cria outra. É isso que permite provar
    depois o que foi entregue num processo, mesmo que a certidão já tenha
    sido renovada duas vezes desde então.
    """

    documento = models.ForeignKey(
        Documento, verbose_name="documento", related_name="versoes", on_delete=models.CASCADE
    )
    versao = models.PositiveIntegerField("versão")

    numero = models.CharField("número do documento", max_length=80, blank=True)
    emissao = models.DateField("emissão", null=True, blank=True)
    validade = models.DateField("validade", null=True, blank=True)

    # Chave no bucket — ver apps/armazenamento/caminhos.py. Não é FileField:
    # o arquivo não está no disco do pod, e quem sabe gravar é o driver
    # configurado pelo cliente.
    arquivo = models.CharField("caminho no armazenamento", max_length=500)
    nome_original = models.CharField("nome do arquivo enviado", max_length=255)
    tamanho = models.PositiveIntegerField("tamanho (bytes)")
    content_type = models.CharField("tipo do arquivo", max_length=120, blank=True)
    hash_sha256 = models.CharField(
        "hash",
        max_length=64,
        blank=True,
        help_text="Para provar que o arquivo baixado é o mesmo que foi enviado.",
    )

    nota = models.CharField(
        "nota da versão",
        max_length=200,
        blank=True,
        help_text='O que mudou ("renovação de agosto") — aparece no histórico.',
    )

    enviado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="enviado por",
        related_name="versoes_documento_enviadas",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    enviado_em = models.DateTimeField("enviado em", auto_now_add=True)

    class Meta:
        verbose_name = "versão do documento"
        verbose_name_plural = "versões do documento"
        ordering = ["-versao"]
        constraints = [
            models.UniqueConstraint(
                fields=["documento", "versao"], name="versao_unica_por_documento"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.documento.nome} v{self.versao}"

    @property
    def extensao(self) -> str:
        _, _, ext = self.nome_original.rpartition(".")
        return ext.lower() if ext else ""


class TipoEvento(models.TextChoices):
    ENVIADO = "enviado", "Enviado"
    RENOVADO = "renovado", "Renovado"
    BAIXADO = "baixado", "Baixado"
    ARQUIVADO = "arquivado", "Arquivado"
    RESTAURADO = "restaurado", "Restaurado"


class EventoDocumento(models.Model):
    """O histórico. Mesmo padrão de `EventoOportunidadeSalva`: a história se
    escreve desde o primeiro dia porque depois não dá para reconstruir."""

    documento = models.ForeignKey(
        Documento, verbose_name="documento", related_name="eventos", on_delete=models.CASCADE
    )
    tipo = models.CharField("evento", max_length=12, choices=TipoEvento.choices)
    detalhe = models.CharField("detalhe", max_length=240, blank=True)

    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="quem",
        related_name="eventos_documento",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    quando = models.DateTimeField("quando", auto_now_add=True)

    class Meta:
        verbose_name = "evento do documento"
        verbose_name_plural = "eventos do documento"
        ordering = ["-quando"]

    def __str__(self) -> str:
        return f"{self.documento.nome}: {self.get_tipo_display()}"

    @classmethod
    def registrar(cls, documento: Documento, tipo: str, autor=None, detalhe: str = ""):
        return cls.objects.create(
            documento=documento,
            tipo=tipo,
            autor=autor if (autor and autor.is_authenticated) else None,
            detalhe=detalhe,
        )
