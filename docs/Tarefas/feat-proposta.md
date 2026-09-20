# feat/proposta — a proposta comercial

**Ainda sem desenho de produto.** O mockup do branch `feat/cadastro-empresa`
traz uma parte de proposta que foi deixada para um handoff separado, e o "o
que fazer" ainda não foi escrito — quando for, vira uma proposta como as
outras duas e este arquivo ganha as tarefas.

O que já está decidido e vale registrar agora, para não se perder:

- A proposta **escolhe um CNPJ** entre as empresas cadastradas
  ([`feat/cadastro-empresa`](feat-cadastro-empresa.md)). Com um CNPJ só, o
  seletor não aparece.
- O que ela gerar (proposta comercial assinada, declarações do edital,
  comprovante de envio) **cai na pasta do processo**
  ([`feat/documentos-processo`](feat-documentos-processo.md)), fase
  "proposta", com origem `gerado` ou `subido`.
- O preço vem do Cotador, que já existe — a proposta é a formatação e o envio,
  não outra conta.
