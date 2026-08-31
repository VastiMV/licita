# Handoff: Cadastro de Fornecedores (Supplier Registry)

## Overview
A supplier registry screen for an internal procurement tool: a searchable, paginated table of suppliers with a per-row actions dropdown (Edit / Delete) and a wide modal form used for both creating and editing a supplier. Visual language is derived from an existing screen in the same product ("Oportunidades salvas"), included here as `referencia-template-oportunidades.png` — the new screen must feel like a sibling of it.

All copy is Brazilian Portuguese (pt-BR) and should stay in pt-BR.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. The task is to **recreate this design inside the target codebase's existing environment** (React, Vue, Angular, Blazor, server-rendered templates, etc.) using its established component library, form handling, table/grid, modal, and styling patterns. If the project has no front-end environment yet, pick the most appropriate framework and implement it there.

In particular: the prototype holds data in local component state with hardcoded seed rows. In production, the list, search, sorting, pagination, create, update, and delete must go through the real API/persistence layer.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, shadows, and interaction states are final and specified below. Recreate the UI faithfully — but if the codebase already has an equivalent primitive (button, input, select, modal, badge, table), prefer that primitive and align its tokens to the values below rather than hand-rolling new components.

## Screens / Views

### 1. Lista de fornecedores (main page)

**Purpose:** Find a supplier, judge its status at a glance, add a new one, edit or delete an existing one.

**Layout**
- Page: `min-height:100vh`, background `#dfe5ef`, padding `48px 40px 80px`.
- Content column: `max-width:1180px`, centered (`margin:0 auto`).
- Header row: flex, `align-items:flex-start`, `justify-content:space-between`, `gap:32px`. Left = title + intro (`max-width:620px`); right = primary button (`flex:none`, `margin-top:10px`).
- Card: `margin-top:30px`, background `#fff`, `border-radius:12px`, `box-shadow:0 2px 10px rgba(22,38,74,.07)`, `overflow:hidden`.

**Header components**
- H1 "Cadastro de fornecedores" — 34px / 700 / `letter-spacing:-.6px` / `line-height:1.1` / `#16264a`, margin `0 0 18px`.
- Intro paragraph — 14.5px / 400 / `line-height:1.65` / `#5b7099` / `text-wrap:pretty`. Exact copy:
  "Fornecedores habilitados para cotação e compra — a lista é compartilhada por todos os usuários. As linhas destacadas em **vermelho** têm documentação vencida e não podem ser usadas em novos processos." The word "vermelho" is inline-colored `#c0563a`.
- Primary button "+ Adicionar fornecedor" — height 46px, padding `0 22px`, background `#16264a`, text `#fff` 14px/600, `border-radius:9px`, no border, `box-shadow:0 6px 16px rgba(22,38,74,.22)`, gap 9px between the "+" glyph (19px, weight 400, `margin-top:-2px`) and the label. Hover: background `#1f3565`, shadow `0 8px 20px rgba(22,38,74,.3)`. Opens the modal in **create** mode.

**Toolbar (inside card)**
- Padding `22px 24px 18px`, flex, `align-items:flex-end`, `justify-content:space-between`, `gap:24px`, `flex-wrap:wrap`.
- Search field: wrapper `flex:1; min-width:280px; max-width:430px`. Label "BUSCAR" — 10.5px / 600 / `letter-spacing:1.1px` / `#7d8ca8`, `margin-bottom:8px`. Input height 44px, padding `0 15px`, border `1px solid #dbe2ee`, radius 8px, 14px text `#16264a`, placeholder `#a7b3c9` "Busca por razão social, CNPJ ou categoria...". Focus: border `#8fa6cf` + `box-shadow:0 0 0 3px rgba(143,166,207,.18)`.
- Rows selector: label "LINHAS" (same style as BUSCAR) + segmented group `1px solid #dbe2ee`, `border-radius:7px`, `overflow:hidden`. Each option 42×34px, 13px; dividers are `border-left:1px solid #dbe2ee` on all but the first. Selected: background `#16264a`, text `#fff`, weight 600. Unselected: `#fff` / `#5b7099` / weight 500. Options: `10 | 25 | 50`, default **10**.

**Table**
Implemented as CSS grid rows (not `<table>`) with columns `2.4fr 1.3fr 1.25fr 1.5fr 1fr .9fr`, `align-items:center`, `gap:16px`, horizontal padding 24px. Use a real semantic table or accessible grid roles in production.

- Header row: padding `13px 24px`, background `#fcfdff`, `border-top` and `border-bottom` `1px solid #eef1f7`. Labels 11.5px / 600 / `letter-spacing:.7px` / `#5b7099`, uppercase: `RAZÃO SOCIAL ⌄`, `CNPJ ⌄`, `CIDADE ⌄`, `CATEGORIA ⌄`, `SITUAÇÃO`, `AÇÕES` (right-aligned). The `⌄` sort affordance is `#a7b3c9`; sorting is **not yet implemented** in the prototype — wire it to real sorting.
- Body row: padding `16px 24px`, `border-bottom:1px solid #f2f5fa`. Background: `#fdf6f5` when `situacao === "Documentação vencida"`; otherwise zebra — even index `#fff`, odd index `#fcfdff`.
- Col 1: razão social 14px / 500 / `#16264a` / `line-height:1.35`; below it nome fantasia 12px / `#8a99b5`, `margin-top:3px`.
- Col 2: CNPJ 13.5px / `#3d5480`, `font-variant-numeric:tabular-nums`.
- Col 3: cidade "Cidade / UF" 13.5px / `#3d5480`.
- Col 4: categoria 13.5px / `#1b3b6f`.
- Col 5: status badge — `padding:5px 11px`, `border-radius:20px`, 11.5px / 600, `white-space:nowrap`:
  - Ativo — bg `#e8f4ec`, text `#1f6b40`
  - Em análise — bg `#fdf3e3`, text `#9a6a15`
  - Inativo — bg `#eef1f7`, text `#5b7099`
  - Documentação vencida — bg `#fdeceb`, text `#b8402c`
- Col 6: "Ações ⌄" trigger button, right-aligned — height 36px, padding `0 14px`, `border:1px solid #dbe2ee`, radius 7px, 13px / 500 / `#16264a`, background `#fff`. Hover **and open** state: border `#8fa6cf`, background `#f6f9ff`.

**Actions dropdown**
- Anchored to the trigger: `position:absolute; top:42px; right:0; width:172px`, background `#fff`, `border:1px solid #e6ebf5`, `border-radius:9px`, `box-shadow:0 12px 28px rgba(11,20,40,.16)`, `padding:6px`, `z-index:20`, column flex.
- Items: full width, `padding:9px 11px`, radius 6px, 13.5px, left-aligned, no border/background.
  - "Editar" — `#16264a`, hover background `#f4f7fc`. Opens the modal in **edit** mode, prefilled.
  - "Excluir" — `#b8402c`, hover background `#fdeceb`. Removes the row.
- Only one menu open at a time; clicking anywhere outside closes it (document click listener, trigger stops propagation). **Production note:** "Excluir" should show a confirmation dialog and call the delete endpoint — the prototype deletes immediately with no confirm.

**Empty state**
When the filtered list is empty: `padding:56px 24px`, centered, 14px `#8a99b5` — "Nenhum fornecedor encontrado para essa busca."

**Footer / pagination**
- Padding `20px 24px`, flex, space-between.
- Left: 13.5px `#b0692f` — "Mostrando {from}–{to} de {total}" (from is 0 when the list is empty).
- Right: prev button, "Página {n} de {m}" (13.5px `#5b7099`), next button. Buttons 36×36px, `#fff`, `border:1px solid #dbe2ee`, radius 7px, glyphs `‹` / `›` 14px `#5b7099`; hover border `#8fa6cf`, color `#16264a`. Page clamps to `[1, pageCount]`; changing search or page size resets to page 1.

### 2. Modal de fornecedor (create + edit)

Same modal for both modes; only the kicker, title, and submit label differ.

**Shell**
- Overlay: `position:fixed; inset:0`, `background:rgba(15,26,50,.5)`, `backdrop-filter:blur(2px)`, flex `align-items:flex-start; justify-content:center`, `padding:44px 24px`, `overflow:auto`, `z-index:50`.
- Panel: `width:100%; max-width:1040px`, `#fff`, `border-radius:14px`, `box-shadow:0 24px 60px rgba(11,20,40,.35)`, `overflow:hidden`.

**Header** — padding `24px 32px 20px`, `border-bottom:1px solid #eef1f7`, space-between.
- Kicker 10.5px / 600 / `letter-spacing:1.1px` / `#a08050`: "NOVO FORNECEDOR" (create) or "EDITAR FORNECEDOR" (edit).
- Title 23px / 600 / `letter-spacing:-.3px` / `#16264a`, `margin-top:7px`: "Cadastrar fornecedor" (create) or the supplier's razão social (edit).
- Close button `✕` — 36×36px, background `#f4f7fc`, `border:1px solid #e6ebf5`, radius 8px, `#5b7099` 16px; hover background `#e9eff9`, color `#16264a`.

**Body** — padding `28px 32px 8px`, `max-height:min(62vh,620px)`, `overflow:auto`. Section headings: 11px / 600 / `letter-spacing:1.1px` / `#7d8ca8`, `margin-bottom:16px`. Section dividers: `height:1px; background:#eef1f7; margin:28px 0 22px`.

Field styling (all sections): label 12.5px / 500 / `#3d5480`, `gap:7px` above the control; required marker `*` in `#c0563a`. Inputs/selects height 44px, `border:1px solid #dbe2ee`, radius 8px, 14px `#16264a`, input padding `0 14px`, select padding `0 12px`; focus border `#8fa6cf` + `box-shadow:0 0 0 3px rgba(143,166,207,.18)`. Grid gap `18px 20px`.

- **DADOS DA EMPRESA** — grid `1.4fr 1fr .8fr`:
  1. Razão social* (placeholder "Ex.: Marucci Distribuidora Ltda")
  2. Nome fantasia ("Como é conhecido")
  3. Tipo — select: Pessoa jurídica (default) / Pessoa física / MEI
  4. CNPJ / CPF* ("00.000.000/0000-00", tabular-nums)
  5. Inscrição estadual ("Isento ou número")
  6. Categoria* — select: Materiais (default) / Equipamentos / Serviços / Logística / Tecnologia
- **ENDEREÇO** — grid `.7fr 2fr .6fr 1.2fr`:
  CEP ("00000-000") · Logradouro ("Rua, avenida") · Número ("000") · Complemento ("Sala, galpão") · Bairro (spans 2 columns) · UF (select: SP default, RJ, MG, PR, RS, SC, BA, GO — production should list all 27) · Cidade
- **CONTATO** — grid `1fr 1fr 1fr 1fr`:
  Responsável ("Nome do contato") · E-mail* ("compras@empresa.com.br") · Telefone ("(00) 0000-0000") · Celular / WhatsApp ("(00) 00000-0000")
- **COMERCIAL E BANCÁRIO** — grid `1fr 1fr 1fr 1fr`:
  Condição de pagamento (select: À vista / 7 dias / 14/28 dias / **30 dias** default / 30/60/90 dias) · Prazo de entrega (dias) ("Ex.: 10") · Banco / agência / conta ("000 / 0000 / 00000-0") · Chave PIX ("CNPJ, e-mail ou aleatória")
- **Bottom split** — `margin-top:22px`, grid `1.6fr 1fr`, `gap:20px`, `align-items:start`:
  - Observações textarea — `min-height:96px`, padding `12px 14px`, `line-height:1.55`, `resize:vertical`, placeholder "Restrições de entrega, histórico, contatos alternativos..."
  - "Situação do fornecedor" panel — background `#f7f9fd`, `border:1px solid #e9eff9`, radius 10px, padding `16px 18px`; heading 12.5px / 600 / `#3d5480`, `margin-bottom:12px`; then a vertical `gap:9px` list of 4 single-select option buttons (Ativo default / Em análise / Inativo / Documentação vencida) — left-aligned, `padding:9px 12px`, radius 8px, 13px / 500. Selected: background + border `#16264a`, text `#fff`. Unselected: `#fff`, border `#dbe2ee`, text `#3d5480`.

**Footer** — padding `20px 32px`, `border-top:1px solid #eef1f7`, background `#fcfdff`, space-between.
- Left hint 12.5px `#8a99b5`: "Campos com * são obrigatórios" (the `*` in `#c0563a`).
- Right: "Cancelar" — height 44px, padding `0 20px`, `#fff`, `border:1px solid #dbe2ee`, radius 9px, 14px / 500 / `#3d5480`; hover border `#8fa6cf`, color `#16264a`. Then primary submit — height 44px, padding `0 26px`, `#16264a`, `#fff` 14px/600, radius 9px, `box-shadow:0 6px 16px rgba(22,38,74,.22)`, hover `#1f3565`. Label: "Cadastrar fornecedor" (create) / "Salvar alterações" (edit).

## Interactions & Behavior
- **Add:** header button → modal in create mode with blank form (defaults: Tipo = Pessoa jurídica, Categoria = Materiais, UF = SP, Condição = 30 dias, Situação = Ativo).
- **Edit:** row "Ações" → "Editar" → modal prefilled from the row; closes the dropdown.
- **Delete:** row "Ações" → "Excluir" → row removed. Add a confirm step + API call in production.
- **Dropdown:** toggles on trigger click, closes on outside click and after choosing an item; single open menu.
- **Save (create):** prepends the new supplier to the top of the list, builds `cidade` as `"{cidade} / {uf}"` (or `—` when blank), falls back to "Fornecedor sem nome" when razão social is empty, and closes the modal. **No validation exists in the prototype** — implement required-field validation (Razão social, CNPJ/CPF, Categoria, E-mail), CNPJ checksum, CNPJ uniqueness, CPF/CNPJ + CEP + phone masks, and inline error messaging (use `#c0563a` for error text/borders).
- **Save (edit):** merges the form into the existing record by id and closes the modal.
- **Cancel / ✕:** closes the modal, discarding changes (no dirty-state warning in the prototype — consider adding one).
- **Search:** case-insensitive substring match across razão social + nome fantasia + CNPJ + categoria + cidade; resets to page 1. Debounce and move server-side for real data volumes.
- **Sorting:** header chevrons are visual only in the prototype — implement real sorting on Razão social, CNPJ, Cidade, Categoria.
- **Missing states to add:** loading (table skeleton + submit spinner/disabled), API error, delete confirmation, success toast, keyboard handling (Esc closes modal, focus trap, focus return to trigger), responsive collapse of the 4-column modal grids to 2 and then 1 column on narrow viewports.

## State Management
Prototype state (single component):
- `items: Supplier[]` — the list (seeded; replace with fetched data)
- `query: string` — search text
- `size: 10 | 25 | 50` — page size
- `page: number` — current page, clamped to `[1, pageCount]`
- `modalOpen: boolean`
- `editingId: number | null` — null = create mode
- `form: Supplier` — modal working copy (a full field object; see below)
- `menuId: number | null` — id of the row whose dropdown is open

Derived: `filtered` (query filter), `pageCount = max(1, ceil(filtered.length / size))`, `slice` (current page rows), `shownFrom/shownTo/total`.

Supplier fields: `nome, fantasia, tipo, cnpj, ie, categoria, cep, rua, numero, compl, bairro, uf, cidade, contato, email, telefone, celular, pagamento, prazo, banco, pix, obs, situacao` (+ `id`).

Data needs in production: `GET /fornecedores` (search + sort + pagination params), `POST /fornecedores`, `PUT /fornecedores/:id`, `DELETE /fornecedores/:id`, plus optional CEP lookup (ViaCEP) to auto-fill logradouro/bairro/cidade/UF, and CNPJ lookup to prefill company data.

## Design Tokens

**Colors**
| Token | Value |
|---|---|
| Page background | `#dfe5ef` |
| Surface / card | `#fff` |
| Surface subtle (zebra, header, footer) | `#fcfdff` |
| Surface panel (situação box) | `#f7f9fd` |
| Surface hover | `#f4f7fc` / `#f6f9ff` |
| Text strong (titles, values) | `#16264a` |
| Text body / label | `#3d5480` |
| Text muted | `#5b7099` |
| Text faint | `#8a99b5` |
| Text micro-label | `#7d8ca8` |
| Placeholder / chevron | `#a7b3c9` |
| Link / categoria | `#1b3b6f` |
| Primary (brand navy) | `#16264a`; hover `#1f3565` |
| Accent amber (counts, kicker, link hover) | `#b0692f` / `#a08050` |
| Danger / alert text | `#c0563a`, `#b8402c` |
| Danger surface | `#fdeceb`; row tint `#fdf6f5` |
| Success surface / text | `#e8f4ec` / `#1f6b40` |
| Warning surface / text | `#fdf3e3` / `#9a6a15` |
| Neutral surface / text | `#eef1f7` / `#5b7099` |
| Border default | `#dbe2ee` |
| Border light | `#e6ebf5` / `#e9eff9` |
| Divider | `#eef1f7`; row divider `#f2f5fa` |
| Focus ring | `#8fa6cf` + `rgba(143,166,207,.18)` |

**Typography** — Poppins (Google Fonts, weights 300/400/500/600/700), fallback `system-ui, sans-serif`.
34/700 page title · 23/600 modal title · 14.5/400 intro · 14/500 row primary · 14/400 inputs · 13.5/400 cell + pagination · 13/500 buttons · 12.5/500 field labels · 12/400 secondary · 11.5/600 (.7px) table headers · 11.5/600 badges · 11 & 10.5/600 (1.1px) micro-labels.

**Spacing** — 3 · 7 · 9 · 12 · 16 · 18 · 20 · 22 · 24 · 28 · 30 · 32 · 40 · 44 · 48 px.

**Radii** — 6 (menu item) · 7 (small button, segmented) · 8 (input, select, option) · 9 (primary button, dropdown) · 10 (panel) · 12 (card) · 14 (modal) · 20px pill (badge).

**Shadows**
- Card: `0 2px 10px rgba(22,38,74,.07)`
- Primary button: `0 6px 16px rgba(22,38,74,.22)` → hover `0 8px 20px rgba(22,38,74,.3)`
- Dropdown: `0 12px 28px rgba(11,20,40,.16)`
- Modal: `0 24px 60px rgba(11,20,40,.35)`
- Focus ring: `0 0 0 3px rgba(143,166,207,.18)`

**Control heights** — 34 (segmented) · 36 (row action, icon button) · 44 (input, select, footer buttons) · 46px (primary header button).

## Assets
No image or icon assets. All affordances are text glyphs: `+`, `⌄`, `✕`, `‹`, `›`. Replace them with the codebase's icon set (plus, chevron-down, x, chevron-left/right, and pencil/trash in the dropdown if the design system uses leading icons in menus). Only external dependency is the Poppins webfont — use the app's existing font pipeline. The palette and layout come from the product's existing "Oportunidades salvas" screen (`referencia-template-oportunidades.png`); prefer the real tokens in the codebase where they correspond.

## Files
- `Cadastro de Fornecedores.dc.html` — the full prototype (markup + logic in one file; open directly in a browser). Search, page size, pagination, dropdown, create and edit modal all work against in-memory state.
- `referencia-template-oportunidades.png` — screenshot of the existing product screen this design was matched to.
