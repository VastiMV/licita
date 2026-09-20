# feat/armazenamento — o bucket como plugin

Proposta: https://claude.ai/code/artifact/46ff524f-1317-4811-9a1c-23bf4c20ccdb

O produto não pode saber que existe S3. Ele sabe `salvar`, `abrir`,
`url_temporaria` e `remover`; quem faz isso é um **driver**, escolhido e
configurado pelo cliente na tela de configuração da empresa. Trocar
Cloudflare R2 por AWS S3 é mudar a seleção e preencher os campos do novo
driver — não é deploy.

**Decidido:** começa em **Cloudflare R2**. MinIO fica fora por ora (é um
driver de dez linhas em cima da mesma base S3-compatível, quando quiser).

## Tarefas

- [x] **1. Interface e registro de drivers**
  `apps/armazenamento/base.py` — protocolo `Armazenamento` com os quatro
  métodos, e `registro.py` com `registrar(chave, classe)` / `driver(chave)`.
  Cada driver declara os **campos de configuração** que precisa (nome, rótulo,
  se é segredo, se é obrigatório) — é isso que faz o formulário da tela se
  desenhar sozinho para o driver escolhido, sem o frontend conhecer R2.
  *Teste antes:* registrar um driver falso, listá-lo, recuperá-lo pela chave,
  erro claro em chave inexistente.

- [x] **2. Driver `local`**
  Grava em disco dentro de `MEDIA_ROOT`. É o driver do desenvolvimento e
  **dos testes** — nenhum teste do projeto pode tocar em bucket de verdade
  (mesma disciplina de `integracoes`, que nunca faz rede em teste).
  `url_temporaria` devolve URL servida pelo próprio backend, com token curto.
  *Teste antes:* round-trip (salva, abre, confere bytes), remove, caminho com
  `..` é recusado.

- [x] **3. Driver S3-compatível: `r2` e `s3`**
  Uma base só (`boto3`, protocolo S3) e duas chaves registradas, porque a
  diferença entre Cloudflare R2 e AWS S3 é `endpoint_url` e região. Os dois
  aparecem no seletor — é essa a troca de plugin.
  *Teste antes:* com `botocore.stub.Stubber` (sem rede): monta o client com o
  endpoint do R2, gera URL assinada com expiração, sobe com o content-type
  certo, propaga erro de credencial como erro de domínio (não `ClientError`
  cru).

- [x] **4. `ConfigArmazenamento` no banco, por tenant**
  Driver escolhido + os campos daquele driver (bucket, endpoint, região,
  chave, segredo, prefixo). **Segredo cifrado** (Fernet, chave vinda do
  ambiente) e *write-only*: a API devolve `segredo_definido: true` e a data,
  nunca o valor.
  *Teste antes:* salvar cifra, ler decifra, serializer nunca expõe o segredo,
  trocar de driver não vaza campo do driver anterior.

- [x] **5. Endpoints de configuração**
  `GET /api/armazenamento/drivers/` (o que está instalado + os campos de cada
  um), `GET/PUT /api/armazenamento/config/`, `POST /api/armazenamento/testar/`
  — que grava um objeto de um byte, lê de volta, apaga e responde ok/erro com
  a mensagem do provedor. Salvar sem testar continua possível; a tela é que
  insiste.
  *Teste antes:* contrato dos três, 401 sem token, teste de conexão
  devolvendo falha legível quando o driver levanta.

- [x] **6. Tela de configuração**
  `pages/configuracoes/armazenamento/` — seletor de driver e o formulário
  desenhado a partir dos campos que o driver declarou, com o botão "Testar
  conexão" ao lado de "Salvar". Enquanto não houver papéis no produto, a tela
  aparece só para `is_staff`.
  *Teste antes:* trocar o driver troca os campos; segredo já definido aparece
  mascarado e só é enviado se o usuário digitar outro.

- [x] **7. Documentação**
  Seção em `docs/ARQUITETURA.md`: por que a configuração é registro de banco e
  não `ConfigMap`/`Secret` (precisa ser por cliente e mudar sem redeploy),
  qual variável de ambiente guarda a chave de cifra, e como se escreve um
  driver novo.
