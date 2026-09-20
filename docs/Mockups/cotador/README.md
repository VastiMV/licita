# Handoff: Cotador (formulário de cotação com comparação de fornecedores)

## Overview
Redesenho do formulário de cotação de uma ferramenta de compras/licitações. O operador recebe os itens
de uma **oportunidade consultada no site** (não há importação manual de planilha), cadastra um ou mais
**fornecedores por item**, e o sistema calcula preço final, preço de reserva (piso), lucro e impostos
embutidos — por item e no total da cotação.

Problemas do formulário original (ver `referencia-formulario-original.png`) que este redesenho resolve:
tabela com rolagem horizontal, 5 campos de imposto por cotação, impossibilidade de comparar fornecedores,
digitação lenta com 20+ itens, densidade/ruído visual.

## About the Design Files
`Cotador.dc.html` é uma **referência de design em HTML** — um protótipo funcional que demonstra layout,
estados e as fórmulas de cálculo. **Não é código de produção para copiar.** A tarefa é **recriar este
design no ambiente já existente do codebase** (React, Vue, Angular, Blazor, etc.), usando os componentes,
tokens e padrões daquele projeto. Se não existir front-end ainda, escolha o framework mais adequado ao
projeto e implemente ali.

O arquivo é um "Design Component": um HTML com um template declarativo (`{{ }}` = valores; `<sc-for>` =
loop; `<sc-if>` = condicional) e uma classe de lógica (`class Component`) no final do arquivo. **Leia a
classe de lógica** — ela contém as fórmulas de negócio, que são a parte que deve ser portada com precisão.
Abrir o arquivo direto no navegador funciona e é a melhor forma de entender as interações.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, estados e cálculos são finais. Recrie fielmente
usando os componentes equivalentes do codebase (inputs, sliders, modal, cards). O visual segue o produto
existente: roxo/indigo como cor primária, cards arredondados, fundo cinza-lilás claro.

---

## Regras de negócio (a parte mais importante)

Nomes das variáveis conforme a classe de lógica.

### Modelo de dados
```
Cotacao {
  titulo: string
  itens: Item[]
  defaults: {            // "Padrões da cotação" — valem para itens sem regra própria
    transporte: number   // % sobre o CUSTO
    garantia: number     // % sobre o CUSTO
    markupMin: number    // % de MARKUP mínimo (sobre o custo) — gera o preço de reserva. SEM TETO
    markupAlvo: number   // % de MARKUP alvo (sobre o custo) — gera o preço proposto. SEM TETO
    impostos: number     // % sobre a VENDA (soma de ICMS/Simples + PIS + COFINS + IPI + ISS)
  }
}

Item {
  id: string
  desc: string
  qty: number
  mMin: number | null    // MARKUP mínimo do item (%); null => defaults.markupMin. Sem teto, >= 0
  mMax: number | null    // MARKUP alvo do item (%);    null => defaults.markupAlvo. Sem teto, >= 0
  taxes: number | null   // imposto próprio do item (% da venda); null => defaults.impostos
  suppliers: Supplier[]
  chosen: string         // id do fornecedor escolhido (o que entra no cálculo)
}

Supplier { id, name: string, cost: number, freight: number, other: number }
```

### Fórmulas
```
custoUn(fornecedor)   = cost + freight + other
custoUn(item)         = custoUn(fornecedor escolhido)

over                  = (defaults.transporte + defaults.garantia) / 100
tax(item)             = min((item.taxes ?? defaults.impostos) / 100, 0.9)
mkMin(item)           = max(0, item.mMin ?? defaults.markupMin)             // markup mínimo, %
mkAlvo(item)          = max(item.mMax ?? defaults.markupAlvo, mkMin(item))  // alvo nunca abaixo do mínimo

preco(item, mk)       = custoUn * (1 + over + mk/100) / (1 - tax)           // mk = MARKUP em %
precoFinalUn(item)    = preco(item, mkAlvo(item))                           // preço proposto
precoReservaUn(item)  = preco(item, mkMin(item))                            // PISO — menor valor que compensa
lucroUn(item, mk)     = custoUn * mk/100                                    // markup incide sobre o CUSTO
impostoUn(item)       = precoFinalUn * tax
folgaUn(item)         = precoFinalUn - precoReservaUn                       // espaço de negociação

// MARGEM é derivada — nunca é campo de entrada:
margemUn(item, mk)    = lucroUn(item, mk) / preco(item, mk) * 100           // % da VENDA
```
> **Por que divisão e não soma:** transporte, garantia e lucro incidem sobre o **custo**; os tributos
> incidem sobre a **venda**. Dividir por `(1 − tax)` embute o imposto que vai cair sobre o próprio preço.
> Esse texto aparece na UI (memória de cálculo e modal de ajuda) e deve ser preservado.

> **Markup × margem — regra central desta versão.** O operador ajusta **markup** (acréscimo sobre o
> custo); ele **não tem teto** e passa de 100% com frequência. A **margem** (% da venda) é sempre
> **calculada e exibida como leitura**, nunca editável. Não usar as palavras "margem mínima/máxima"
> em controles — são "markup mínimo (reserva)" e "markup alvo (proposta)".
>
> **Escala automática do slider (implementar assim):**
> `softMax(v) = max(100, ceil(max(v,0) * 1.5 / 50) * 50)`
> O slider usa `min=0, max=softMax(valorAtual), step=1`, então sempre sobra ~50% de curso à direita e
> o usuário nunca bate no fim da régua. Valores acima da régua entram pelo campo numérico ao lado
> (que é a fonte da verdade e não tem `max`).

### Melhor fornecedor
`bestSup(item)` = entre os fornecedores com `cost > 0`, o de menor `custoUn`. Se o escolhido não é o melhor
(diferença > R$ 0,005), mostrar o chip "R$ X mais barato em <fornecedor>" e habilitar a ação em massa.

### Totais da cotação
```
itens          = count(itens);  unidades = Σ qty
custoProdutos  = Σ (cost do escolhido × qty)                  // sem frete/extras
capital        = Σ (custoUn × qty)                            // com frete/extras
transporte     = Σ (custoUn × defaults.transporte/100 × qty)
garantia       = Σ (custoUn × defaults.garantia/100 × qty)
impostos       = Σ (impostoUn × qty)
valorCotado    = Σ (precoFinalUn × qty)
reserva        = Σ (precoReservaUn × qty)
folga          = valorCotado − reserva
lucroTotal     = Σ (lucroUn(mMax) × qty)
lucroPct       = lucroTotal / valorCotado          // "% da venda"
margemMedia    = lucroTotal / valorCotado          // margem real — % da venda
markupMedio    = lucroTotal / capital              // markup médio — linha de apoio do mesmo card
economia       = Σ ((custoUn − custoUnDoMelhor) × qty) para itens cujo escolhido ≠ melhor
pendencias     = nº de itens com desc vazia OU cost do escolhido ≤ 0
```
Formatação: moeda `pt-BR` com 2 decimais e prefixo `R$ `; percentuais arredondados a 1 decimal com `%`.

---

## Screens / Views

Tela única (desktop-first, responsiva até celular), três regiões fixas + conteúdo rolável.

### 1. Header fixo (sticky top)
- Fundo `rgba(244,243,248,.92)` + `backdrop-filter: blur(10px)`; borda inferior `1px #e4e1ef`.
- Container `max-width: 1240px`, padding `14px 22px 0`.
- Esquerda: badge 34×34, radius 10, `#4f46b8`, letra "C" branca 800/15px. Ao lado: **input do título**
  (700/17px, transparente, hover `#eceafa`, focus branco + borda roxa) e sublinha
  "Rascunho · salvo automaticamente" (500/11.5px, `#8a86a0`).
- Direita: **apenas o botão "?"** (32px, borda `#dedbeb`, mono) que abre o modal de ajuda.
  *Não há "Colar da planilha" nem "Adicionar item" no header* — foi decisão explícita do cliente.

### 2. Painel de totais (dentro do header fixo) — composição do custo
`display:grid; grid-template-columns: repeat(auto-fit, minmax(134px,1fr)); gap:9px`, padding `10px 22px 16px`.
Seis cards **outlined com fundo levemente mais escuro que a tela**: `background:#eceaf4`,
`border:1px solid #d8d4e8`, radius 12, padding `11px 12px 12px`, coluna com `gap:5px`.
Cada card tem exatamente 3 linhas — rótulo (`min-height:24px`, 700/9.5px, `letter-spacing:.1em`, uppercase,
`#8a86a0`), valor (mono 15px, `font-variant-numeric: tabular-nums`, `white-space: nowrap`) e linha de apoio
(500/11px, `#a9a5bd`). O `min-height` do rótulo + `nowrap` do valor são o que mantém os cards alinhados e
sem quebra — não remova.

| Card | Valor | Linha de apoio |
|---|---|---|
| Itens | contagem | "N unidades" |
| Custo dos produtos | R$ | "sem frete e extras" |
| Capital necessário | R$ | "com frete e extras" |
| Transporte | R$ | "8,0% do custo" (+ " · garantia R$ X" se > 0) |
| Impostos embutidos | R$ | "X% da venda" |
| Margem média | % da venda (700, `#0b6d52`) | "markup médio X%" |

**Regra de conteúdo:** este painel e a barra inferior **não repetem dados**. Topo = composição do custo;
rodapé = resultado da negociação.

### 3. Lista de itens
Cabeçalho da seção: h2 "Itens da cotação" (700/16px) + dica "clique num item para ver fornecedores,
impostos e o cálculo". À direita, quando `economia > 0`: botão verde
"Usar o fornecedor mais barato em tudo · economiza R$ X" (`#e9f7f1` / borda `#c6e9dc` / texto `#0b6d52`).

**Linha do item (colapsada)** — card branco, borda `#e7e5f0`, radius 14, `overflow:hidden`, padding `11px 12px`,
`display:flex; flex-wrap:wrap; gap:10px`:
1. Índice zero-padded ("01"), 26px, mono 12px `#a9a5bd`.
2. Bloco flexível (`flex:1 1 220px`): input da descrição (600/14px, placeholder "ex.: Papel A4 75g — resma")
   e, abaixo, chips: fornecedor escolhido (pill com bolinha roxa, abre o item), chip âmbar
   "R$ X mais barato em Y" (aplica o melhor), chip roxo "impostos próprios", chip vermelho
   "falta preço do fornecedor".
3. Grupo de métricas (`flex:1 1 460px`, wrap, alinhado à direita), cada uma rótulo micro + valor mono
   `nowrap`: Qtd. (input 66px), Custo un. (92px, `#6f6c7d`), **Preço un.** (100px, 700/15px, rótulo roxo),
   **Lucro** (124px, `#0b6d52`, com segunda linha "margem X%" em 500/10.5px `#8fb3a7`),
   **Total** (116px, com segunda linha "markup X%" em 500/10.5px `#a9a5bd`).
   As duas leituras ficam empilhadas — nunca inline com o valor, senão a célula transborda.
4. Ações 30×30: duplicar `⧉`, remover `×` (vermelho), expandir `▼/▲`.

Abaixo da lista: botão tracejado full-width "+ Adicionar item — ou pressione ↵ no último item"
(`#fbfbfe`, borda tracejada `#cfcbe4`, texto `#4f46b8`).

**Painel expandido** — `border-top #eeecf6`, fundo `#faf9fd`, padding `16px 14px 18px`, duas colunas que
quebram (`flex-wrap`):

*Coluna A — Fornecedores* (`flex:1 1 420px`, oculta se prop `mostrarComparativo=false`):
uma linha por fornecedor, `flex-wrap:wrap`, dividida em dois grupos para nunca cortar:
grupo 1 (`flex:1 1 190px`) = radio 18px + nome + `×`; grupo 2 (`flex:1 1 300px`, justify-end) = campos de
largura fixa **Produto (82px) / Frete (70px) / Outros (70px)** e a leitura **Custo un. (88px)**.
Fornecedor escolhido: fundo `#f1effc`, borda `#c2bde4`, radio preenchido. Melhor custo em `#0b6d52`.
Botão "+ fornecedor" tracejado no topo. Nota: "O fornecedor marcado é o que entra no cálculo. O mais
barato fica com o custo em verde."

*Coluna B* (`flex:1 1 330px`), três cards brancos:
- **Markup deste item** — cabeçalho "mín% → alvo%" e **dois controles híbridos**, um por nível:
  *Markup mínimo (reserva)* em âmbar (`#8a6414`, `accent-color` igual) e *Markup alvo (proposta)* em
  roxo (`#4f46b8`). Cada controle = **campo numérico** (72px, mono 700/13px, `min=0`, **sem max**) +
  **slider** `min=0, max=softMax(valor), step=1` + uma linha de leitura dupla abaixo:
  "markup X% sobre o custo" à esquerda e "margem **Y%** da venda" à direita (o valor da margem em
  700 `#6f6c7d`). Os dois níveis se travam entre si (mínimo ≤ alvo) na própria edição.
  Abaixo, chips **"Alvo rápido"**: 25 / 50 / 75 / 100 / 150 / 200% — aplicam o markup alvo; o chip ativo
  fica roxo sólido (`#4f46b8`, texto branco).
  Rodapé do card: **Preço de reserva un.** (âmbar 700/14px) com "markup mín X% · R$ Y no lote" e,
  à direita, **Folga p/ negociar** (verde) + aviso vermelho "no piso — não desça mais" quando
  `precoFinal ≤ precoReserva`.
- **Como chegamos no preço** (oculto se `mostrarMemoria=false`) — escada com sinais `+`/`=`:
  Custo do produto, + Frete fixo, + Outros custos, **= Custo unitário**, + Transporte X% do custo,
  + Garantia extra X% do custo, + **Markup X% sobre o custo**, + Tributos X% da venda,
  **= Preço final unitário**.
  Linhas fortes em 700/13px `#191823`; demais 500/12.5px `#6f6c7d`; separadores `#f1eff8`.
- **Imposto deste item** — botão "usar imposto próprio" / "voltar ao padrão"; quando próprio, um campo
  numérico 120px com sufixo `%` e a nota "% da venda — ICMS/Simples, PIS, COFINS, IPI, ISS somados";
  quando padrão, "Usando o padrão da cotação: X% da venda".

### 4. Padrões da cotação (colapsável, ao fim da lista)
Header clicável com título, subtítulo "valem para todos os itens que não têm regra própria" e resumo
mono à direita ("Transporte 8,0% · Lucro 10,0%–35,0% · Tributos 10,0%").
Resumo mono à direita: "Transporte 8,0% · Markup 12,0%–45,0% · Tributos 10,0%".
Corpo em duas colunas:
- **Markup padrão (sobre o custo)** — os mesmos controles híbridos (campo numérico + slider com
  `softMax`) para *Markup mínimo (reserva)* e *Markup alvo*, travados entre si.
- **Custos adicionais** — sliders Transporte 0–50 e Garantia extra 0–50.
- **Sobre a venda (tributos)** — slider Impostos (soma) 0–60.
Sliders de percentual limitado mostram rótulo à esquerda e valor em % mono roxo à direita. Nota:
"Carga tributária somada: X. Como ela incide sobre a venda, o preço é **custo majorado ÷ (1 − carga)**."
*Só o markup usa campo numérico (por não ter teto); os demais percentuais são sliders.*

### 5. Barra fixa inferior — resultado da negociação
Branca `rgba(255,255,255,.97)` + blur, `border-top #e4e1ef`, `box-shadow 0 -4px 18px rgba(25,24,35,.06)`,
padding `12px 22px`, container 1240px.
Esquerda (`gap:22px`): **Valor cotado** (700/19px `#3a3390`, rótulo roxo), **Lucro** (700/19px `#0b6d52` +
% em 13px), **Preço de reserva** (700/15px âmbar), **Folga p/ negociar** (600/15px `#6f6c7d`) e, se houver,
o chip vermelho "N itens incompletos".
Direita: botão secundário "Exportar" (outlined) e primário **"Salvar Cotação"** (`#4f46b8`, sombra roxa).

### 6. Modal de ajuda ("?")
Overlay `rgba(20,19,39,.45)`; caixa 560px máx, radius 16, `overflow:hidden`, coluna flex com
**header fixo** ("Como usar o cotador" + `×` 30×30 centralizado por flex), **corpo rolável**
(`.om-scroll`, scrollbar de 6px `#d9d5e8`, sem trilha) e **footer fixo** com "Entendi".
Conteúdo: *Atalhos de teclado* (↵ novo item abaixo · ⌘↵ novo item no fim · Tab próximo campo ·
Esc fechar painéis e modais · ? abrir esta ajuda); *Fluxo rápido* em 5 passos numerados; e o bloco
"A conta do preço" com a fórmula em mono e a explicação da divisão por (1 − impostos).

---

## Interactions & Behavior
- **↵ no campo de descrição** cria um item logo abaixo e foca a descrição dele (autofoco após render).
- **⌘/Ctrl + ↵** cria item no fim da lista. **Esc** fecha modais. **Shift + ?** abre/fecha a ajuda
  (ignorado quando o foco está em input/textarea).
- Clicar no card do item (chevron, chip do fornecedor ou botão de detalhes) expande/colapsa; **um item
  expandido por vez** (acordeão).
- Radio do fornecedor troca o `chosen` e recalcula tudo. Remover fornecedor é bloqueado quando resta um;
  se remover o escolhido, cai no primeiro.
- Markup: campo numérico e slider editam o mesmo valor; o `max` do slider é recalculado a cada render
  por `softMax`. Mínimo e alvo se travam entre si (mín ≤ alvo). Valores negativos são zerados.
- Chips de alvo rápido aplicam o markup alvo do item (e sobem o mínimo junto, se ele ficaria acima).
- "Usar o fornecedor mais barato em tudo" aplica `bestSup` a todos os itens de uma vez.
- Duplicar item copia fornecedores e mantém o escolhido pela posição.
- Sem estados de loading/erro no protótipo: a persistência é "salvo automaticamente" (rascunho) e o botão
  "Salvar Cotação" é o commit explícito.
- Responsivo por wrap: header, painel de totais (grid auto-fit), grupo de métricas e linhas de fornecedor
  quebram em linhas; larguras fixas nos campos monetários evitam corte. Alvos de toque ≥ 30px (revisar
  para ≥ 44px em mobile nativo).

## State Management
Estado local da tela: `titulo`, `itens[]` (com `suppliers[]`, `chosen`, `mMin`, `mMax`, `taxes`),
`defaults{}`, `expanded` (id do item aberto ou null), `padroes` (bool), `atalhos` (bool).
Todos os totais são **derivados** a cada render — nenhum total é guardado em estado.
Integração esperada no produto real: carregar `itens` a partir da oportunidade consultada (GET),
autosave do rascunho e POST no "Salvar Cotação".

## Design Tokens
Cores
```
Fundo da tela      #f4f3f8      Card                 #ffffff
Card de totais     #eceaf4      Borda card totais    #d8d4e8
Bordas             #e7e5f0 / #e4e1ef / #dedbeb        Divisor interno #eeecf6 / #f1eff8
Texto forte        #191823      Texto médio #403c55 / #6f6c7d   Texto fraco #8a86a0 / #a9a5bd / #b9b5cc
Primária (roxo)    #4f46b8      Hover #413a9e   Escuro #3a3390   Tint #f1effc   Borda tint #dcd8f4
Verde (lucro)      #0b6d52 / #0d7a5c   Tint #e9f7f1   Borda #c6e9dc   Sutil #8fb3a7
Âmbar (reserva/markup mín) #8a6414   Slider #c08a1c   Tint #fdf6e8   Borda #f3ddb8
Vermelho (erro)    #a52d2d      Tint #fdefef   Borda #f5cfcf
Overlay modal      rgba(20,19,39,.45)     Scrollbar #d9d5e8 (hover #c2bde4)
```
Tipografia — **Plus Jakarta Sans** (400/500/600/700/800) para texto; **JetBrains Mono** (400/500/600)
para todo número, com `font-variant-numeric: tabular-nums`.
```
Título da tela 700/17    Seção 700/16    Card do modal 700/17
Rótulo micro   700/9–9.5, letter-spacing .09–.1em, uppercase
Corpo          500–600/12.5–14          Apoio 500/11–11.5
Números        mono 12.5–19 (destaque do valor cotado 19)
```
Espaçamento: 4 / 6 / 8 / 9 / 10 / 12 / 14 / 16 / 22 px. Radius: 6 (kbd) · 8–10 (botões/inputs) ·
12 (cards de totais) · 14 (cards de item/painéis) · 16 (modal) · 20px pill.
Sombras: `0 2px 8px rgba(79,70,184,.28)` (botão primário) · `0 -4px 18px rgba(25,24,35,.06)` (barra inferior) ·
`0 24px 60px rgba(20,19,39,.3)` (modal). Foco: `border-color:#4f46b8` + `box-shadow 0 0 0 3px rgba(79,70,184,.13)`.
Animação: `popIn` 180ms ease (opacity + translateY -4px) na entrada do modal.

## Assets
Nenhum asset binário. Fontes via Google Fonts (Plus Jakarta Sans, JetBrains Mono). Ícones são glifos de
texto (`⧉ × ▲ ▼ +`) — substituir pelos ícones do design system do codebase.

## Files
- `Cotador.dc.html` — protótipo hifi completo (template + classe de lógica com as fórmulas). Abra no navegador.
- `referencia-formulario-original.png` — captura do formulário antigo, para contexto do "antes".


---

## Changelog — markup (última alteração)
Substituição do ajuste de "margem" por **markup**, com margem virando leitura derivada:
1. `defaults.lucroMin/lucroMax` → `defaults.markupMin/markupAlvo`; `Item.mMin/mMax` passam a ser markup.
2. Markup **não tem teto** — controle híbrido (campo numérico sem `max` + slider com `softMax` que cresce)
   e chips de alvo rápido 25–200%.
3. Toda tela que dizia "margem" como controle passou a dizer "markup"; a **margem (% da venda)** aparece
   como leitura em: linha de leitura dupla sob cada slider, segunda linha da célula "Lucro" na lista,
   e card "Margem média" do painel superior (com "markup médio" na linha de apoio).
4. Escada de cálculo: "Lucro X% do custo" → "**Markup X% sobre o custo**".
5. Célula "Lucro" alargada para 124px com o percentual empilhado (era inline e transbordava).
