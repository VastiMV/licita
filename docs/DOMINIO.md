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
| `nome_normalizado` | string, indexado (trigram) | caixa alta, sem acento — busca por produto (camada 1) |
| `codigo_classe`, `nome_classe` | int / string, opcionais | |
| `nome_classe_normalizado` | string, indexado (trigram), opcional | busca por categoria (camada 2) |
| `codigo_grupo`, `nome_grupo` | int / string, opcionais | |
| `nome_grupo_normalizado` | string, indexado (trigram), opcional | busca por categoria (camada 2) |
| `atualizado_em` | datetime | |

Tabela única, denormalizada de propósito — sem `Grupo`/`Grupo` como tabelas à
parte. Em ~20 mil linhas, um JOIN não compensa o ganho de normalização, e a
busca interativa fica mais rápida lendo uma tabela só. Ver "Busca textual —
camadas" abaixo para o motivo dos três índices trigram.

Alimentado por uma task periódica (`sincronizar_catalogo_pdm`, Celery Beat),
não por escrita de usuário — e por um `management command` equivalente
(`sincronizar_catalogo`) para rodar fora do agendamento.

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
2. Sem palavra-chave: modo navegação — lista as contratações do período pela
   modalidade escolhida, sem depender de PNCP nem de `Pdm`.
3. Com palavra-chave: tenta casar no objeto do edital via busca textual do
   PNCP.
4. Se o PNCP não responde ou não acha nada, cai para a busca em `Pdm` (ver
   "Busca textual — camadas" abaixo) — a palavra vira um ou mais
   `codigo_pdm`, que filtram a chamada ao compras.gov.br.
5. Resultado é por **item da contratação** (não a contratação inteira):
   número do item, descrição, quantidade, valor unitário/total estimado,
   link para abrir a compra no compras.gov.br e o edital no PNCP.

### Busca textual — camadas

Decisão de arquitetura (25/08/2026): a busca por palavra-chave é
**determinística, em camadas — nunca um agente de IA decidindo livremente**.
Um agente com uma tool de busca no banco pode inventar/citar um código de
PDM que não existe, é não-determinístico (quebra o padrão de testes sem rede
já estabelecido — ver "Estratégia de testes" em `docs/ARQUITETURA.md`), e
adiciona latência/custo por busca numa tela que responde ao vivo. Nenhuma das
camadas abaixo gera texto livre: todas apenas ranqueiam linhas que já existem
de verdade no catálogo.

1. **Busca textual do PNCP** — objeto do edital, ver acima. Cobre material e
   serviço, mas depende de um endpoint não documentado (ver "Precisa de rede
   real para testar" acima e o histórico de instabilidade nos branches do
   protótipo).
2. **Catálogo local (`Pdm`), por similaridade** — quando o PNCP falha ou não
   acha nada. Dois casos, cobertos pelos três índices trigram (`pg_trgm`) do
   model:
   - **Erro de digitação / variação** ("cafe" vs "café" vs "cafezinho"):
     casa contra `nome_normalizado` (nome do produto).
   - **Categoria, não produto** ("material de escritório" quando o catálogo
     tem "CAFÉ", "PAPEL A4" etc. como PDMs individuais, agrupados sob uma
     classe/grupo do próprio governo): casa contra `nome_classe_normalizado`/
     `nome_grupo_normalizado`. Aproveita a categorização que a API já
     entrega — sem manter um dicionário de sinônimos próprio (trabalho que
     cabe a quem já cataloga isso oficialmente, não a este sistema).
   Só cobre material — catálogo de serviço tem estrutura própria, não
   integrada.
3. **Busca semântica por embedding — fora do escopo da primeira versão.**
   Fecha o caso que trigram não cobre: termo sem raiz textual em comum com o
   nome do produto/categoria (ex.: "bebida quente de escritório" → "café").
   Desenho já decidido, implementação futura:
   - O modelo de embedding roda num **pod separado** (não no backend/worker
     Django) — isola o consumo de memória do peso do modelo e permite
     escalar/trocar o modelo sem tocar no resto. Candidato a fine-tuning
     posterior para o vocabulário de licitação em português.
   - O vetor de cada `Pdm` é calculado **uma vez, no sync do catálogo**
     (task assíncrona), não por busca — a busca interativa só embeda o termo
     do usuário (uma chamada rápida ao pod) e faz *nearest neighbor* contra
     vetores já salvos.
   - Exige a extensão `pgvector` no Postgres (não instalada ainda — checar
     antes de implementar) e uma coluna de vetor em `Pdm`.
   - Como as camadas 1+2 já resolvem a maior parte dos casos reais, essa
     camada só entra se o uso mostrar que ainda sobra volume relevante de
     buscas por categoria/sinônimo que trigram não pega.

## Integrações externas (async, via Celery)

| Integração | Uso |
|---|---|
| `compras.gov.br` (`dadosabertos.compras.gov.br`) | catálogo de materiais (PDM), contratações/itens |
| PNCP (`pncp.gov.br/api/...`) | busca textual de editais, itens da contratação |
| E-mail (provedor a definir) | notificação de `Alerta` |

O sync do catálogo (~41 páginas de 500 registros) roda **sequencial, com um
intervalo entre páginas** (`catalogo_sync_intervalo_segundos` em
`Environment`) — de propósito mais lento que o necessário, para não gerar uma
rajada de requisições numa API pública e gratuita do governo.

Validado contra o cluster real (26/08/2026): sync completo trouxe **20.419
PDMs**, batendo com a estimativa. A busca por categoria (camada 2) também
confirmada com dado real — "material de escritório" (que não é nome de
nenhum PDM) achou os produtos certos via `nome_grupo`/`nome_classe`. Dois
achados novos:

- **O mirror `dadosabertos.compras.gov.br` tem defasagem de ~1 mês** em
  relação ao PNCP — uma janela de 30 dias no modo navegação veio vazia; 90
  dias trouxe resultado normal. Não é bug, é característica do mirror —
  o default de janela do modo navegação deve considerar isso.
- **A busca textual via PNCP era lenta para termo genérico** (~2min para
  "cafe", que casava ~50 editais e disparava uma chamada de itens por
  edital, em rodadas de 8 por vez). Corrigido em 26/08/2026 (relatado como
  bug pelo usuário): `MAX_EDITAIS_PNCP` 50 → 20 e `MAX_WORKERS` 8 → 20
  (`apps/licitacoes/services.py`) — mesma chamada, menos editais
  inspecionados e quase tudo numa rodada só de paralelismo em vez de ~7.
- **Este ambiente de sandbox alcançou `pncp.gov.br` e
  `dadosabertos.compras.gov.br` normalmente** (diferente do bloqueio
  relatado nas sessões do protótipo) — pode variar por sessão/ambiente,
  não tratar como garantido.
- **Achado crítico, 26/08/2026: o filtro `codigoModalidade` do
  compras.gov.br usa uma tabela de códigos diferente da tabela oficial do
  PNCP** que o protótipo documentou (`MODALIDADES` em
  `apps/integracoes/clients/compras_gov.py`). Nessa tabela do PNCP, "6" é
  Pregão Eletrônico; no filtro do compras.gov.br, "6" é **Dispensa** — e
  Dispensa não tem sessão de disputa ao vivo no Comprasnet, então o link
  "abrir no compras.gov.br" sempre dava 404 pra quem caía nesse default
  errado. Varridos os 13 códigos da tabela do PNCP contra um ano inteiro de
  dados reais: só 4 devolvem registro (`MODALIDADES_CONTRATACOES`, no mesmo
  módulo) — os outros 9 são aceitos pela API sem erro, mas nunca trazem
  nada. Corrigido o default do modo navegação (era "6", virou "5") e o
  dropdown do frontend. **Confirmado em 26/08/2026**: a busca textual do
  PNCP (`/api/search/`, parâmetro `modalidades`) usa a tabela "oficial" do
  PNCP (`MODALIDADES`), não a de `MODALIDADES_CONTRATACOES` — testado ao
  vivo variando o parâmetro e conferindo `modalidade_licitacao_nome` nos
  resultados ("5" só devolvia "Concorrência - Presencial", "6" só
  "Pregão - Eletrônico" etc.). Isso fazia o filtro de modalidade na busca
  por palavra filtrar pela modalidade errada sem erro nenhum — bug real
  relatado pelo usuário (selecionava uma modalidade específica e via
  resultado de outra). Corrigido com uma tabela de tradução,
  `MODALIDADE_CONTRATACOES_PARA_PNCP` em
  `apps/integracoes/clients/compras_gov.py`, aplicada em
  `apps/licitacoes/services.py::_buscar_no_pncp` antes de chamar o PNCP.

## O que muda do protótipo para a stack de produção

- **Autenticação multiusuário** — `Filtro` passa a ter dono; API protegida
  (DRF + JWT ou sessão).
- **Agendamento sai do processo da app** (`APScheduler` embutido) **e vira
  Celery Beat**, para sobreviver a réplicas efêmeras do pod da API.
- **SQLite → PostgreSQL**, com `raw_json` como `JSONField` nativo em vez de
  texto serializado.
- **Envio de e-mail e chamadas às APIs externas viram tasks Celery**
  assíncronas, nunca bloqueando o request HTTP.
