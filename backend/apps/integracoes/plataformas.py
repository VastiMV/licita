"""Registro de plataformas de compra — o ponto de entrada para plugar uma nova.

O PNCP **não** é uma plataforma: é o agregador nacional onde toda plataforma
(Lei 14.133) é obrigada a publicar. A busca textual roda nele e por isso pode
devolver edital de qualquer plataforma; a *plataforma* é onde a disputa de
fato acontece (Comprasnet, Portal de Compras Públicas, BLL, Licitanet...), e
é pra lá que o botão "abrir na plataforma" do frontend aponta.

Para adicionar uma plataforma nova:

1. Criar o client dela em `apps/integracoes/clients/` (se ela tiver API
   própria de navegação/itens — pra plataforma só "linkável", basta o passo 2).
2. Criar aqui uma subclasse de `Plataforma` e acrescentá-la em `PLATAFORMAS`.

Ninguém fora deste módulo deve decidir "qual plataforma" — quem precisa de
client, link ou nome pega pelo registro (`plataforma_padrao`,
`identificar_plataforma`). Enquanto só o compras.gov.br está implementado,
`plataforma_padrao()` devolve ele; quando houver mais de uma, a escolha vira
configuração/parâmetro sem mexer em quem consome.

Um edital vindo da busca textual do PNCP só revela a plataforma no detalhe da
compra (`PncpClient.detalhar_compra` -> `link_plataforma`/`plataforma_nome`);
`identificar_plataforma` casa esse link com uma plataforma registrada pelo
domínio — plataforma não registrada não é erro: o link de origem continua
válido, só não tem ícone/da casa (ver o serializer de detalhe em
`apps/licitacoes`).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar

from .clients.compras_gov import ComprasGovClient, montar_link_compras_gov


class Plataforma(ABC):
    """Uma plataforma de compras públicas onde a disputa acontece."""

    id: ClassVar[str]
    nome: ClassVar[str]
    # Trechos de domínio que identificam um link desta plataforma (usado por
    # `identificar_plataforma` sobre o `linkSistemaOrigem` do PNCP).
    dominios: ClassVar[tuple[str, ...]]

    @abstractmethod
    def criar_client(self) -> Any:
        """Client de API da plataforma (context manager, ver clients/)."""

    @abstractmethod
    def montar_link(self, contratacao: dict[str, Any]) -> str | None:
        """Link da compra na plataforma, a partir da contratação normalizada.
        `None` quando os dados não bastam pra um link que funcione."""

    def pertence(self, link: str) -> bool:
        """Se um link (ex.: `linkSistemaOrigem` do PNCP) é desta plataforma —
        é o que filtra a busca textual pra plataforma escolhida."""

        return any(dominio in link for dominio in self.dominios)


class ComprasGov(Plataforma):
    id = "compras_gov"
    nome = "Compras.gov.br"
    dominios = ("compras.gov.br", "comprasnet", "cnetmobile.estaleiro.serpro.gov.br")

    def criar_client(self) -> ComprasGovClient:
        return ComprasGovClient()

    def montar_link(self, contratacao: dict[str, Any]) -> str | None:
        return montar_link_compras_gov(contratacao)


PLATAFORMAS: dict[str, Plataforma] = {p.id: p for p in (ComprasGov(),)}


def plataforma_padrao() -> Plataforma:
    return PLATAFORMAS["compras_gov"]


def identificar_plataforma(link: str | None) -> Plataforma | None:
    """Plataforma registrada a que um link (ex.: `linkSistemaOrigem` do PNCP)
    pertence — `None` para link vazio ou de plataforma ainda não registrada."""

    if not link:
        return None
    for plataforma in PLATAFORMAS.values():
        if plataforma.pertence(link):
            return plataforma
    return None
