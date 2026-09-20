# feat/documentos-processo — a pasta da licitação

Proposta: https://claude.ai/code/artifact/9b1e0565-757d-4fc0-b49d-3effb6863f7f
(o módulo Documentos inteiro; aqui está a segunda tela dele)

Ninguém cria pasta. **Salvou a oportunidade, a pasta existe** — e vai se
enchendo sozinha conforme o processo anda: oportunidade → cotação → proposta
→ disputa → empenho. A pessoa só sobe o que é mesmo de fora.

Não reusa o model de documento da empresa, e não deveria: aqui não há lista
fixa nem validade. O mesmo processo tem três catálogos de fornecedor e nenhum
atestado. O que é igual é o armazenamento.

Depende de [`feat/armazenamento`](feat-armazenamento.md) e de
[`feat/cadastro-empresa`](feat-cadastro-empresa.md) (o kit de habilitação sai
dos documentos da empresa).

## Tarefas

- [ ] **1. `PastaProcesso` nasce com a oportunidade salva**
  Criada no mesmo fluxo que grava `OportunidadeSalva`, com o evento
  correspondente no histórico que já existe. Sem tela de "criar pasta" — ela
  não existe como gesto.
  *Teste antes:* salvar oportunidade cria a pasta; salvar de novo não duplica;
  remover a oportunidade (remoção lógica) não some com a pasta.

- [ ] **2. `ArquivoProcesso`**
  Fase (oportunidade, cotação, proposta, disputa, pós-ganho), origem
  (`subido` / `buscado` / `gerado` — é a origem que decide o que o sistema
  automatiza), chave no bucket, nome, tamanho, hash, quem e quando. Nome de
  arquivo é do sistema, padrão `tipo-uasg-ano-versao`: metade da confusão de
  pasta é nome inventado na hora.
  *Teste antes:* as três origens; nome gerado é estável e não colide.

- [ ] **3. Buscar o edital do PNCP ao salvar**
  Task Celery: baixa edital e anexos pelo `/arquivos` do PNCP (já usado no
  card da oportunidade) e grava na fase "oportunidade", com evento "edital
  arquivado". Falha de rede não pode derrubar o salvar — é assíncrono por
  isso.
  *Teste antes:* PNCP mockado (sem rede, como em `integracoes`); falha marca a
  pasta como "edital não baixado" e permite tentar de novo.

- [ ] **4. O Cotador para de exportar solto**
  A planilha gerada em `apps/cotador/planilha.py` passa a cair na pasta do
  processo, versionada a cada exportação, além de continuar baixando na hora.
  *Teste antes:* exportar duas vezes gera duas versões, não dois arquivos
  soltos.

- [ ] **5. Upload manual por fase**
  Proposta do fornecedor, catálogo, ficha técnica, comprovante de envio,
  diligência, nota de empenho, contrato, nota fiscal. Mesma dropzone do
  cadastro de empresa.
  *Teste antes:* o arquivo cai na fase escolhida e aparece no histórico.

- [ ] **6. Tela da pasta**
  Seções por fase, com os arquivos marcados pela origem; "Baixar tudo";
  contagem por fase; o que ainda está vazio aparece dito, não escondido.
  *Teste antes:* seção vazia mostra o texto do que vai entrar ali.

- [ ] **7. Kit de habilitação**
  Junta os documentos **válidos na data**, na ordem que o edital pede, avisa o
  que falta e **congela a versão enviada** — é isso que se prova depois. Trava
  enquanto houver certidão vencida.
  *Teste antes:* kit com documento vencido é recusado com a lista do que
  falta; o que foi enviado fica referenciado à versão exata, mesmo depois de
  renovada.

- [ ] **8. Declarações geradas**
  ME/EPP, menor, idoneidade, elaboração independente: texto padrão + dados da
  empresa (do `feat/cadastro-empresa`) + dados do pregão. Acaba o
  "declaração com o número do pregão anterior".
  *Teste antes:* a declaração sai com o número do pregão atual e com o porte
  da empresa escolhida.
