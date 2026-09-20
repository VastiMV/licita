# Kubernetes

Manifests aplicados manualmente por enquanto (`kubectl apply -f`) — sem
GitOps/ArgoCD ainda. Ver [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md) pra
o desenho completo (isso aqui cobre só o que já existe: namespace + frontend).

## Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

## Secret de pull do GHCR

As imagens são privadas (publicadas por `.github/workflows/build-*.yml`).
**Nunca commitar esse Secret no repo** — ele é sempre criado direto no
cluster, imperativamente, a partir de um Personal Access Token do GitHub com
escopo `read:packages`:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --namespace inside-solutions-licita \
  --docker-server=ghcr.io \
  --docker-username=<seu usuário do GitHub> \
  --docker-password=<seu token com escopo read:packages> \
  --docker-email=<seu e-mail>
```

O push da imagem (feito pela Action) usa o `GITHUB_TOKEN` automático do
workflow — não precisa desse PAT. O PAT é só pra o **cluster puxar** a
imagem privada.

## Frontend

```bash
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml
```

Imagem em tag `:latest` — o Kubernetes **não** detecta sozinho quando uma
`:latest` nova é publicada. Depois de rodar o workflow "Build image" (Actions → Run workflow, escolha
`frontend`), force o rollout:

```bash
kubectl rollout restart deployment/frontend -n inside-solutions-licita
kubectl rollout status deployment/frontend -n inside-solutions-licita
```

## Postgres

```bash
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/service.yaml
kubectl apply -f k8s/postgres/statefulset.yaml
```

`postgres-secrets` (`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`) tem
que existir **antes** do primeiro boot do StatefulSet — é a imagem oficial
do Postgres, no primeiro boot com volume vazio, que cria o banco `licita` e
o usuário `licita` sozinha a partir dessas variáveis:

```bash
kubectl create secret generic postgres-secrets \
  --namespace inside-solutions-licita \
  --from-literal=POSTGRES_USER=licita \
  --from-literal=POSTGRES_PASSWORD=<gerar uma senha forte> \
  --from-literal=POSTGRES_DB=licita
```

## RabbitMQ

```bash
kubectl apply -f k8s/rabbitmq/service.yaml
kubectl apply -f k8s/rabbitmq/statefulset.yaml
```

`rabbitmq-secrets` tem que existir **antes** do primeiro boot — mesma lógica
do `postgres-secrets`, mas aqui uma secret só serve dois propósitos:
credenciais do próprio RabbitMQ (`RABBITMQ_DEFAULT_USER`/`RABBITMQ_DEFAULT_PASS`,
lidas pela imagem oficial) e a URL de conexão que backend/worker/beat usam
(`RABBITMQ_URL`, lida por `Environment` — ver `config/settings/environment.py`).
As duas coisas têm que bater:

```bash
kubectl create secret generic rabbitmq-secrets \
  --namespace inside-solutions-licita \
  --from-literal=RABBITMQ_DEFAULT_USER=licita \
  --from-literal=RABBITMQ_DEFAULT_PASS=<gerar uma senha forte> \
  --from-literal=RABBITMQ_URL="amqp://licita:<a mesma senha>@rabbitmq:5672//"
```

Sem PVC — fila é descartável (ver comentário em `k8s/rabbitmq/statefulset.yaml`).

## Backend

```bash
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml
```

Depende de `backend-secrets` (`DJANGO_SECRET_KEY`,
`ARMAZENAMENTO_CHAVE_CIFRA`), `postgres-secrets` e `rabbitmq-secrets` já
existirem:

```bash
kubectl create secret generic backend-secrets \
  --namespace inside-solutions-licita \
  --from-literal=DJANGO_SECRET_KEY=<gerar, ex.: python3 -c "import secrets; print(secrets.token_urlsafe(50))"> \
  --from-literal=ARMAZENAMENTO_CHAVE_CIFRA=<gerar, ex.: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
```

Para acrescentar a chave de cifra a um `backend-secrets` que já existe, sem
mexer no resto dele:

```bash
CHAVE=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
kubectl patch secret backend-secrets -n inside-solutions-licita \
  --type=merge -p "{\"stringData\":{\"ARMAZENAMENTO_CHAVE_CIFRA\":\"$CHAVE\"}}"
```

**`ARMAZENAMENTO_CHAVE_CIFRA` não é a configuração do armazenamento** — essa
fica no banco, em `ConfigArmazenamento`, uma linha por tenant, editada pela
tela (driver, bucket, endpoint, credencial). O que está aqui é só a chave que
cifra a coluna do segredo: guardá-la na mesma tabela que ela protege tornaria
a cifra decorativa diante de um dump do banco. Ver a seção "Armazenamento de
arquivos" em [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md).

Trocar esta chave torna ilegíveis as credenciais já gravadas — a tela passa a
pedi-las de novo. Não há passo de rotação automática.

Os três Deployments do backend (`backend`, `celery-beat`,
`sincronizador-catalogo-pdm`) carregam `backend-secrets` inteiro via
`envFrom`, então a chave chega nos três sem mudar manifesto nenhum.

Mesma lógica de `:latest` do frontend — depois de buildar
(`.github/workflows/build-image.yml`, escolha `backend`), force o rollout:

```bash
kubectl rollout restart deployment/backend -n inside-solutions-licita
kubectl rollout status deployment/backend -n inside-solutions-licita
```

O Deployment roda `manage.py migrate` num `initContainer` antes do
container principal subir — funciona com 1 réplica (nosso caso); mais que
isso precisa virar um `Job` separado, senão duas migrações correm em
paralelo. Essa migração inclui `CREATE EXTENSION pg_trgm` (busca do
catálogo, ver `apps/catalogo`) — o usuário `licita` do Postgres precisa de
privilégio para criar extensão, senão o `initContainer` falha nesse passo.

## Celery (worker + beat)

Mesma imagem do backend, nenhum build separado — só o `command` muda (ver
os manifests). `celery-beat` é singleton: **nunca** escalar
`replicas` além de 1.

```bash
kubectl apply -f k8s/backend/sincronizador-catalogo-pdm-deployment.yaml
kubectl apply -f k8s/backend/celery-beat-deployment.yaml
```

Dependem dos mesmos Secrets do backend, mais `rabbitmq-secrets`. Depois de
rebuildar a imagem `backend`, force o rollout dos três juntos:

```bash
kubectl rollout restart deployment/backend deployment/sincronizador-catalogo-pdm deployment/celery-beat -n inside-solutions-licita
```
