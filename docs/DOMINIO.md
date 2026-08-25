# Domínio

Extraído do protótipo (branches `claude/siga-pregao-tool-6o8zbs` /
`claude/tenta-de-novo-xu2sxb`), que validou o domínio contra as APIs reais do
PNCP e do compras.gov.br. Esta é a base para os models Django — os nomes de
campo do protótipo (SQLAlchemy/SQLite) estão mantidos como referência, com o
que muda para uma stack multiusuário sinalizado.

## Entidades

### `Pdm` — Padrão Descritivo de Material
Índice local do catálogo oficial de materiais do compras.gov.br. A API não
tem busca textual utilizável sobre o catálogo, então o catálogo inteiro
(~20 mil registros, 41 páginas de 500) é baixado e indexado localmente para
permitir busca por nome de produto.

| Campo | Tipo | Observação |
|---|---|---|
| `codigo_pdm` | int (PK) | código do produto no catálogo oficial |
| `nome_pdm` | string | nome como veio da API |
| `nome_normalizado` | string, indexado | caixa alta, sem acento — usado na busca |
| `codigo_classe`, `nome_classe` | int / string, opcionais | |
| `codigo_grupo`, `nome_grupo` | int / string, opcionais | |
| `atualizado_em` | datetime | |

Alimentado por uma task periódica (`sincronizar_catalogo`), não por escrita de
usuário.

### `Licitacao`
Cache local de uma licitação/contratação já vista, identificada por
`uasg + modalidade + numero`.

| Campo | Tipo |
|---|---|
| `id` | string (PK) — `f"{uasg}-{modalidade}-{numero}"` |
| `uasg`, `uasg_nome` | string |
| `modalidade`, `numero_aviso` | string |
| `objeto` | text |
| `situacao`, `uf` | string |
| `data_publicacao`, `data_abertura_proposta` | string (a API devolve como texto) |
| `link_edital` | string — número de controle PNCP |
| `raw_json` | text — payload bruto da API, para reprocessamento sem nova chamada |
| `primeira_vez_em`, `atualizada_em` | datetime |

A busca de **oportunidades item a item** (tela principal do protótipo) não
persiste — é consulta ao vivo em `ComprasGovClient`/`PncpClient`, cruzada com
`Pdm` quando há palavra-chave. Ver "Busca de oportunidades" abaixo.

### `Filtro`
Critério salvo por um usuário para monitorar novas licitações.

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string | |
| `palavras_chave` | string | separadas por vírgula no protótipo — DRF: `ArrayField` ou M2M com tabela de termos |
| `uf`, `modalidade`, `uasg` | string, opcionais | |
| `ativo` | bool | |
| `email_notificacao` | string | **no protótipo é texto livre; na stack nova vira FK para o usuário autenticado**, com e-mail alternativo opcional |
| `criado_em` | datetime | |
| `owner` | FK `User` | **novo** — o protótipo não tinha autenticação; multiusuário exige dono |

### `Alerta`
Registro de que um `Filtro` casou com uma `Licitacao` nova.

| Campo | Tipo |
|---|---|
| `filtro` | FK `Filtro` |
| `licitacao` | FK `Licitacao` |
| `criado_em` | datetime |
| `email_enviado` | bool |

## Regras de negócio confirmadas contra as APIs reais

Custou várias sessões para validar — tratar como restrição de design, não
reabrir a investigação:

- **`compras.gov.br` não tem busca textual sobre o catálogo.**
  `descricaoItem` devolve zero resultados para qualquer termo, mesmo exato.
  Todo o mecanismo do `Pdm` existe para contornar isso.
- **Paginação da API é limitada a 10–500 itens por página**
  (`tamanhoPagina`); fora da faixa, HTTP 400.
- **O PNCP tem busca textual não documentada**, usada pela tela
  `pncp.gov.br/app/editais`: `GET /api/search/?q=...&tipos_documento=edital&status=...`.
  Essa é a via preferida para casar palavra-chave com o **objeto do edital**;
  o catálogo de `Pdm` é o *fallback* quando o PNCP não responde ou não acha
  nada.
- **Precisa de rede real para testar** — ambientes de sandbox costumam
  bloquear `pncp.gov.br` e `dadosabertos.compras.gov.br` na camada de proxy.

### Busca de oportunidades (fluxo, não persiste)

1. Usuário informa palavra-chave (opcional), UF, modalidade, UASG, período.
2. Se há palavra-chave: tenta casar no objeto do edital via busca textual do
   PNCP.
3. Se o PNCP não responde ou não acha nada, cai para o índice local de `Pdm`
   — a palavra vira um ou mais `codigo_pdm`, que filtram a chamada ao
   compras.gov.br.
4. Resultado é por **item da contratação** (não a contratação inteira):
   número do item, descrição, quantidade, valor unitário/total estimado,
   link para abrir a compra no compras.gov.br e o edital no PNCP.

## Integrações externas (async, via Celery)

| Integração | Uso |
|---|---|
| `compras.gov.br` (`dadosabertos.compras.gov.br`) | catálogo de materiais (PDM), contratações/itens |
| PNCP (`pncp.gov.br/api/...`) | busca textual de editais, itens da contratação |
| E-mail (provedor a definir) | notificação de `Alerta` |

## O que muda do protótipo para a stack de produção

- **Autenticação multiusuário** — `Filtro` passa a ter dono; API protegida
  (DRF + JWT ou sessão).
- **Agendamento sai do processo da app** (`APScheduler` embutido) **e vira
  Celery Beat**, para sobreviver a réplicas efêmeras do pod da API.
- **SQLite → PostgreSQL**, com `raw_json` como `JSONField` nativo em vez de
  texto serializado.
- **Envio de e-mail e chamadas às APIs externas viram tasks Celery**
  assíncronas, nunca bloqueando o request HTTP.
