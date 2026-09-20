"""O contrato que o produto conhece sobre onde os arquivos ficam.

**Nada no resto do projeto sabe que existe S3.** Quem grava um edital, uma
certidão ou a planilha do Cotador chama estes quatro métodos; qual serviço
responde é decisão de configuração, não de código — e por isso trocar
Cloudflare R2 por AWS S3 é preencher outros campos na tela, não fazer deploy.

Um driver também **declara os campos que precisa** (`CAMPOS`). É isso que faz
o formulário da tela se desenhar sozinho para o driver escolhido: o frontend
não conhece R2, conhece "uma lista de campos". Driver novo aparece na tela
sem uma linha de Angular.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO, Protocol, runtime_checkable


class ErroArmazenamento(Exception):
    """Falha ao falar com o serviço de arquivos.

    Existe para que o resto do projeto nunca precise capturar `ClientError`
    do boto3 nem `OSError` do disco: o driver traduz o erro dele para este,
    com uma mensagem que dá para mostrar na tela ("credencial recusada pelo
    provedor", e não um traceback de biblioteca).
    """


@dataclass(frozen=True)
class CampoConfig:
    """Um campo do formulário de configuração de um driver."""

    nome: str
    rotulo: str
    obrigatorio: bool = True
    # Segredo entra e não volta: é cifrado no banco e a API devolve só
    # "definido em tal data" (ver `ConfigArmazenamento`).
    segredo: bool = False
    ajuda: str = ""
    placeholder: str = ""


@runtime_checkable
class Armazenamento(Protocol):
    """O driver em si. Instanciado por requisição a partir da configuração do
    tenant (ver `servico.armazenamento_do_tenant`) — não é singleton, porque
    a configuração pode mudar entre uma requisição e a seguinte."""

    #: Chave do driver no registro ("r2", "s3", "local").
    CHAVE: str
    #: Nome que aparece no seletor da tela.
    ROTULO: str
    #: O que a tela precisa perguntar para configurar este driver.
    CAMPOS: tuple[CampoConfig, ...]

    def salvar(self, caminho: str, arquivo: BinaryIO, content_type: str = "") -> str:
        """Grava e devolve o caminho final (pode diferir do pedido se o
        driver aplicar um prefixo). Sobrescreve o que estiver lá: quem
        garante que o caminho é novo é quem monta o caminho."""

    def abrir(self, caminho: str) -> BinaryIO:
        """Devolve o conteúdo para leitura. Usado por quem precisa dos bytes
        no servidor (montar um ZIP, calcular hash de novo) — o download do
        usuário passa por `url_temporaria`, sem trafegar pelo backend."""

    def url_temporaria(self, caminho: str, expira_em: int = 300) -> str:
        """URL assinada e de curta duração.

        É sempre assim que um arquivo chega ao navegador: **o bucket nunca é
        público**. Certidão tem CNPJ, endereço e nome de sócio — não é coisa
        que fique atrás de um link adivinhável."""

    def remover(self, caminho: str) -> None:
        """Apaga. Usado só para desfazer um upload que falhou no meio: no
        produto, documento não se apaga, se arquiva."""
