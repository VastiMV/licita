# Handoff: Card de oportunidade de licitação (desktop 6a + mobile 7a)

> **Atualização 28/08/2026 — este handoff foi parcialmente superado pela
> implementação; NÃO reverter o card pra ele.** O slot dourado primário não é
> mais "Selecionar licitação": é **"Abrir na plataforma"** (link pra
> plataforma de origem da compra, com o favicon dela no segmento de ícone —
> ver docs/DOMINIO.md, achado de 28/08/2026). A ação de guardar virou o botão
> outline **"Salvar oportunidade"** (persistência especificada em
> docs/DOMINIO.md, entidade `OportunidadeSalva`). O restante do handoff
> (layout, paleta, abas, prazos, estados) continua valendo.

## Overview
Card que lista/apresenta uma oportunidade de licitação pública (dispensa, pregão etc.) vinda do PNCP.
O usuário precisa, em um relance: entender o objeto, o órgão, o prazo de propostas, e agir —
**selecionar a licitação** (ação principal do produto), **baixar o edital** (PDF) e, secundariamente,
abrir a publicação original no portal oficial. Itens e documentos ficam em abas dentro do próprio card.

O problema que este design resolve: na versão anterior as ações pareciam abas e os links não tinham
affordance — não se distinguia botão de navegação. Aqui: **botão tem forma de botão, link tem cor e ícone de link**,
e a ação primária (Selecionar licitação) é a única em dourado.

Duas telas aprovadas:
- **6a** — desktop (largura de conteúdo 1060px)
- **7a** — mobile (iPhone, 393pt de largura de viewport)

## About the Design Files
Os arquivos em `reference/` são **referências de design escritas em HTML** — protótipos que mostram
aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é
**recriar estes designs no ambiente já existente do seu codebase** (React, Vue, Angular, Blazor, SwiftUI,
Kotlin/Compose etc.), usando os componentes, tokens e convenções que já existem lá. Se não houver ambiente
de UI definido, escolha o framework mais adequado ao projeto e implemente ali.

`reference/Card Licitacao.dc.html` contém **todas** as explorações desta conversa, do turno 1 ao 7.
Implemente apenas o que está marcado como **6a** (desktop) e **7a** (mobile) — os outros turnos são
histórico de decisão e servem só para contexto. Cada opção está marcada no HTML com
`<div class="dv-opt" id="6a">` / `id="7a"`.

`reference/ios-frame.jsx` e `reference/support.js` são apenas o andaime de preview (moldura de iPhone e
runtime do protótipo). **Não** faz parte do produto — ignore na implementação.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, raios, sombras e estados de hover são finais.
Recreie fielmente, substituindo apenas o necessário para casar com o design system do codebase
(ex.: se já existe um `<Button variant="primary">`, use-o com as cores abaixo em vez de criar outro).

---

## Screens / Views

### 6a — Card desktop

**Purpose:** exibir uma oportunidade em lista/detalhe e permitir selecioná-la, baixar o edital e inspecionar itens/documentos.

**Layout geral**
- Container: `width: 1060px` (na prática, largura total da coluna de conteúdo — trate 1060px como max-width),
  `background: #ffffff`, `border: 1px solid #d2dbe9`, `border-radius: 16px`, `overflow: hidden`,
  `box-shadow: 0 1px 2px rgba(20,33,61,.06), 0 18px 40px -28px rgba(20,33,61,.4)`.
- Estrutura vertical: **(1)** faixa de cabeçalho navy → **(2)** corpo em 2 colunas → **(3)** barra de abas → **(4)** painel da aba ativa.

**(1) Faixa de cabeçalho (tags)**
- `display:flex; align-items:center; gap:9px; padding:14px 24px; background:#14213d`.
- Tag UF: texto `GO`, `font: 700 10.5px; letter-spacing:.07em`, `color:#14213d`, `background:#f0c14b`, `padding:5px 9px`, `radius:5px`.
- Tags secundárias (`DISPENSA`, `DIVULGADA NO PNCP`): `font: 600 10.5px; letter-spacing:.07em`, `color:#cfdaee`,
  `border:1px solid rgba(207,218,238,.35)`, `padding:4px 9px`, `radius:5px`, sem fundo.
- Espaçador `flex:1`.
- Selo CAPAG (direita): ponto de 6px `border-radius:50%` `background:#f0c14b` + texto `CAPAG B`,
  `font:700 10.5px; letter-spacing:.06em`, `color:#f0c14b`, `gap:6px`.

**(2) Corpo — 2 colunas (`display:flex; align-items:stretch`)**

*Coluna esquerda (`flex:1; padding:24px; min-width:0`)*
1. Eyebrow: `Prefeitura Municipal de Rio Verde — GO · UASG 989571` —
   `font:600 11px; letter-spacing:.08em; text-transform:uppercase; color:#a9803a; margin-bottom:10px`.
2. Título (h3): `font:800 21px/1.35; letter-spacing:-.01em; color:#14213d; text-wrap:pretty; margin:0`.
   Nunca em CAIXA ALTA (o original vinha maiúsculo do PNCP — normalizar para sentence case).
3. Descrição: `font:400 13.5px/1.55; color:#5c6b87; max-width:62ch; margin-top:10px`.
4. Linha de dados: `display:flex; gap:34px; margin-top:22px; padding-top:18px; border-top:1px solid #eef1f6`.
   Cada par:
   - rótulo `font:500 10.5px; letter-spacing:.06em; text-transform:uppercase; color:#8a97ad; margin-bottom:6px`
   - valor `font:700 13.5px; color:#14213d`
   Campos: **Cidade** (Rio Verde / GO), **Publicação** (26/08/2026), **Modalidade** (Dispensa eletrônica),
   **Valor estimado** (R$ 9.480,00).

*Coluna direita — ações (`width:300px; flex:none; padding:22px; background:#f7f9fc; border-left:1px solid #e6ebf3; display:flex; flex-direction:column; gap:11px`)*
1. **Bloco de prazo**: `background:#fff; border:1px solid #f4dda4; radius:11px; padding:14px`.
   - rótulo `Propostas até` — `font:500 10.5px; letter-spacing:.06em; uppercase; color:#a9803a; margin-bottom:8px`
   - data `font:800 19px; color:#14213d`
   - barra de progresso: trilha `height:5px; radius:3px; background:#eef1f6; margin-top:9px`;
     preenchimento `background:#d99b0a`, largura = % do intervalo publicação→encerramento já decorrido (no mock, 62%).
   - contagem `Faltam 5 dias` — `font:700 11.5px; color:#8a5a06; margin-top:8px`.
     Quando ≤ 2 dias, subir a urgência (ver "Estados" abaixo).
2. Espaçador `flex:1` (empurra as ações para o rodapé da coluna).
3. **Grupo primário "Selecionar licitação"** (split button) — `display:flex; height:54px; border-radius:10px;
   box-shadow:0 2px 0 #d9a92f; overflow:hidden`:
   - segmento de texto: `flex:1`, `font:800 13.5px`, `color:#14213d`, `background:#f0c14b`,
     `border:1px solid #d9a92f; border-right:none`, `padding:0 12px`. Hover: `background:#f5cc66`.
   - segmento de ícone: `width:48px; flex:none`, `background:#e8b23c`, `border:1px solid #d9a92f`,
     `justify-content:flex-end; padding:0 13px 0 0`. Hover: `background:#f0c14b`.
     Ícone seta-direita 16×16 (ver "Ícones").
   - Ambos os segmentos disparam a mesma ação (selecionar); o segmento de ícone é reforço visual de avanço,
     não um menu. Se o seu design system não tem split button, use um botão único com ícone à direita.
4. **Botão secundário "Baixar edital"** — `display:flex; align-items:center; gap:11px; height:54px; width:100%;
   text-align:left; background:#1c2b4d; border:1px solid #14213d; radius:10px; padding:0 13px;
   box-shadow:0 2px 0 #0e1730`. Hover: `background:#243660`.
   - chip do tipo de arquivo: `30×30`, `radius:7px`, `background:rgba(255,255,255,.12)`,
     texto `PDF` `font:800 9px; color:#cfdaee; letter-spacing:.04em`.
   - bloco de texto (`flex:1; min-width:0`): título `Baixar edital` `font:700 12.5px/1.2; color:#fff`;
     meta `1,2 MB · 26/08/2026` `font:500 11px/1.2; color:rgba(207,218,238,.75); margin-top:3px`.
   - ícone download 16×16, `stroke:#f0c14b`, em caixa `16×16` centralizada, encostada no `padding-right:13px`.
5. Divisória: `height:1px; background:#e2e8f1; margin:4px 0`.
6. **Link de fonte externa (PNCP)** — `<a>` com `display:flex; align-items:center; gap:9px; padding:0 13px;
   text-decoration:none`:
   - chip `PNCP`: `height:22px; padding:0 7px; radius:5px; font:700 9.5px; letter-spacing:.07em;
     color:#5c6b87; background:#eef1f6; border:1px solid #e2e8f1`.
   - rótulo `Abrir publicação original` — `font:600 12px/22px; color:#1a6fd4; flex:1`.
   - ícone link-externo 15×15 `stroke:#1a6fd4` em caixa `16×22`.
   - Abre em nova aba (`target="_blank" rel="noopener"`).

> **Regra de alinhamento (o usuário validou isso explicitamente):** os três ícones da coluna direita
> compartilham **um único eixo vertical** — recuo de 13px da borda interna da coluna em todos.
> Ícone sempre dentro de uma caixa flex de tamanho fixo (16×16 / 16×22), centralizado, e a caixa
> encostada no recuo — não centralize o ícone dentro de um segmento largo.

**(3) Barra de abas**
- `display:flex; align-items:center; padding:0 24px; background:#fff; border-top:1px solid #eef1f6;
  box-shadow: inset 0 -1px 0 #eef1f6`.
- Cada aba é `<button>`: `padding:13px 2px; margin-right:26px; background:none; border:none;
  border-bottom:2.5px solid transparent; cursor:pointer; gap:7px`.
  - inativa: `font:600 13px; color:#5c6b87`; contador `font:700 11px; color:#5c6b87; background:#eef1f6; padding:3px 6px; radius:5px`.
  - ativa: `font:700 13px; color:#14213d; border-bottom-color:#d99b0a`; contador `color:#8a5a06; background:#fdf1d6`.
- Abas: `Itens (1)` e `Documentos (2)`. Padrão: **Itens** ativa.

**(4a) Painel "Itens"** — `padding:18px 24px 22px; background:#fbfcfe`
- Tabela em card: `border:1px solid #e6ebf3; radius:11px; background:#fff; overflow:hidden`.
- Cabeçalho: `padding:11px 16px; background:#f4f7fb; font:600 10.5px; letter-spacing:.06em; uppercase; color:#8a97ad; gap:16px`.
  Colunas: `#` (22px), `Descrição` (flex:1), `Unidade` (96px), `Qtd` (56px, dir.), `Valor unit.` (110px, dir.), `Total` (110px, dir.).
- Linha: `padding:15px 16px; border-top:1px solid #eef1f6; align-items:flex-start`.
  - índice `font:700 12.5px; color:#8a97ad`
  - descrição `font:700 13.5px/1.45; color:#14213d; text-wrap:pretty`
  - chips sob a descrição (`gap:7px; margin-top:9px`): `font:500 11.5px; color:#3c5480; background:#f4f7fb;
    border:1px solid #e6ebf3; padding:6px 9px; radius:6px` — ex.: `CATSER 17.278`, `Menor preço`, `Ampla concorrência`.
  - valores `font:600 12.5px; color:#14213d`; **Total** `font:800 13px`.
- Rodapé de totais: `padding:12px 16px; border-top:1px solid #eef1f6; background:#fbfcfe`;
  esquerda `1 item · valor total estimado` `font:600 12px; color:#5c6b87`; direita `font:800 14px; color:#14213d`.
- Formatação monetária: pt-BR, `R$ 9.480,00`. Datas: `dd/MM/yyyy`.

**(4b) Painel "Documentos"** — mesma moldura de card
- Cabeçalho: `#` (22px), `Título` (flex:1.6), `Tipo` (flex:1), coluna de ação (64px).
- Linha: `padding:13px 16px; border-top:1px solid #eef1f6`; título `font:600 12.5px; color:#14213d`;
  tipo `color:#5c6b87`; ação `Abrir` como link `font:600; color:#1a6fd4`, alinhado à direita.
  Hover da linha: `background:#f8fafd`.
- Conteúdo do mock: `Ato de autorização — 127077/2026.pdf` (Ato que autoriza a Contratação Direta) e
  `Aviso de dispensa eletrônica e TR — 127077/2026.pdf` (Aviso de Contratação Direta).

---

### 7a — Card mobile (iPhone, viewport 393pt)

**Purpose:** mesma função, em uma coluna. Aparece dentro de um feed de oportunidades.

**Layout**
- Fundo da tela: `#eef1f6`; padding do feed `12px` lateral, `28px` no fim.
- Card: `background:#fff; border:1px solid #d2dbe9; radius:16px;
  box-shadow:0 1px 2px rgba(20,33,61,.06), 0 10px 24px -18px rgba(20,33,61,.35)`.
- Ordem: cabeçalho navy → identificação/título → grade de dados 2×2 → faixa de prazo → ações empilhadas →
  link PNCP → abas → painel.

**Diferenças em relação ao 6a (todo o resto é idêntico em cor e peso)**
1. **Cabeçalho**: `padding:11px 14px`, tags a `font:700/600 9.5px`, apenas `GO` + `DISPENSA` + selo CAPAG
   (a tag `DIVULGADA NO PNCP` é omitida por espaço).
2. **Eyebrow** abreviado: `Pref. Mun. de Rio Verde — GO · UASG 989571`, `font:600 10px/1.3`.
3. **Título**: `font:800 16.5px/1.35`.
4. **Dados**: `display:grid; grid-template-columns:1fr 1fr; gap:14px 12px`; rótulo `font:500 9.5px`,
   valor `font:700 13px/1.2`. Campos: Cidade, Valor estimado, Publicação, Modalidade.
5. **Prazo vira faixa horizontal** (em vez do bloco com barra): `margin:16px 14px 0; padding:11px 12px;
   background:#fdf1d6; border:1px solid #f4dda4; radius:11px`.
   Esquerda: rótulo `Propostas até` + data `font:800 15px`. Direita: pill `Faltam 5 dias`
   `font:700 11px; color:#8a5a06; background:#fff; border:1px solid #f4dda4; padding:7px 10px; radius:999px`.
   A barra de progresso é descartada no mobile.
6. **Ações em largura total**, empilhadas, `gap:9px`, `padding:14px 14px 0`:
   grupo dourado `height:52px; radius:11px` (texto `font:800 14px`, ícone com `padding-right:14px`);
   botão navy de download `height:52px; radius:11px; padding:0 14px` (título `font:700 13px`).
   Alvos de toque ≥ 44pt — respeitados (52px).
7. **Link PNCP** igual ao 6a, com `padding:4px 14px 0`.
8. **Abas**: `gap:22px; padding:0 14px`, mesmos estilos ativo/inativo.
9. **Painel "Itens" vira cartão, não tabela**: `padding:14px; background:#fbfcfe`; cartão
   `border:1px solid #e6ebf3; radius:11px; padding:13px`; chip `Item 1` + `CATSER 17.278`;
   descrição `font:700 13px/1.45`; grade 2 colunas com `Unid. × Qtd` (`Diária × 4`) e `Valor unitário`;
   rodapé `Total estimado` + `font:800 14px`.
10. **Painel "Documentos" vira lista de linhas tocáveis**: cada item é `<a>` com
    `padding:11px 12px; background:#fff; border:1px solid #e6ebf3; radius:11px; gap:11px`;
    chip `PDF` 30×30 `background:#eef1f6; color:#5c6b87`; título `font:700 12.5px/1.3`;
    subtítulo (tipo do documento) `font:500 11px/1.3; color:#8a97ad`; ícone download 16×16 `stroke:#1a6fd4`.
11. Moldura de iPhone no protótipo é só apresentação (nav bar "Oportunidades") — não implementar.

---

## Interactions & Behavior
- **Abas Itens/Documentos**: troca de painel local ao card, sem navegação e sem fetch novo (dados já vêm no payload
  do card). Sem animação obrigatória; se quiser, `opacity`/`translateY(4px)` em 120ms `ease-out`.
- **Selecionar licitação** (primário): ação de produto — adiciona a licitação ao fluxo/carteira do usuário.
  Após sucesso, ver "estado selecionado" em Estados. Deve ter estado de loading (spinner substituindo o
  ícone de seta, texto mantido) e ser idempotente.
- **Baixar edital**: baixa o PDF principal (não abre modal). Mostrar progresso quando o arquivo > ~5 MB.
  Se o arquivo não existir no registro, esconder o botão (não desabilitar em cinza).
- **Abrir publicação original**: abre o PNCP em nova aba.
- **Linha de documento → "Abrir"**: abre o PDF em nova aba (desktop) / visualizador nativo (mobile).
- **Hover** (desktop): definidos por elemento acima. Todos os botões precisam de `:focus-visible`
  com anel visível (sugestão: `outline:2px solid #1a6fd4; outline-offset:2px`).
- **Responsivo**: abaixo de ~880px a coluna de ações de 300px passa para baixo do conteúdo em largura total
  e o layout converge para o 7a; a tabela de itens vira cartões.
- **Truncamento**: o título nunca é truncado (é o dado de decisão); a descrição pode ir a 3 linhas com clamp.

## Estados
- **Prazo próximo** (≤ 2 dias): contagem em `#b3261e`, chip/faixa `background:#fdecea; border-color:#f3c1bb`,
  barra de progresso `#b3261e`.
- **Encerrada**: cabeçalho navy a 70% de opacidade, faixa de prazo em cinza
  (`background:#eef1f6; border-color:#e2e8f1`, texto `#8a97ad`), grupo dourado substituído por
  botão secundário `Ver resultado`; download permanece.
- **Selecionada**: borda do card `#d9a92f`, e o grupo dourado é substituído por botão de confirmação
  (`background:#fff; border:1.5px solid #d9a92f; color:#8a5a06`, texto `Licitação selecionada`, com check à esquerda);
  ação secundária `Remover da seleção` como link.
- **Sem itens / sem documentos**: manter a aba visível com contador `0` e estado vazio de uma linha
  (`font:500 12.5px; color:#8a97ad`), ex.: `Nenhum item informado na publicação.`
- **Loading do card**: skeletons de `background:#eef1f6`, alturas 11/15px, radius 3px (ver placeholder no turno 2b).

## State Management
- `activeTab: 'itens' | 'documentos'` — local ao card, default `'itens'`.
- `isSelected: boolean` — vem do servidor; otimista no clique, com rollback em erro.
- `isSelecting: boolean`, `isDownloading: boolean` — locais.
- Dados necessários por card (nomes sugeridos): `uf`, `modalidade`, `origem` ('PNCP'), `capag`,
  `orgao`, `uasg`, `objeto` (título), `descricaoComplementar`, `cidade`, `dataPublicacao`,
  `dataEncerramentoPropostas`, `valorEstimado`, `itens[] { numero, descricao, catser, criterioJulgamento,
  tipoParticipacao, unidade, quantidade, valorUnitario, valorTotal }`,
  `documentos[] { numero, titulo, tipo, url, tamanhoBytes, dataPublicacao }`, `urlEditalPrincipal`, `urlPncp`.
- % da barra de prazo = `(hoje - dataPublicacao) / (dataEncerramento - dataPublicacao)`, limitado a 0–100.

## Design Tokens
**Cores**
| Uso | Hex |
|---|---|
| Navy (cabeçalho, texto forte) | `#14213d` |
| Navy botão secundário / hover | `#1c2b4d` / `#243660` |
| Navy sombra 3D | `#0e1730` |
| Dourado primário / hover | `#f0c14b` / `#f5cc66` |
| Dourado segmento de ícone | `#e8b23c` |
| Dourado borda / sombra 3D | `#d9a92f` |
| Âmbar fundo (prazo) | `#fdf1d6` |
| Âmbar borda | `#f4dda4` |
| Âmbar texto | `#8a5a06` |
| Âmbar barra / marcador de aba | `#d99b0a` |
| Eyebrow (marrom dourado) | `#a9803a` |
| Azul de link | `#1a6fd4` |
| Texto secundário | `#5c6b87` |
| Rótulos / meta | `#8a97ad` |
| Texto sobre navy | `#cfdaee` |
| Chip azul claro (fundo/borda/texto) | `#dfe7f4` / `#c8d3e6` / `#3c5480` |
| Superfícies | `#ffffff`, `#fbfcfe`, `#f7f9fc`, `#f4f7fb`, `#eef1f6` |
| Bordas | `#d2dbe9`, `#e2e8f1`, `#e6ebf3`, `#eef1f6` |
| Urgência (estado) | `#b3261e` / `#fdecea` / `#f3c1bb` |

**Tipografia** — `Plus Jakarta Sans` (Google Fonts), pesos 400/500/600/700/800; fallback `system-ui, sans-serif`.
Escala usada: 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16.5, 19, 21 px.
Rótulos uppercase: `letter-spacing:.06em`; eyebrow: `.07–.08em`; título: `-.01em`.

**Espaçamento** — 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 22, 24, 26, 34 px (base 2/4).

**Raios** — 5 (chips pequenos), 6–7 (chips/ícone-caixa), 9–11 (botões/blocos), 14–16 (cards), 999 (pills).

**Sombras**
- card desktop: `0 1px 2px rgba(20,33,61,.06), 0 18px 40px -28px rgba(20,33,61,.4)`
- card mobile: `0 1px 2px rgba(20,33,61,.06), 0 10px 24px -18px rgba(20,33,61,.35)`
- botão dourado: `0 2px 0 #d9a92f` · botão navy: `0 2px 0 #0e1730`
- barra de abas: `inset 0 -1px 0 #eef1f6`

**Alturas de controle** — desktop 54px; mobile 52px; largura do segmento de ícone 48px; caixa de ícone 16×16.

## Ícones
Quatro ícones, todos `viewBox="0 0 16 16"`, `fill:none`, `stroke:currentColor` (exceto onde indicado),
`stroke-width:1.9`, `stroke-linecap/linejoin:round`. Se o codebase já tem uma biblioteca (Lucide, Phosphor,
SF Symbols, Material), **use os equivalentes de lá** — o que importa é o eixo e o tamanho:
- seta-direita: `M3.5 8h9` + `M9 4.5L12.5 8 9 11.5`
- download: `M8 2.8v7.4` + `M4.8 7L8 10.2 11.2 7` + `M3.2 13.2h9.6` (stroke `#f0c14b` sobre navy, `#1a6fd4` em listas)
- link-externo: `M9.2 3.4h3.4v3.4` + `M12.6 3.4L7.4 8.6` + `M11.4 9.6v3H3.4V4.6h3` (stroke `#1a6fd4`)
- chevron-baixo (mobile colapsado): `M4.5 6.5L8 10l3.5-3.5`

## Assets
Nenhum bitmap, nenhum logo, nenhuma ilustração. Só tipografia, cor e os 4 ícones acima.
Fonte: Plus Jakarta Sans via Google Fonts — se o seu app já usa outra sans geométrica/neo-grotesca,
mantenha a sua e apenas preserve os pesos (800 para título e ação primária, 700 para valores, 500/600 para rótulos).

## Files
- `reference/Card Licitacao.dc.html` — protótipo com todas as explorações; **implementar apenas `id="6a"` (desktop) e `id="7a"` (mobile)**.
  Os turnos 1–5 mostram alternativas descartadas (útil para entender o porquê das decisões); 7b é a variante colapsada, ainda não aprovada.
- `reference/ios-frame.jsx`, `reference/support.js` — andaime de preview, **não** implementar.

## Notas de conteúdo
Os dados do exemplo são de uma dispensa real de Rio Verde/GO (processo 127077/2026); **os valores de item
(R$ 2.370,00 unitário / R$ 9.480,00 total, unidade "Diária", qtd 4, CATSER 17.278) e o tamanho do PDF (1,2 MB)
são fictícios**, colocados só para dimensionar o layout. Troque pelos campos reais do PNCP.
