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

### `OportunidadeSalva`

Uma compra (edital) que alguém escolheu guardar para trabalhar depois — o
que o botão "Salvar oportunidade" do card grava. A busca continua sem
persistir nada; salvar é o único momento em que uma oportunidade vira
registro. Implementado em `apps/licitacoes/models.py`.

Duas decisões de produto moldam o model:

- **A lista é da empresa, não do usuário** (29/08/2026). Quem salvou fica
  registrado (`salva_por`), mas a oportunidade aparece para todos os
  usuários: o time trabalha a mesma lista. Não há filtro por dono em
  nenhuma consulta, e a unicidade é global — a mesma compra não entra duas
  vezes.
- **Excluir da lista não apaga o histórico.** O log precisa poder dizer "foi
  removida por fulano" *depois* da remoção, então excluir é remoção lógica
  (`removida_em`/`removida_por`). A unicidade vale só entre as ativas
  (`UniqueConstraint` com `condition=removida_em IS NULL`), o que permite
  salvar de novo depois — criando um registro novo, com log próprio, sem
  misturar com a história do anterior.

| Campo | Tipo | Observação |
|---|---|---|
| `cnpj_orgao`, `ano_compra`, `sequencial_compra` | string | identidade da compra no PNCP; a propriedade `chave` (`cnpj-ano-sequencial`) é a mesma que o card usa no frontend |
| `objeto`, `orgao_nome`, `uasg`, `uf`, `municipio`, `modalidade`, `situacao` | string | snapshot de exibição (a lista renderiza sem rechamar API) |
| `data_publicacao`, `data_encerramento_proposta` | date, nullable | a segunda é a base do status "expirada" |
| `valor_total_estimado` | decimal, nullable | soma dos itens; nulo se algum item não tiver valor (não soma parcial) |
| `plataforma_id`, `plataforma_nome`, `link_plataforma`, `link_pncp` | string | como estavam no momento do salvamento |
| `capag` | JSON, nullable | selo como estava ao salvar |
| `itens` | JSON | **snapshot** das linhas da busca daquele edital (formato de `OportunidadeSerializer`) — é com ele que o modal desenha o card sem ir na origem |
| `texto_busca` | text | objeto + descrição dos itens, normalizado; é o que a busca da tabela varre (sem índice: a consulta é substring, que btree não serve — se a lista crescer, copiar o `GinIndex`/`gin_trgm_ops` do `Pdm`) |
| `salva_por` | FK `User`, nullable | quem salvou (informação, não filtro) |
| `criada_em` | datetime | |
| `removida_em`, `removida_por` | datetime / FK `User`, nullable | remoção lógica |

Regras:

- **Status "expirada" é calculado, não gravado**: `data_encerramento_proposta
  < hoje` (nula = não expira). Nada de task pra marcar expirada. O que se
  grava é o *evento* de que o prazo venceu — uma vez só, ver o log abaixo.
- **Salvar é por edital/compra** (o card), não por item.
- **Salvar é só de ida.** O botão do card pede confirmação e não volta a ser
  um toggle: quem salvou tira a oportunidade pelo módulo de salvas. Sem
  isso, um clique repetido viraria log de cria/apaga/cria — e o histórico
  perderia o sentido. Salvar a mesma compra de novo é idempotente (devolve o
  registro existente, sem novo evento).
- **Prazo vencido não some da lista — fica destacado.** A linha da tabela
  aparece realçada e o card (na busca e no modal) mostra em texto que o
  prazo encerrou e que não é mais possível gerar proposta. Quando o módulo
  de propostas existir, é `expirada` que ele consulta para bloquear a ação e
  repetir essa mensagem — nada pode ser feito com uma oportunidade vencida.
- **Dados voláteis não vêm do snapshot**: documentos do edital, plataforma
  de origem e selo CAPAG são consultados ao abrir o modal, em
  `CompraDetalheView` (cacheado, ver `services.detalhar_compra_cacheada`).
  O snapshot é o que permite abrir sem esperar rede; a consulta é o que
  mantém atualizado o que muda.

Endpoints (`apps/licitacoes/urls.py`, todos `IsAuthenticated`):

| Rota | O quê |
|---|---|
| `GET /api/licitacoes/salvas/` | lista paginada (`page`, `page_size`), com `busca` (objeto + itens) e `ordering` por nome de coluna da tabela; devolve `count`/`results` mais `expiradas` (total do conjunto, base do aviso da tela) |
| `POST /api/licitacoes/salvas/` | payload = `itens` (o resultado da busca daquele edital) + `capag` + `plataforma`; o resumo é derivado no backend. Repetido = 200 com o registro existente |
| `DELETE /api/licitacoes/salvas/<id>/` | tira da lista (remoção lógica) |
| `DELETE /api/licitacoes/salvas/expiradas/` | tira todas as vencidas de uma vez (o link do aviso) |
| `GET /api/licitacoes/salvas/chaves/` | só as chaves das ativas — é como a busca sabe que um card já está salvo |
| `GET /api/licitacoes/salvas/<id>/eventos/` | o histórico (ver abaixo) |

Frontend: **"Oportunidades" virou menu de primeiro nível**, com "Pesquisar"
(a busca ao vivo, antigo módulo "Oportunidades") e "Salvas". A tela de
salvas é uma tabela (`shared/ui/data-table`) com busca, ordenação por
qualquer coluna e paginação — todas integradas ao endpoint, nunca em
memória. Linha com prazo vencido fica destacada, e o modal de visualização
mostra em texto que não é mais possível gerar proposta.

Colunas: **UASG, modalidade, cidade, publicação, prazo da proposta e valor
estimado**, mais um menu de ações por linha (visualizar/excluir). O objeto
do edital **não** é coluna — é longo demais e empurrava a tabela para fora
da tela; ele continua sendo o que a busca varre, aparece como dica (`title`)
na coluna de UASG e inteiro no modal. Pela mesma razão a cidade é cortada
com reticências (a UF nunca some) e as ações ficam num menu em vez de
botões soltos: a tabela tem que caber num monitor médio sem rolagem
horizontal — no celular ela vira uma lista de cartões rótulo/valor.

### Histórico da oportunidade salva (`EventoOportunidadeSalva`)

Toda oportunidade salva carrega um log detalhado. O **módulo que exibe esse
histórico ainda não existe** — o que existe é o banco, o endpoint e a
disciplina de escrever a história desde já (história não se reconstrói
depois). A tela prevista: um registro principal ("a oportunidade X, com a
descrição Y, foi salva dia tal por fulano") com um link "detalhes" que abre
a lista do que aconteceu, no estilo de um extrato de ligação.

| Campo | Tipo | Observação |
|---|---|---|
| `oportunidade` | FK `OportunidadeSalva` | sobrevive à remoção da lista (que é lógica) |
| `tipo` | choices | ver tabela abaixo |
| `descricao` | text | texto pronto para exibição ("Removida da lista por Gustavo.") |
| `autor` | FK `User`, nullable | nulo = evento do sistema |
| `dados` | JSON | espaço livre por tipo — é daqui que sai o link de "abrir a proposta" quando esse módulo existir (`{"proposta_id": 42}`), sem migração nova |
| `ocorrido_em` | datetime | ordem do extrato |

| `tipo` | Quando entra |
|---|---|
| `salva` | no `POST` — abre o histórico |
| `prazo_vencido` | quando a lista é servida e a oportunidade já passou do prazo sem ter esse evento (idempotente). Não há task periódica: o status é calculado, e a linha do log só precisa existir antes de alguém abrir o histórico |
| `removida` | na exclusão (individual ou em lote pelas vencidas) |
| `proposta_gerada` | **ainda não produzido** — declarado porque o log já é escrito no formato final; entra junto com o módulo de propostas |

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
   link para abrir a compra **na plataforma** (garantido em todo resultado —
   ver a decisão de produto de 28/08/2026 abaixo: só entra oportunidade da
   plataforma escolhida, com link de disputa) e o edital no PNCP.

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
| PNCP (`pncp.gov.br/api/...`) | busca textual de editais, itens/documentos/detalhe da contratação |
| Tesouro Transparente (`tesourotransparente.gov.br/ckan/...`) | notas CAPAG (município/estado) — `apps/capag` |
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
- **Achado, 26/08/2026: além de `/api/search/` (não documentado, usado pra
  busca textual) e `/api/pncp/v1/orgaos/...` (não documentado, usado pra
  itens), o PNCP tem uma terceira API, essa sim documentada:
  `/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`** (o
  `/api/pncp/v1/orgaos/.../compras/{ano}/{sequencial}` sem sufixo redireciona
  `301` pra ela). Devolve `orgaoEntidade.esferaId` (`F`/`E`/`M`) e
  `unidadeOrgao.codigoIbge` — usados por `apps/capag/lookup.py` pra casar a
  compra com a nota CAPAG do ente certo (município OU estado, nunca por nome
  de órgão: um órgão estadual pode ter nome de faculdade/fundação, sem
  "estado" em lugar nenhum — testado com a Faculdade de Medicina de São José
  do Rio Preto, `esferaId: "E"`, vinculada ao estado de SP apesar do nome).
  `/api/pncp/v1/orgaos/.../arquivos` (mesma família não documentada de
  `/itens`) devolve os documentos do edital com link de download direto —
  `200`, PDF de verdade, sem precisar do site do PNCP. `PncpClient
  .detalhar_compra`/`.listar_arquivos` (ver `apps/integracoes/clients/pncp.py`).
- **Achado crítico, 28/08/2026: o link "abrir no compras.gov.br" dava 404
  pra TODO resultado vindo da busca textual do PNCP — por dois motivos
  somados.** (1) O `idCompra` do Comprasnet tem **17 dígitos**: UASG(6) +
  **modalidade(2, na tabela do compras.gov.br)** + número(5) + ano(4) — a
  remontagem (`_montar_id_compra` em `clients/pncp.py`) omitia os 2 dígitos
  da modalidade (o comentário antigo dizia "confirmado contra a API", mas o
  formato estava errado; confirmado agora contra o `linkSistemaOrigem` real:
  `...compra=92553805900672026` = 925538+05+90067+2026). (2) Mais
  fundamental: **o PNCP é o agregador nacional — a busca textual devolve
  edital de QUALQUER plataforma** (Comprasnet, Portal de Compras Públicas,
  BLL, Licitanet, ...), e o link era montado como se tudo fosse Comprasnet;
  pra compra que não vive lá, 404 mesmo com o formato certo. A solução
  definitiva veio de graça: a API documentada de consulta
  (`/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}`, que
  `CompraDetalheView` já chama pro CAPAG) devolve **`usuarioNome`** (o
  sistema que publicou, ex.: "Compras.gov.br") e **`linkSistemaOrigem`** (o
  deep link pronto pra plataforma de origem, seja ela qual for — confirmado
  ao vivo pros dois casos). Medição ao vivo (28/08/2026, termo "café",
  página de 50): **só 11 editais eram do Comprasnet**; 11 vieram sem
  `linkSistemaOrigem` nenhum; os outros 28 eram de 13 plataformas
  diferentes. E o campo `numero` da busca textual veio `None` em todas as
  amostras — link remontado a partir da busca não é confiável.
- **Decisão de produto (28/08/2026): toda oportunidade devolvida é da
  plataforma escolhida e tem `link_plataforma` garantido** — sem link de
  disputa não existe oportunidade, e o botão dourado do card aparece
  SEMPRE. Hoje a plataforma é fixa (compras.gov.br, a única registrada);
  quando houver mais de uma, vira um dropdown na tela de busca (igual ao de
  modalidade) que manda o `plataforma_id` do registro — o parâmetro já
  existe em `services.buscar_oportunidades`. Consequência no caminho da
  busca textual: como a resposta do `/api/search/` não diz a plataforma, a
  orquestração lê até 50 editais (`MAX_EDITAIS_BRUTOS`), **detalha cada um
  em paralelo** (`_apenas_da_plataforma` em `apps/licitacoes/services.py`)
  e descarta o que não é da plataforma escolhida, gravando o
  `linkSistemaOrigem` definitivo nos que ficam; se nenhum sobrar, cai na
  reserva de catálogo (que já é 100% compras.gov.br). Custo: até ~50
  chamadas de detalhe extra por busca, em rodadas de 20 — é o preço de não
  mostrar oportunidade que o usuário não consegue abrir.
- **Plataformas são plugáveis** (28/08/2026): o ponto de entrada é
  `apps/integracoes/plataformas.py` — plataforma nova = uma subclasse de
  `Plataforma` registrada em `PLATAFORMAS` (+ o client dela em `clients/`,
  se tiver API própria; + nome/favicon no mapa `PLATAFORMAS` de
  `edital-card.component.ts` e o PNG em `frontend/public/plataformas/`).
  O PNCP **não** entra no registro: é agregador, não plataforma — fica como
  camada transversal de busca.
- **O 5xx do PNCP costuma ser transitório** (28/08/2026): visto um 500 de
  "connection pool timeout" em `/api/consulta/v1/...` que funcionou na
  tentativa seguinte. `PncpClient` repete uma vez erro >= 500 (4xx continua
  sem repetição — é resposta, não falha).
- **O `/api/consulta/` do PNCP tem rate limit por IP** (429, medido ao vivo
  em 28/08/2026): a rajada de ~50 detalhes de uma busca textual consome a
  janela — a próxima chamada ao endpoint (o detalhe do card, ou outra
  busca em seguida) leva 429 por alguns minutos. Só a família
  `/api/consulta/` é limitada; `/api/pncp/v1/...` (itens, arquivos) e
  `/api/search/` seguem normais. Mitigações no código: (1) os insumos do
  CAPAG e o link de origem vão **embutidos no resultado da busca** — o selo
  do card não depende de segunda chamada (`views._resolver_capag`); (2) o
  detalhe é **cacheado** (`services.detalhar_compra_cacheada`, TTL 6h,
  LocMem por padrão — apontar `CACHES` pra Redis no cluster compartilha
  entre pods). Degradação sob 429 sustentado: a busca textual não consegue
  confirmar plataforma e cai na reserva de catálogo (100% compras.gov.br,
  links garantidos) — o usuário continua vendo resultado.
- **CAPAG (Capacidade de Pagamento) não é API — é arquivo estático do
  Tesouro Nacional**, atualizado ~3x/ano: XLSX de municípios
  (`tesourotransparente.gov.br/ckan/dataset/capag-municipios`, aba "Prévia
  da CAPAG", colunas `Código Município Completo` = código IBGE,
  `Nome_Município`, `UF`, `CAPAG` = nota) e CSV pequeno de estados
  (`.../capag-estados`, coluna `Classificação da CAPAG`). Nota final numa
  escala só, `A+ A B+ B C D` (`#N/A`/`n.d.`/`n.e.` = não avaliado, sem
  selo). URL do arquivo vigente sempre via `package_show` do CKAN (nunca
  hardcoda nome/data — muda a cada publicação). `apps/capag/sync.py` baixa
  e grava; agendado no Celery Beat, mensal (folga confortável pra uma fonte
  que só muda a cada ~4 meses).

## O que muda do protótipo para a stack de produção

- **Autenticação multiusuário** — `Filtro` passa a ter dono; API protegida
  (DRF + JWT ou sessão).
- **Agendamento sai do processo da app** (`APScheduler` embutido) **e vira
  Celery Beat**, para sobreviver a réplicas efêmeras do pod da API.
- **SQLite → PostgreSQL**, com `raw_json` como `JSONField` nativo em vez de
  texto serializado.
- **Envio de e-mail e chamadas às APIs externas viram tasks Celery**
  assíncronas, nunca bloqueando o request HTTP.
