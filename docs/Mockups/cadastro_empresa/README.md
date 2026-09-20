# Handoff: Cadastro de Empresa (lista + documentos)

## Overview
Tela de cadastro de empresas (fornecedores/clientes) com uma lista principal e um modal de edição que gerencia os documentos da empresa (upload, versionamento, status de validade). O objetivo é dar visibilidade rápida, na própria tabela, de quais empresas têm documentação vencida — e permitir gerenciar esses documentos em detalhe dentro do modal.

**Este handoff cobre apenas o módulo "Empresas".** O módulo de Proposta/Cotação será entregue em um handoff separado.

## About the Design Files
O arquivo `design_reference.dc.html` é uma **referência de design em HTML** — um protótipo mostrando aparência e comportamento pretendidos, não código de produção para copiar diretamente. A tarefa é recriar este design no ambiente/stack já existente do projeto de destino (React, Vue, etc.), seguindo os padrões de componentes já estabelecidos ali. Se não houver stack definida, escolher o framework mais adequado ao projeto.

## Fidelity
**Alta fidelidade (hifi)** para layout, cores, tipografia e hierarquia de informação. Os dados (nomes de empresas, CNPJs, documentos) são fictícios/placeholder — substituir pelos dados reais do backend.

## Screens / Views

### 1. Lista de Empresas
**Purpose:** Ver todas as empresas cadastradas, identificar rapidamente quais têm documentação vencida, buscar/filtrar, abrir uma empresa para editar ou adicionar uma nova.

**Layout:**
- Página com fundo `#eef1f5`, conteúdo centralizado em container `max-width: 1200px`, padding lateral `28px`, padding vertical `32px` no topo.
- Cabeçalho: título "Empresas" (28px, weight 800, letter-spacing -0.01em) + subtítulo cinza (14px, `#767c88`, line-height 1.5) à esquerda; botão primário "+ Adicionar empresa" à direita (alinhados `flex; justify-content: space-between`, com wrap em telas estreitas).
- Botão primário: fundo `#1a2233`, texto branco, `border-radius: 9px`, padding `11px 18px`, font-weight 700, size 13.5px; hover `#28324a`.
- Card branco (`#fff`, `border: 1px solid #e2e5ea`, `border-radius: 14px`, overflow hidden) contendo:
  - Barra de busca + paginação: label "BUSCAR" (11px, weight 700, letter-spacing 0.06em, cor `#9aa0aa`) com input abaixo (max-width 420px, padding 9px 12px, border-radius 9px, border `#d9dce1`); à direita, label "LINHAS" + 3 botões pill (10/25/50) — estado ativo com fundo `#1a2233`/texto branco, inativo fundo branco/texto `#3d4453`, borda `#d9dce1`.
  - Cabeçalho de colunas (11px, weight 700, cor `#767c88`, sem fundo, apenas texto): Razão Social (flex 2.2), CNPJ/CPF (1.2), Cidade (0.6), Categoria (1), Documentação (1.1), Ações (0.9, alinhado à direita).
  - Linhas: `display:flex` com `flex-wrap:wrap`, padding `16px 20px`, borda superior `1px solid #edeff2`, a linha inteira é clicável (abre o modal).
    - Nome da empresa como link (14px, weight 700) + linha secundária cinza (12px, `#9aa0aa`): "{N} documentos" e, se houver vencidos, sufixo " · {N} vencido(s)".
    - **Linha destacada em vermelho** (fundo `oklch(0.98 0.015 27)`, hover `oklch(0.965 0.02 27)`) quando a empresa tem ao menos 1 documento vencido.
    - Coluna "Documentação": pill de status — "Documentação válida" (fundo verde claro `oklch(0.93 0.05 152)`, texto `oklch(0.40 0.10 152)`) ou "Documentação vencida" (fundo vermelho claro `oklch(0.94 0.05 27)`, texto `oklch(0.48 0.16 27)`). Pill: `border-radius: 999px`, padding `4px 10px`, font-size 11.5px, weight 700.
    - Botão "Ações ▾" à direita: borda `#d9dce1`, fundo branco, hover `#f5f6f8`.

### 2. Modal "Empresa" (novo ou edição)
**Purpose:** Editar dados cadastrais e gerenciar os documentos da empresa (upload, nova versão, histórico, validade).

**Layout:**
- Overlay: `position: fixed; inset:0; background: rgba(20,24,34,0.5)`, centraliza o modal, padding `28px`, z-index alto. Fecha ao clicar no overlay (não no conteúdo do modal).
- Painel: fundo branco, `border-radius: 16px`, `max-width: 880px`, `max-height: 88vh` com scroll interno, `box-shadow: 0 24px 60px rgba(0,0,0,0.25)`.
- Header do modal (sticky no topo do painel): kicker "EMPRESA" (12px, weight 700, letter-spacing 0.05em, cor `#9aa0aa`) + título = nome da empresa (20px, weight 800). Botão fechar "✕" no canto superior direito (borda `#e2e5ea`, hover `#f5f6f8`).
- Corpo (padding `22px 26px 26px`):
  1. **Formulário de dados cadastrais**: grid `repeat(auto-fit, minmax(180px,1fr))`, gap 14px. Campos: Razão Social, CNPJ/CPF, Cidade, Categoria. Cada campo tem label acima (11px, weight 700, cor `#9aa0aa`) e input (padding `9px 11px`, border-radius 8px, borda `#d9dce1`).
  2. **Cards de resumo de documentos** — grid `repeat(auto-fit, minmax(150px,1fr))`, gap 12px, 3 cards fixos:
     - "Válidos": número grande (22px, weight 800) sobre fundo `oklch(0.96 0.03 152)`, texto `oklch(0.38 0.10 152)`.
     - "Vencidos": mesmo padrão, fundo `oklch(0.96 0.03 27)`, texto `oklch(0.46 0.16 27)`.
     - "Pendentes": fundo `#f1f2f4`, texto `#5a6070`.
     - Cada card: `border-radius: 12px`, padding `14px 16px`, número + label (12px, weight 600) abaixo.
  3. **Seção "Documentos da empresa"** (título 13.5px, weight 800):
     - **Dropzone** de upload: borda tracejada `#d5d8dd`, fundo `#fafbfc`, `border-radius: 12px`, padding 18px, ícone "↑" em quadrado branco com borda, texto "Arraste arquivos ou clique para enviar" (13.5px, weight 700) + subtexto "PDF, DWG, XLSX e imagens até 50 MB" (12px, `#9aa0aa`), link "Selecionar arquivos" à direita. Suporta drag-and-drop e clique.
     - **Barra de progresso de upload** (aparece durante envio): fundo `#f6f7f9`, `border-radius: 10px`, padding `11px 14px`, % em mono, barra `height:6px` fundo `#e2e5ea` preenchimento `oklch(0.55 0.15 255)`.
     - **Filtros por chip**: "Todos", "Vencidos", "Pendentes" — pill, ativo fundo `#1a2233`/texto branco, inativo borda `#d9dce1`.
     - **Lista de documentos**: cada linha com ícone de extensão (28×32px, borda, mono 8.5px), nome (13px weight 700, truncado com ellipsis) + metadados (11.5px, `#9aa0aa`), versão (mono), data de atualização, pill de status ("Válido"/"Vencido"/"Pendente" — mesmas cores dos cards), botões "Versões" e "+ versão" à direita.
       - **Linha com destaque vermelho** (`oklch(0.98 0.015 27)`) quando o documento está vencido.
       - Clicar em "Versões" expande um bloco abaixo com histórico: tag da versão (mono), nota da alteração, data, link "Baixar". Fundo `#fafbfc`.
- Footer do modal (sticky no rodapé): botões "Cancelar" (borda `#d9dce1`, fundo branco) e "Salvar empresa" (fundo `#1a2233`, texto branco, weight 700).

## Interactions & Behavior
- Clicar em qualquer parte da linha da tabela (ou no nome/botão Ações) abre o modal de edição daquela empresa.
- Botão "+ Adicionar empresa" abre o mesmo modal vazio (modo criação).
- Overlay: clique fora do painel fecha o modal; clique dentro do painel não propaga (`stopPropagation`).
- Upload: clique na dropzone ou drag-and-drop inicia uma simulação de progresso (0→100%) e, ao concluir, registra a nova versão do documento e mostra um toast de confirmação ("{arquivo} enviado — nova versão registrada").
- Toast: aparece fixo no centro-inferior da tela (`#1a2233`, texto branco, `border-radius:10px`), desaparece automaticamente após ~2.4s.
- Busca: filtra a lista de empresas por razão social, CNPJ, cidade ou categoria, em tempo real (case-insensitive).
- Paginação simples (10/25/50): limita quantas linhas são exibidas (não é paginação real de backend nesta referência).
- Filtro de documentos (Todos/Vencidos/Pendentes) filtra a lista dentro do modal.
- Expandir/ocultar histórico de versões por documento (um por vez, clique alterna).
- "Salvar empresa" fecha o modal e mostra toast de confirmação.

## State Management
- `companySearch: string` — texto da busca.
- `pageSize: number` — 10 | 25 | 50.
- `modalOpen: boolean`, `modalId: number | null` — empresa sendo editada (null = criação).
- `modalDocs: Document[]` — cópia editável dos documentos da empresa aberta.
- `modalExpanded: string | null` — nome do documento com histórico expandido.
- `docFilter: string` — filtro ativo dentro do modal.
- `uploading: boolean`, `uploadPct: number`, `uploadName: string` — estado do upload em progresso.
- `toast: string | null` — mensagem de confirmação temporária.
- Dados: `Company { id, name, doc (CNPJ/CPF), city, category, docs: Document[] }`; `Document { name, ext, category, version, updated, status: 'valido'|'vencido'|'pendente', versions: [{tag, note, when}] }`.
- Status geral da empresa (pill na tabela) é **derivado**: se algum documento está `vencido` → "Documentação vencida"; senão → "Documentação válida".

## Design Tokens

**Cores**
- Fundo de página: `#eef1f5`
- Fundo de cards/modal: `#fff`
- Borda padrão: `#e2e5ea` / `#edeff2` (mais clara, divisórias internas) / `#d9dce1` (inputs/botões)
- Texto principal: `#1a2233`
- Texto secundário: `#767c88`
- Texto terciário/placeholder: `#9aa0aa`
- Botão primário (dark navy): `#1a2233`, hover `#28324a`
- Accent / links: `oklch(0.55 0.15 255)`, hover `oklch(0.46 0.15 255)`
- Status válido/aprovado: fundo `oklch(0.93–0.96 0.03–0.05 152)`, texto `oklch(0.38–0.40 0.10 152)`
- Status vencido: fundo `oklch(0.94–0.98 0.015–0.05 27)`, texto `oklch(0.46–0.48 0.16 27)`
- Status pendente: fundo `#eef0f3`/`#f1f2f4`, texto `#767c88`/`#5a6070`
- Toast: `#1a2233` / texto branco

**Tipografia**
- Fonte: "Public Sans" (Google Fonts), fallback Helvetica/Arial. Pesos: 400, 500, 600, 700, 800.
- Fonte mono (versões, CNPJ, %): "IBM Plex Mono", pesos 400/500.
- Título de página: 28px / weight 800 / letter-spacing -0.01em
- Título de modal: 20px / weight 800
- Corpo/tabela: 13–14px / weight 400–700
- Labels/eyebrows: 11–12px / weight 700 / letter-spacing 0.05–0.06em / uppercase

**Espaçamento e forma**
- Border-radius: 8–9px (inputs/botões), 12px (dropzone/cards de doc), 14px (card de tabela), 16px (modal)
- Gap padrão entre elementos: 8–16px
- Container principal: max-width 1200px (lista) / 880px (modal)

**Sombra**
- Modal: `0 24px 60px rgba(0,0,0,0.25)`
- Toast: `0 8px 24px rgba(0,0,0,0.18)`

## Assets
Nenhuma imagem ou ícone externo — usa apenas caracteres/glifos simples ("↑", "✕", "▾", "·") como ícones. Sem imagens de produto ou logos nesta tela.

## Files
- `design_reference.dc.html` — protótipo completo do módulo Empresas (Design Component / HTML+JS autocontido).
