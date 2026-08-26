"""Cliente para a busca pública do PNCP (pncp.gov.br).

Por que existe: nenhuma das APIs *documentadas* tem busca textual. A varredura
da spec do compras.gov.br achou 3 parâmetros de texto, nenhum aplicável, e o
`descricaoItem` do catálogo devolve zero para qualquer termo (ver docs/DOMINIO.md).

Mas o site `pncp.gov.br/app/editais` tem uma caixa de busca que funciona por
palavra. Ela é servida por `/api/search/`, um endpoint público que não consta
nos manuais — é o índice de texto do próprio portal. Com ele a busca por
palavra deixa de depender do catálogo de PDM e passa a casar com o objeto do
edital.

O pipeline fica:

1. `/api/search/?q=café` -> editais cujo texto casa com a palavra
2. `/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens` -> itens de cada um

Como o endpoint não é documentado, os nomes de campo podem mudar sem aviso.
Por isso todo campo é lido com uma lista de apelidos (`_primeiro`) e a ausência
de um campo nunca derruba a busca. Se o endpoint sumir de vez,
`apps/licitacoes/services.py` cai de volta no índice de PDM.

Portado do protótipo (branch `claude/tenta-de-novo-xu2sxb`,
`app/clients/pncp.py`), incluindo as defesas já aplicadas contra a
desconexão observada em 23/08/2026 (ver `docs/DOMINIO.md`): headers de
navegador e um retry em desconexão transitória. A causa raiz da desconexão
**não** foi fechada — isso é trabalho de uma sessão futura dedicada a isso.
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from config.settings.environment import env

# O portal recusa páginas grandes na busca; 10 a 50 é a faixa que a tela usa.
TAM_PAGINA_MIN = 10
TAM_PAGINA_MAX = 50

# `status` da busca: só o que ainda aceita proposta interessa a quem vai vender.
STATUS_RECEBENDO = "recebendo_proposta"
STATUS_TODOS = "todos"

# Cabeçalhos equivalentes aos que o navegador manda ao usar a caixa de busca do
# portal. Não é disfarce: é o mesmo endpoint público, chamado do mesmo jeito.
# Servidores públicos com WAF na frente às vezes derrubam a conexão de cliente
# sem User-Agent de navegador em vez de responder um erro — foi um dos suspeitos
# do "Server disconnected" observado em 23/08/2026.
CABECALHOS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Referer": "https://pncp.gov.br/app/editais",
}

# O portal derruba conexão esporadicamente. Uma repetição resolve o caso
# transitório sem mascarar defeito de verdade: se cair duas vezes, é erro.
TENTATIVAS = 2
ESPERA_ENTRE_TENTATIVAS = 1.0


class PncpClientError(RuntimeError):
    pass


def _tam_pagina_valido(tamanho: int) -> int:
    return max(TAM_PAGINA_MIN, min(TAM_PAGINA_MAX, tamanho))


def _primeiro(dados: dict[str, Any], *chaves: str) -> Any:
    """Primeiro valor não-vazio entre os apelidos possíveis do campo."""

    for chave in chaves:
        valor = dados.get(chave)
        if valor not in (None, "", []):
            return valor
    return None


class PncpClient:
    def __init__(self, base_url: str | None = None, timeout: float = 60.0) -> None:
        self.base_url = (base_url or env.pncp_base_url).rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            follow_redirects=True,
            headers=CABECALHOS,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PncpClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def _get(self, caminho: str, params: dict[str, Any]) -> Any:
        resp = self._get_com_repeticao(caminho, params)

        try:
            return resp.json()
        except ValueError as exc:
            raise PncpClientError(f"Resposta inválida (não-JSON) em {caminho}") from exc

    def _get_com_repeticao(self, caminho: str, params: dict[str, Any]) -> httpx.Response:
        """Repete uma vez quando o servidor derruba a conexão sem responder.

        Só a desconexão é repetida. Erro de status (400, 404, 500) é resposta do
        servidor: repetir daria o mesmo resultado e só atrasaria o usuário.
        """

        for tentativa in range(1, TENTATIVAS + 1):
            try:
                resp = self._client.get(caminho, params=params)
                resp.raise_for_status()
                return resp
            except httpx.HTTPStatusError as exc:
                raise PncpClientError(
                    f"PNCP respondeu {exc.response.status_code} em {caminho}: "
                    f"{exc.response.text[:300]}"
                ) from exc
            except (httpx.RemoteProtocolError, httpx.ReadError) as exc:
                if tentativa == TENTATIVAS:
                    raise PncpClientError(
                        f"O PNCP derrubou a conexão em {caminho} "
                        f"({TENTATIVAS} tentativas): {exc}"
                    ) from exc
                time.sleep(ESPERA_ENTRE_TENTATIVAS)
            except httpx.HTTPError as exc:
                raise PncpClientError(f"Falha ao consultar o PNCP: {exc}") from exc

        raise AssertionError("inalcançável")  # pragma: no cover

    def buscar_editais(
        self,
        termo: str,
        *,
        pagina: int = 1,
        tamanho_pagina: int = TAM_PAGINA_MAX,
        status: str = STATUS_RECEBENDO,
        uf: str | None = None,
        codigo_modalidade: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Busca editais por palavra. Retorna (contratações, total de registros).

        As contratações saem no mesmo formato de `compras_gov._normalizar_contratacao`,
        para o resto da aplicação não precisar saber de onde vieram.
        """

        params: dict[str, Any] = {
            "q": termo,
            "tipos_documento": "edital",
            "ordenacao": "-data",
            "pagina": pagina,
            "tam_pagina": _tam_pagina_valido(tamanho_pagina),
            "status": status,
        }
        if uf:
            params["ufs"] = uf.upper()
        if codigo_modalidade:
            params["modalidades"] = codigo_modalidade

        payload = self._get("/api/search/", params)
        itens, total = _extrair_lista(payload)
        return [_normalizar_edital(e) for e in itens], total

    def listar_itens(
        self,
        *,
        cnpj: str,
        ano: str | int,
        sequencial: str | int,
        tamanho_pagina: int = TAM_PAGINA_MAX,
    ) -> list[dict[str, Any]]:
        """Itens de uma contratação, pela API de consulta do PNCP."""

        payload = self._get(
            f"/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens",
            {"pagina": 1, "tamanhoPagina": _tam_pagina_valido(tamanho_pagina)},
        )
        itens, _ = _extrair_lista(payload)
        return [_normalizar_item(i) for i in itens]


def _extrair_lista(payload: Any) -> tuple[list[dict[str, Any]], int]:
    """A lista de resultados muda de nome conforme o endpoint; acha onde estiver."""

    if isinstance(payload, list):
        return payload, len(payload)
    if not isinstance(payload, dict):
        return [], 0

    for chave in ("items", "data", "resultado", "content", "registros"):
        valor = payload.get(chave)
        if isinstance(valor, list):
            total = _primeiro(payload, "total", "totalRegistros", "totalElements")
            return valor, int(total) if isinstance(total, (int, float)) else len(valor)
    return [], 0


def _normalizar_edital(e: dict[str, Any]) -> dict[str, Any]:
    """Converte um resultado da busca no formato de contratação da aplicação."""

    cnpj = _primeiro(e, "orgao_cnpj", "orgaoCnpj", "cnpj")
    ano = _primeiro(e, "ano", "anoCompra")
    sequencial = _primeiro(e, "numero_sequencial", "numeroSequencial", "sequencialCompra")
    numero = _primeiro(e, "numero", "numeroCompra")
    uasg = _primeiro(e, "unidade_codigo", "unidadeCodigo", "codigoUnidade")

    return {
        "id_compra": _montar_id_compra(uasg, numero, ano),
        "numero_controle_pncp": _primeiro(e, "numero_controle_pncp", "numeroControlePNCP", "id"),
        "uasg": uasg,
        "orgao_nome": _primeiro(e, "unidade_nome", "unidadeNome", "orgao_nome", "orgaoNome"),
        "cnpj_orgao": cnpj,
        "uf": _primeiro(e, "uf", "unidade_uf", "ufSigla"),
        "municipio": _primeiro(e, "municipio_nome", "municipioNome"),
        "numero_compra": numero,
        "ano_compra": ano,
        "sequencial_compra": sequencial,
        "modalidade": _primeiro(e, "modalidade_licitacao_nome", "modalidadeNome"),
        "codigo_modalidade": _primeiro(e, "modalidade_licitacao_id", "codigoModalidade"),
        "objeto": _primeiro(e, "description", "objetoCompra", "objeto", "title"),
        "situacao": _primeiro(e, "situacao_nome", "situacaoNome"),
        "srp": e.get("srp"),
        "valor_total_estimado": _primeiro(e, "valor_global", "valorTotalEstimado"),
        "data_publicacao": _so_data(_primeiro(e, "data_publicacao_pncp", "created_at")),
        "data_abertura_proposta": _so_data(_primeiro(e, "data_inicio_vigencia", "dataAberturaProposta")),
        "data_encerramento_proposta": _so_data(
            _primeiro(e, "data_fim_vigencia", "dataEncerramentoProposta")
        ),
        "raw_json": json.dumps(e, ensure_ascii=False),
    }


def _normalizar_item(i: dict[str, Any]) -> dict[str, Any]:
    """A API do PNCP traz uma descrição só, sem o par resumida/detalhada."""

    descricao = _primeiro(i, "descricao", "descricaoResumida", "descricaodetalhada")
    return {
        "id_compra_item": _primeiro(i, "numeroItem", "idCompraItem"),
        "numero_item": _primeiro(i, "numeroItem", "numeroItemCompra"),
        "descricao_resumida": descricao,
        "descricao_detalhada": _primeiro(i, "descricaodetalhada", "informacaoComplementar") or descricao,
        "material_ou_servico": _primeiro(i, "materialOuServicoNome", "materialOuServico"),
        "quantidade": i.get("quantidade"),
        "unidade_medida": _primeiro(i, "unidadeMedida", "unidadeFornecimento"),
        "valor_unitario_estimado": _primeiro(i, "valorUnitarioEstimado", "valorUnitario"),
        "valor_total": i.get("valorTotal"),
        "situacao": _primeiro(i, "situacaoCompraItemNome", "situacaoCompraItem"),
        "criterio_julgamento": _primeiro(i, "criterioJulgamentoNome", "criterioJulgamento"),
        "tipo_beneficio": _primeiro(i, "beneficioNome", "tipoBeneficioNome"),
        "tem_resultado": i.get("temResultado"),
    }


def _montar_id_compra(uasg: Any, numero: Any, ano: Any) -> str | None:
    """O `idCompra` do compras.gov.br é UASG(6) + número da compra(5) + ano(4).

    Confirmado contra os dados reais da API. A busca do PNCP não devolve esse
    campo, mas devolve as três partes — remontamos para manter o link do
    Comprasnet funcionando.
    """

    if not (uasg and numero and ano):
        return None
    try:
        return f"{int(uasg):06d}{int(numero):05d}{int(ano):04d}"
    except (TypeError, ValueError):
        return None


def _so_data(valor: Any) -> str | None:
    if not valor or not isinstance(valor, str):
        return None
    return valor.split(" ")[0].split("T")[0]
