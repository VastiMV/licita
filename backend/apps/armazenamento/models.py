"""Qual bucket este cliente usa, e com que credencial.

**Registro de banco, não variável de ambiente.** Uma `ConfigMap` exigiria
redeploy para trocar e seria igual para todo mundo; aqui cada tenant escolhe
o driver e preenche os campos dele pela tela — que é o ponto do plugin.

O formato acompanha isso: os valores ficam num JSON (`opcoes`), e não em
colunas, porque **quais campos existem é decisão do driver**. Um driver novo,
instalado como pacote, não pede migração nenhuma.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.tenants.models import tenant_campo

from .cripto import cifrar, decifrar
from .registro import driver


class ConfigArmazenamento(models.Model):
    # Um por tenant, e não por empresa: o bucket é do **cliente**, e os
    # documentos de todas as empresas dele convivem lá dentro, separados por
    # caminho (ver `caminhos.py`). Daí o singular no `related_name`.
    tenant = tenant_campo("config_armazenamento")

    driver = models.CharField(
        "driver",
        max_length=40,
        help_text="Chave do driver instalado (ver apps/armazenamento/registro.py).",
    )
    opcoes = models.JSONField(
        "opções",
        default=dict,
        blank=True,
        help_text="Os campos não secretos do driver escolhido — bucket, endpoint, região.",
    )
    segredos_cifrados = models.TextField("segredos", blank=True)
    segredos_definidos_em = models.DateTimeField("segredos definidos em", null=True, blank=True)

    testado_em = models.DateTimeField("testado com sucesso em", null=True, blank=True)

    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="atualizado por",
        related_name="configs_armazenamento",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "configuração de armazenamento"
        verbose_name_plural = "configurações de armazenamento"
        constraints = [
            models.UniqueConstraint(fields=["tenant"], name="armazenamento_um_por_tenant"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant}: {self.driver}"

    # -- segredos ----------------------------------------------------------

    @property
    def segredos(self) -> dict[str, str]:
        return decifrar(self.segredos_cifrados)

    def definir_segredos(self, novos: dict[str, str]) -> None:
        """Mescla com os que já existem: a tela manda só o que foi digitado
        de novo, porque o valor atual ela nunca recebeu de volta.

        Valor vazio não apaga — apagar credencial por engano ao salvar o
        formulário seria fácil demais. Quem troca, digita outro."""

        guardados = self.segredos
        mudou = False
        for nome, valor in novos.items():
            if valor:
                guardados[nome] = valor
                mudou = True

        if mudou:
            self.segredos_cifrados = cifrar(guardados)
            self.segredos_definidos_em = timezone.now()

    def limpar_segredos_de_outro_driver(self) -> None:
        """Trocar de driver não pode deixar para trás a secret key do
        anterior — ela não serve para nada e continuaria gravada."""

        nomes = {campo.nome for campo in self.campos() if campo.segredo}
        guardados = {n: v for n, v in self.segredos.items() if n in nomes}
        self.segredos_cifrados = cifrar(guardados) if guardados else ""
        if not guardados:
            self.segredos_definidos_em = None

    @property
    def segredos_definidos(self) -> list[str]:
        """Só os nomes — o valor nunca sai daqui (ver `serializers.py`)."""

        return sorted(self.segredos)

    # -- driver ------------------------------------------------------------

    def campos(self):
        return driver(self.driver).CAMPOS

    def instanciar(self):
        """O driver pronto para uso, com opções e segredos juntos. É o que
        `servico.armazenamento_do_tenant` devolve para o resto do projeto."""

        return driver(self.driver)(**{**self.opcoes, **self.segredos})

    @property
    def completa(self) -> bool:
        """Todo campo obrigatório preenchido. A tela usa para dizer "falta
        configurar" antes de alguém tentar subir arquivo."""

        valores = {**self.opcoes, **self.segredos}
        return all(valores.get(campo.nome) for campo in self.campos() if campo.obrigatorio)
