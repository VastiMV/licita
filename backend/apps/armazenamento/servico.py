"""A porta de entrada do resto do projeto.

Quem grava um documento chama `armazenamento_do_tenant(tenant)` e recebe algo
que sabe `salvar`, `abrir`, `url_temporaria` e `remover`. Nenhum outro módulo
lê `ConfigArmazenamento`, instancia driver ou sabe o que é um bucket.
"""

from __future__ import annotations

import io

from django.utils import timezone

from apps.tenants.models import Tenant

from .base import Armazenamento, ErroArmazenamento
from .caminhos import caminho
from .models import ConfigArmazenamento


def config_do_tenant(tenant: Tenant) -> ConfigArmazenamento | None:
    return ConfigArmazenamento.objects.filter(tenant=tenant).first()


def armazenamento_do_tenant(tenant: Tenant) -> Armazenamento:
    """O driver configurado, pronto.

    Sem configuração não há fallback silencioso para disco local: gravar
    certidão numa pasta que some no próximo pod seria pior do que recusar. A
    mensagem é a que a tela mostra, com o caminho do conserto.
    """

    config = config_do_tenant(tenant)
    if config is None or not config.completa:
        raise ErroArmazenamento(
            "O armazenamento de arquivos ainda não foi configurado. "
            "Configure em Configurações → Armazenamento antes de enviar documentos."
        )
    return config.instanciar()


def testar(config: ConfigArmazenamento) -> None:
    """Round-trip de um byte: grava, lê de volta, confere e apaga.

    É o que o botão "Testar conexão" faz. Credencial errada, bucket
    inexistente ou permissão faltando aparecem aqui — e não no primeiro
    upload de um balanço de 20 MB, com alguém esperando.

    Levanta `ErroArmazenamento` com a mensagem do provedor; sucesso é não
    levantar nada.
    """

    driver = config.instanciar()
    alvo = caminho(config.tenant, "_teste", f"{timezone.now():%Y%m%d%H%M%S}.txt")

    driver.salvar(alvo, io.BytesIO(b"."), content_type="text/plain")
    try:
        with driver.abrir(alvo) as lido:
            conteudo = lido.read()
        if conteudo != b".":
            raise ErroArmazenamento(
                "O arquivo de teste voltou diferente do que foi gravado — confira se o "
                "bucket não é compartilhado com outro sistema."
            )
    finally:
        # O byte de teste não pode virar lixo acumulado a cada clique.
        driver.remover(alvo)

    ConfigArmazenamento.objects.filter(pk=config.pk).update(testado_em=timezone.now())
