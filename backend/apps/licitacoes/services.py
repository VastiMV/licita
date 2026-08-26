"""Orquestra a busca "por item" de oportunidades (ver docs/DOMINIO.md, "Busca
de oportunidades" e "Busca textual — camadas").

A busca por palavra tem dois caminhos, tentados nesta ordem:

**1. Busca textual do PNCP** (`apps/integracoes/clients/pncp.py`) — o endpoint
por trás da caixa de busca de pncp.gov.br/app/editais. Casa a palavra com o
*objeto do edital*. É o caminho preferido: pega material e serviço, e não
depende do catálogo local.

**2. Catálogo local de PDM** (`apps/catalogo/search.py`) — mantido como
reserva porque o endpoint do PNCP não é documentado e pode mudar sem aviso.
A view resolve a palavra em códigos de PDM (camadas 1+2 da busca por
similaridade) *antes* de chamar `buscar_oportunidades` — este módulo só
consome `codigos_pdm` já resolvidos.

A reserva entra sozinha quando o PNCP falha ou devolve vazio. Ela só cobre
material, então acha menos coisa que a busca textual.

Sem palavra-chave, o modo é de navegação: lista as contratações do período
(por modalidade/UF) e seus itens — não depende de PNCP nem de catálogo.

Portado do protótipo (branch `claude/tenta-de-novo-xu2sxb`, `app/oportunidades.py`),
já validado contra as APIs reais.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from config.settings.environment import env

from apps.integracoes.clients.compras_gov import (
    MODALIDADE_CONTRATACOES_PARA_PNCP,
    ComprasGovClient,
    ComprasGovClientError,
    montar_link_compras_gov,
    montar_link_pncp,
    normalizar,
)
from apps.integracoes.clients.pncp import PncpClient, PncpClientError

logger = logging.getLogger(__name__)

MAX_CODIGOS_CATALOGO = 25  # códigos PDM inspecionados por busca
MAX_CONTRATACOES = 60  # teto de contratações no modo navegação
MAX_COMPRAS_DETALHADAS = 100  # teto de contratações detalhadas na busca por palavra
# Pendência de performance anotada em docs/DOMINIO.md: termo genérico ("cafe")
# levava ~2min, porque MAX_EDITAIS_PNCP editais viravam MAX_EDITAIS_PNCP
# chamadas de listar_itens, rodando em rodadas de MAX_WORKERS por vez. Editais
# reduzidos de 50 -> 20 e workers de 8 -> 20 deixa isso numa rodada só (contra
# ~7 antes), sem trocar o contrato da API nem da tela.
MAX_WORKERS = 20
MAX_EDITAIS_PNCP = 20  # editais trazidos por busca textual (a 1ª página do portal traz até 50)


class BuscaSemCorrespondenciaNoCatalogo(Exception):
    """A palavra-chave não casou com nenhum item do catálogo de materiais."""


def buscar_oportunidades(
    client: ComprasGovClient,
    *,
    data_inicial: str,
    data_final: str,
    codigo_modalidade: str = "",
    palavra_chave: str = "",
    codigos_pdm: list[int] | None = None,
    uf: str | None = None,
    codigo_unidade: str | None = None,
    pncp_client: PncpClient | None = None,
) -> list[dict[str, Any]]:
    termo = palavra_chave.strip()
    if not termo:
        return _navegar_contratacoes(
            client,
            data_inicial=data_inicial,
            data_final=data_final,
            # "5" = Pregão Eletrônico NESTA tabela (MODALIDADES_CONTRATACOES
            # em integracoes/clients/compras_gov.py) — não confundir com "6",
            # que é o código do PNCP para a mesma modalidade. Usar o código
            # errado aqui filtra silenciosamente por Dispensa (visto na
            # prática: causava o link "abrir no compras.gov.br" sempre dar
            # 404, porque Dispensa não tem sessão de disputa ao vivo).
            codigo_modalidade=codigo_modalidade or "5",
            uf=uf,
            codigo_unidade=codigo_unidade,
        )

    # Caminho preferido: busca textual do portal do PNCP.
    if env.usar_busca_pncp:
        try:
            resultados = _buscar_no_pncp(
                termo,
                data_inicial=data_inicial,
                data_final=data_final,
                codigo_modalidade=codigo_modalidade,
                uf=uf,
                codigo_unidade=codigo_unidade,
                pncp_client=pncp_client,
            )
        except PncpClientError as exc:
            # O endpoint não é documentado: se sumir ou mudar, a busca continua
            # pela reserva em vez de estourar na cara do usuário.
            logger.warning("Busca no PNCP falhou (%s); usando o índice de catálogo.", exc)
        else:
            # `None` = o PNCP não respondeu com editais; lista (mesmo vazia) = ele
            # respondeu, e a resposta vale — inclusive quando os filtros zeram.
            if resultados is not None:
                return resultados
            logger.info('Busca no PNCP não achou "%s"; tentando o índice de catálogo.', termo)

    # Reserva: códigos de PDM já resolvidos pela camada de busca do catálogo.
    if not codigos_pdm:
        raise BuscaSemCorrespondenciaNoCatalogo(palavra_chave)
    return _buscar_por_pdms(
        client,
        codigos_pdm=codigos_pdm,
        data_inicial=data_inicial,
        data_final=data_final,
        codigo_modalidade=codigo_modalidade,
        uf=uf,
        codigo_unidade=codigo_unidade,
    )


def _buscar_no_pncp(
    termo: str,
    *,
    data_inicial: str,
    data_final: str,
    codigo_modalidade: str,
    uf: str | None,
    codigo_unidade: str | None,
    pncp_client: PncpClient | None = None,
) -> list[dict[str, Any]] | None:
    """Busca editais pelo texto no PNCP e desdobra cada um em oportunidades.

    Devolve `None` quando a busca não achou edital nenhum — aí vale tentar o
    índice de catálogo, que indexa outra coisa (nome de material/categoria,
    não objeto do edital) e pode achar o que o texto não achou. Devolve lista
    quando a busca achou: nesse caso a resposta é essa, mesmo que os filtros
    de UF/unidade deixem a lista vazia. Confundir os dois faria um filtro
    restritivo disparar uma segunda busca inútil.
    """

    proprio = pncp_client is None
    cliente = pncp_client or PncpClient()
    try:
        editais, _ = cliente.buscar_editais(
            termo,
            tamanho_pagina=MAX_EDITAIS_PNCP,
            uf=uf,
            # Traduzido: o código vem na tabela de `MODALIDADES_CONTRATACOES`
            # (dropdown do frontend / compras.gov.br), mas este endpoint
            # espera a tabela `MODALIDADES` do PNCP — ver comentário na
            # tradução. Código desconhecido (não deveria acontecer, o
            # dropdown só manda os 4 mapeados) cai em "sem filtro" em vez de
            # filtrar errado.
            codigo_modalidade=MODALIDADE_CONTRATACOES_PARA_PNCP.get(codigo_modalidade)
            if codigo_modalidade
            else None,
        )
        if not editais:
            return None

        editais = [e for e in editais if e.get("cnpj_orgao") and e.get("ano_compra")][
            :MAX_EDITAIS_PNCP
        ]
        if codigo_unidade:
            editais = [e for e in editais if (e.get("uasg") or "") == codigo_unidade]
        editais = [e for e in editais if _publicado_no_periodo(e, data_inicial, data_final)]
        if not editais:
            return []

        def itens_seguros(edital: dict[str, Any]) -> list[dict[str, Any]]:
            # Sem sequencial não há como montar o caminho dos itens; o edital
            # ainda aparece (uma linha, com o objeto), só não desdobra.
            if not edital.get("sequencial_compra"):
                return []
            try:
                return cliente.listar_itens(
                    cnpj=edital["cnpj_orgao"],
                    ano=edital["ano_compra"],
                    sequencial=edital["sequencial_compra"],
                )
            except PncpClientError:
                logger.warning("Falha ao listar itens do edital %s", edital.get("numero_controle_pncp"))
                return []

        oportunidades: list[dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            for edital, itens in zip(editais, pool.map(itens_seguros, editais)):
                oportunidades.extend(_itens_relevantes(edital, itens, termo))
        return oportunidades
    finally:
        if proprio:
            cliente.close()


def _publicado_no_periodo(edital: dict[str, Any], inicial: str, final: str) -> bool:
    """Aplica o período da tela ao resultado da busca textual.

    O buscador do portal filtra por situação ("recebendo proposta"), não por
    faixa de data, então o recorte é feito aqui. É deliberadamente tolerante:
    edital sem data de publicação legível **fica**.
    """

    publicacao = edital.get("data_publicacao")
    if not publicacao:
        return True
    if inicial and publicacao < inicial:
        return False
    if final and publicacao > final:
        return False
    return True


def _itens_relevantes(
    edital: dict[str, Any], itens: list[dict[str, Any]], termo: str
) -> list[dict[str, Any]]:
    """Prioriza os itens que citam a palavra; se nenhum cita, devolve todos."""

    alvo = normalizar(termo)
    if not itens:
        return [_montar_oportunidade(edital, {})]

    casam = [
        i
        for i in itens
        if alvo in normalizar(f"{i.get('descricao_resumida') or ''} {i.get('descricao_detalhada') or ''}")
    ]
    return [_montar_oportunidade(edital, i) for i in (casam or itens)]


def _buscar_por_pdms(
    client: ComprasGovClient,
    *,
    codigos_pdm: list[int],
    data_inicial: str,
    data_final: str,
    codigo_modalidade: str,
    uf: str | None,
    codigo_unidade: str | None,
) -> list[dict[str, Any]]:
    def itens_do_pdm(codigo: int) -> list[dict[str, Any]]:
        try:
            return client.buscar_itens_por_pdm(
                codigo_pdm=codigo,
                data_inicial=data_inicial,
                data_final=data_final,
            )
        except ComprasGovClientError:
            logger.warning("Falha ao buscar itens do PDM %s", codigo)
            return []

    itens: list[dict[str, Any]] = []
    vistos: set[tuple] = set()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for lote in pool.map(itens_do_pdm, codigos_pdm[:MAX_CODIGOS_CATALOGO]):
            for item in lote:
                chave = (item.get("id_compra"), item.get("id_compra_item"), item.get("numero_item"))
                if chave in vistos:
                    continue
                vistos.add(chave)
                itens.append(item)

    if not itens:
        return []

    ids_compra = list(dict.fromkeys(i["id_compra"] for i in itens if i.get("id_compra")))
    contratacoes = _detalhar_em_paralelo(client, ids_compra[:MAX_COMPRAS_DETALHADAS])

    oportunidades = []
    for item in itens:
        contratacao = contratacoes.get(item.get("id_compra"))
        if not contratacao:
            continue
        if not _passa_nos_filtros(contratacao, codigo_modalidade, uf, codigo_unidade):
            continue
        oportunidades.append(_montar_oportunidade(contratacao, item))

    return oportunidades


def _navegar_contratacoes(
    client: ComprasGovClient,
    *,
    data_inicial: str,
    data_final: str,
    codigo_modalidade: str,
    uf: str | None,
    codigo_unidade: str | None,
) -> list[dict[str, Any]]:
    contratacoes, _ = client.buscar_contratacoes(
        data_publicacao_inicial=data_inicial,
        data_publicacao_final=data_final,
        codigo_modalidade=codigo_modalidade,
        uf=uf,
        codigo_unidade=codigo_unidade,
        tamanho_pagina=MAX_CONTRATACOES,
    )
    candidatas = [c for c in contratacoes if c.get("id_compra")][:MAX_CONTRATACOES]

    def itens_seguros(contratacao: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            return client.listar_itens(contratacao["id_compra"])
        except ComprasGovClientError:
            logger.warning("Falha ao buscar itens da compra %s", contratacao.get("id_compra"))
            return []

    oportunidades = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for contratacao, itens in zip(candidatas, pool.map(itens_seguros, candidatas)):
            for item in itens:
                oportunidades.append(_montar_oportunidade(contratacao, item))

    return oportunidades


def _detalhar_em_paralelo(
    client: ComprasGovClient, ids_compra: list[str]
) -> dict[str, dict[str, Any]]:
    def detalhar(id_compra: str) -> tuple[str, dict[str, Any] | None]:
        try:
            return id_compra, client.detalhar_contratacao(id_compra)
        except ComprasGovClientError:
            logger.warning("Falha ao detalhar a compra %s", id_compra)
            return id_compra, None

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        return {id_: c for id_, c in pool.map(detalhar, ids_compra) if c}


def _passa_nos_filtros(
    contratacao: dict[str, Any],
    codigo_modalidade: str,
    uf: str | None,
    codigo_unidade: str | None,
) -> bool:
    if uf and (contratacao.get("uf") or "").upper() != uf.upper():
        return False
    if codigo_unidade and (contratacao.get("uasg") or "") != codigo_unidade:
        return False
    if codigo_modalidade and str(contratacao.get("codigo_modalidade") or "") != str(codigo_modalidade):
        return False
    return True


def _montar_oportunidade(contratacao: dict[str, Any], item: dict[str, Any]) -> dict[str, Any]:
    return {
        **{f"contratacao_{k}": v for k, v in contratacao.items() if k != "raw_json"},
        "numero_item": item.get("numero_item"),
        "descricao_resumida": item.get("descricao_resumida"),
        "descricao_detalhada": item.get("descricao_detalhada"),
        "material_ou_servico": item.get("material_ou_servico"),
        "quantidade": item.get("quantidade"),
        "unidade_medida": item.get("unidade_medida"),
        "valor_unitario_estimado": item.get("valor_unitario_estimado"),
        "valor_total": item.get("valor_total"),
        "situacao_item": item.get("situacao"),
        "criterio_julgamento": item.get("criterio_julgamento"),
        "tipo_beneficio": item.get("tipo_beneficio"),
        "link_compras_gov": montar_link_compras_gov(contratacao),
        "link_pncp": montar_link_pncp(contratacao),
    }
