# Mapa Completo — "Licitante Prime" (referência para automação do fluxo de licitação)

> Documentação gerada por exploração manual e funcional do painel em
> `painel.localizadordeeditais.com.br` (marca do produto: **Licitante Prime**),
> em 27/08/2026. Complementa o arquivo `gerador-proposta-declaracao-licitante-prime.md`
> enviado antes — este aqui cobre **todos os demais módulos** do sistema, com o
> objetivo de servir de referência funcional completa para desenhar um sistema
> próprio que automatize o máximo possível do processo de licitação.

## Sumário do que existe no produto

| Módulo | O que faz | Precisa de cadastro prévio? |
|---|---|---|
| Buscar Licitações | busca por palavra-chave/UF/modalidade/valor em várias plataformas | Não |
| Radar de Licitações | busca por proximidade geográfica (mapa + raio em km) | Não |
| Licitações favoritas | lista de editais marcados com ★ | Não |
| Calendário | agenda mensal de prazos/aberturas | Parcial (filtros por empresa) |
| CRM do Licitante + Kanban | dashboard e quadro kanban por etapa do funil, multi-empresa | Sim (empresa cadastrada) |
| Gestor de documentos | repositório de documentos com alerta de vencimento | Sim |
| Gerador de Proposta | gera proposta em documento a partir do edital + dados da empresa | Sim |
| Gerador de Declarações | gera declarações padrão de habilitação | Sim |
| Leitor de Edital IA | resume PDF do edital via IA | Não |
| Docs Jurídicos IA | gera impugnação, recurso, contrarrazões etc. | Não |
| Cotação Online IA / Precificação Inteligente | pesquisa preço de mercado em tempo real (varejo) por item do pregão | Não |
| Pesquisa de Preço (Beta) | analisa preços homologados historicamente em pregões públicos (CATMAT) | Não |
| Monitoramento de Chat | app desktop que monitora o chat do pregão em tempo real e alerta por Telegram | Assinatura própria |
| Cadastro Comprasnet | extensão de Chrome que **preenche automaticamente** os itens da proposta no Comprasnet | Licença própria |
| Cadastrar Empresa Parceira | cadastro de empresas de terceiros com comissão (modelo agência/despachante) | Sim |
| Sua empresa | cadastro central da empresa + alertas por e-mail | — |

## 1. Licitações favoritas

Lista simples (`/favoritos/`) dos editais marcados com ★ em qualquer tela de
busca. Tem botão "Limpar Favoritos" e paginação (10/20/50 por página). Serve
como "shortlist" de trabalho antes de decidir em quais editais entrar.

## 2. Calendário + Kanban (pipeline de acompanhamento)

`/calendario/` mostra um calendário mensal com navegação por mês, filtro por
**Status** e por **Empresa**, e um botão "Ir para o Kanban" que leva a
`/kanban-crm/`.

O Kanban (`/kanban-crm/`) é o coração do acompanhamento operacional:

- Seleção de **empresa** (o sistema é multiempresa — uma conta pode gerenciar
  o funil de várias empresas/CNPJs separadamente).
- Busca textual nos cards por cidade, UF ou nome do órgão.
- Filtro por data do pregão.
- Toggle "mostrar apenas cards com lembrete".
- Botão **Lembretes** (🔔) — notificações programadas por licitação.
- **Nova etapa** / **Gerenciar etapas** — as colunas do kanban (etapas do
  funil) são customizáveis pelo usuário, não fixas.

O dashboard `/crm-do-licitante/` resume isso em números por etapa-padrão:
**Participando, Habilitação, Ganhou, A Receber, Finalizado**, além de um
contador de empresas cadastradas. Ou seja, o produto trata cada licitação
como um "negócio" passando por um funil de CRM, igual a um funil de vendas.

## 3. Gestor de documentos

`/gestor-de-documentos/` — proposta central: "Adicione seus documentos e
fique atento à data de expiração." Fica bloqueado sem uma empresa vinculada
("Você não possui acesso a nenhuma empresa"). O conceito é simples e valioso:
um repositório de certidões/atestados com data de validade, que dispara
alerta antes de vencer — a causa mais comum de desclassificação em pregão é
certidão vencida.

## 4. Funções com IA

Submenu com três ferramentas de IA independentes, nenhuma delas exige
cadastro de empresa:

### 4.1 Leitor de Edital IA (`/leitor-de-editais-com-ia/`)
Upload de PDF do edital → resumo automático gerado por IA. Mantém histórico
("Meus editais lidos") para reabrir o resumo sem reenviar o arquivo.

### 4.2 Docs Jurídicos IA (`/documentos-juridicos/`)
Gerador de modelos de peças jurídicas do processo licitatório, com abas para
cada tipo de documento:

- **Impugnação** — campos: Órgão/Entidade, Modalidade, Nº do Edital, Objeto,
  Impugnante, cláusula/trecho literal impugnado (colado exatamente do
  edital), motivo, impacto prático, dispositivos legais, cidade, data.
- **Pedido de Esclarecimento**
- **Intenção de Recurso**
- **Recurso**
- **Contrarrazões**

Aviso na própria tela: *"leia atentamente antes de enviar, o Licitante Prime
não se responsabiliza pelos possíveis erros de IA."* — ou seja, o produto
mesmo trata a saída da IA como rascunho que precisa de revisão humana antes
de protocolar, nunca como envio automático.

### 4.3 Cotação Online IA / Precificação Inteligente (`/precificacao-inteligente/`)
Testado ao vivo. Funciona assim:

1. Usuário informa o **ID do pregão/licitação** (para puxar os itens
   automaticamente) **ou** cola itens manualmente, um por linha.
2. Ao pesquisar, o sistema cria uma tarefa assíncrona via **API da
   DataForSEO** (mensagem visível: *"Pesquisa criada. Aguardando a
   DataForSEO processar as tarefas..."*) — ou seja, ele faz uma busca de
   preços de varejo em tempo real (equivalente a um Google Shopping),
   não usa apenas base histórica de compras públicas.
3. Resultado (testado com "papel sulfite A4 75g caixa com 10 resmas"):
   tabela com Oferta, Loja, Preço, Frete, Total, % de Compatibilidade e Link
   para a oferta original, ordenável, com aviso "Resultado de teste.
   Conferir compatibilidade antes de usar."
4. Botão **"Exportar mapa de preços (Excel)"** e histórico em "Minhas
   cotações".

Isso é diferente da "Pesquisa de Preço (Beta)" abaixo — uma usa **preço de
varejo atual**, a outra usa **preço homologado histórico em compras
públicas**. Bom par de fontes para cruzar na hora de definir o preço de
lance.

## 5. Pesquisa de Preço (Beta)

`/pesquisa-de-preco/` — testado ao vivo com o item CATMAT "264919 —
CERTIFICADO, TIPO:HABILITAÇÃO, MATERIAL:PAPEL A4...". Entradas: tipo
(Produto/Serviço), nome do item (autocomplete que bate direto no catálogo
**CATMAT/CATSER**), UF, município (opcional) e período (30/90/180 dias, 1
ano, 2 anos ou personalizado).

Saída (rica, vale replicar):

- **Score de Oportunidade** (Alta/Média/Baixa) com leitura em texto: "5
  fornecedores — mercado pouco disputado".
- **Faixa de lance recomendada** — calculada "com base no percentil 25 e
  mediana dos preços homologados, com margem de segurança de 5–8%". Isso é
  literalmente uma sugestão de preço de lance gerada automaticamente.
- Preço médio, mediana, menor preço, maior preço, nº de transações, nº de
  fornecedores.
- Gráfico de distribuição de preços e gráfico de evolução mensal do preço
  médio.
- Tabela de **Top Fornecedores** (nome, CNPJ, quantidade de compras, marca
  mais vendida, menor preço já praticado) — útil para benchmarking de
  concorrência.
- Tabela de **Principais Órgãos Compradores** daquele item.

Isso claramente é construído em cima de dados públicos de compras
homologadas (Painel de Preços / dados abertos do governo), processados e
resumidos.

## 6. Monitoramento de Chat

`/monitoramento-de-chat/` — **não é uma página web, é um aplicativo
desktop separado** (Windows), vendido como add-on ("exclusivo para quem tem
o Plano Prime ou assinatura própria"). O que ele faz, segundo a própria
documentação do produto:

- Roda em segundo plano no computador do usuário.
- Conecta-se ao chat dos pregões eletrônicos em tempo real em **Comprasnet,
  BLL, BNC, Portal de Compras Públicas (PCP) e Licitanet** — sem precisar
  manter a aba do pregão aberta.
- Monitora as mensagens do pregoeiro por **palavra-chave configurada pelo
  usuário** e dispara alerta sonoro + notificação no **Telegram** quando
  detecta uma correspondência.
- Requisitos mínimos: Windows 10/11 64 bits, i3 ou equivalente, 4 GB RAM
  (8 GB recomendado), conexão estável. Recomenda no máximo 10 pregões
  monitorados simultaneamente (2–3 se a máquina for fraca).
- Aviso explícito: "Recomendamos que o uso do sistema seja sempre
  complementar ao acompanhamento ativo do pregão pelo licitante" — de novo,
  o produto se posiciona como **assistente de atenção**, não substituto do
  humano na hora de reagir/dar lance.

## 7. Cadastro Comprasnet — a peça que mais responde à sua pergunta original

`/cadastro-automatico-comprasgov/` documenta uma **extensão de Chrome**
("Licitante Prime — Cadastro ComprasNet") licenciada à parte, cujo objetivo
declarado é **automatizar o preenchimento de propostas no portal de compras
do governo**. Fluxo descrito, literalmente:

1. Exporta do Licitante Prime uma planilha com os itens da licitação, valores,
   marcas e modelos que o usuário já definiu (ex.: usando a Pesquisa de
   Preço/Precificação Inteligente acima para chegar nesses valores).
2. Ativa a extensão com uma chave de licença.
3. Faz upload dessa planilha no painel da extensão.
4. Confere um **preview** dos dados (valores, marcas, descrições) antes de
   rodar.
5. Inicia o cadastro automático. A partir daí a extensão, dentro do
   Comprasnet já autenticado pelo usuário:
   - localiza cada item do pregão;
   - preenche o valor unitário (com a máscara correta);
   - preenche marca e modelo;
   - clica em "Salvar" automaticamente, item a item;
   - **pula** itens que exigem declarações adicionais (deixando para o
     usuário completar manualmente depois);
   - roda a um **ritmo de ~5 segundos entre itens**, descrito como
     "humano", explicitamente para **evitar bloqueios de segurança** da
     plataforma;
   - mostra um **log em tempo real** (sucessos, erros, itens pulados).

Isto é o precedente mais direto, no próprio mercado, do que você perguntou
lá no início: dá para automatizar a *digitação item a item* de uma proposta
dentro do Comprasnet. Só que repare no desenho: (a) é uma extensão rodando
no navegador do próprio usuário, autenticado com a sessão/certificado dele —
não é um robô de servidor com a senha da empresa guardada em algum banco;
(b) ela só faz o preenchimento de campos, não clica em "enviar proposta
final" nem participa da fase de lance; (c) o ritmo de 5s/item propositalmente
imitando comportamento humano é, na prática, uma técnica para não ser
detectado como bot pela própria plataforma do governo — vale essa reflexão
de risco/compliance se você for reproduzir esse padrão: o Comprasnet pode
mudar seus mecanismos antibot a qualquer momento e travar ou até sinalizar
contas que automatizam preenchimento; e (d) itens com declaração adicional
continuam manuais de propósito.

## 8. CRM – Licitante (módulo de agência/consultoria)

Além do Kanban (seção 2), o submenu "CRM – Licitante" tem:

### 8.1 Cadastrar Empresa Parceira (`/cadastrar-empresa/`)
Mesmo schema do cadastro de empresa "dono da conta" (CNPJ com botão "Buscar
CNPJ" que deve consultar a Receita Federal automaticamente, razão
social/fantasia, endereço, contato, responsável legal, dados bancários,
logo), **mais um bloco de Comissão**: tipo Valor Fixo, Porcentagem, ou Valor
Fixo + Porcentagem. Isso revela o modelo de negócio: o Licitante Prime
também atende **despachantes/consultores de licitação** que participam em
nome de várias empresas-clientes e cobram comissão por processo — vale
considerar esse público como um segmento separado se for replicar o
produto.

### 8.2 CRM do Licitante (dashboard) — já coberto na seção 2.

## 9. Sua empresa (cadastro central + alertas)

`/sua-empresa/` — já documentado no arquivo anterior (schema completo de
CNPJ, endereço, contato, responsável legal, dados bancários, logo). Na mesma
tela, à parte, existe o bloco **"Boletim diário no seu email" / "Meus
alertas de licitação"**: até 3 alertas configuráveis, cada um com seus
próprios estados, palavras-chave e e-mail de destino, para receber um
boletim diário por e-mail com as licitações que combinam com o alerta — é a
automação de monitoramento mais simples do produto (equivalente a uma busca
salva + cron diário + envio de e-mail).

## 10. O que ficou de fora

"Meu Perfil" (dados de login/assinatura) não foi mapeado — é tela de conta
padrão (trocar senha, ver plano), não é central para o objetivo de
automação. Se precisar dela também, é rápido de revisitar.

---

## Síntese: como isso responde "automatizar tudo para facilitar a vida de quem licita"

Juntando este mapa com o funcionamento observado, dá para desenhar o ciclo
de vida completo de uma licitação e marcar, com base no que o próprio
mercado já valida, onde a automação total é segura e onde o produto de
referência (mesmo o mais agressivo, a extensão do Comprasnet) escolhe
manter humano no controle:

1. **Descoberta** (buscar por palavra-chave, radar por proximidade, boletim
   diário por e-mail) — 100% automatizável, é dado público.
2. **Triagem/leitura** (resumo do edital por IA, checagem de aptidão contra
   documentos cadastrados e suas datas de validade) — 100% automatizável.
3. **Formação de preço** (cruzar preço de varejo atual + histórico de preços
   homologados + concorrência por fornecedor) — 100% automatizável, é
   cálculo sobre dado público/de mercado.
4. **Geração de documentos** (proposta, declarações, peças jurídicas de
   impugnação/recurso) — automatizável como **rascunho**; o próprio produto
   avisa para revisar antes de protocolar, porque é texto gerado por IA.
5. **Preenchimento item a item no portal** — automatizável tecnicamente (a
   extensão de Comprasnet prova isso), mas é a fronteira onde entram os
   riscos de ToS/antibot da plataforma-alvo e o risco de erro silencioso em
   massa; se for automatizar essa etapa, vale manter o preview/confirmação
   antes de rodar (como o próprio produto faz) e nunca guardar
   certificado/senha fora do navegador autenticado do usuário.
6. **Acompanhamento do chat/lance em tempo real** — o produto usa alerta
   (som + Telegram), não decide nem reage sozinho; a decisão de dar lance
   continua do humano.
7. **Envio final da proposta/confirmação do lance** — em nenhum lugar do
   produto isso é automatizado. É o único ponto que, juridicamente, vincula
   a empresa — e é onde eu também recomendaria parar a automação no seu
   sistema.
8. **Pós-resultado** (kanban com etapas Ganhou/A Receber/Finalizado,
   gestão de contrato) — automatizável como *tracking*, não como ação.

Se quiser, o próximo passo natural é eu transformar essa síntese em uma
especificação de arquitetura (módulos, integrações — PNCP/dados abertos,
CATMAT, alguma API de preço de varejo, extensão de navegador para
preenchimento assistido — e onde ficam os pontos de confirmação humana) para
você levar direto para quem for construir o sistema.
