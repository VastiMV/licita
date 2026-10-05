# feat/proposta — a proposta comercial

Ciclo de Licitação › Propostas: a etapa depois do Cotador. Mora em
`apps/propostas` (backend) e `pages/ciclo/propostas` (frontend).

- A proposta **escolhe um CNPJ** entre as empresas cadastradas
  ([`feat/cadastro-empresa`](feat-cadastro-empresa.md)). Com um CNPJ só, já
  nasce com ele.
- O preço vem do Cotador — a proposta é a formatação e o envio, não outra
  conta.

## Tarefas

- [x] **1. Gerar proposta no Cotador** — `POST /api/propostas/`, idempotente;
  a etapa Proposta é calculada (sai do Cotador, entra na coluna Proposta).
- [x] **2. Ciclo › Propostas** — a lista, com empresa e situação do Word.
- [x] **3. O Word da proposta** — modelo do cliente (docxtpl) ou o padrão
  timbrado (`apps/propostas/assets/gerar_modelo.py`, a partir de
  `docs/MODELO DE DOCUMENTO PROPOSTA.docx`); baixar e enviar o modelo na tela.
- [x] **4. Dados da proposta no cadastro da empresa** — representante (CPF,
  RG, qualificação) e dados bancários.
- [x] **5. A pasta da proposta** — documentos de habilitação da empresa
  (conferidos, renovados em Cadastros › Empresas), arquivos da licitação
  (upload/baixar/remover) e o `.zip` com tudo.
- [ ] **6. Comprovante de envio** — registrar que a proposta subiu na
  plataforma (data, quem), o que leva a licitação para Disputa.
