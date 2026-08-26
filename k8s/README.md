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

## Backend

Ainda não tem manifest — a imagem builda (`.github/workflows/build-image.yml`, escolha `backend`)
mas o Deployment fica pra quando o backend tiver endpoint de verdade rodando
(hoje só tem o model de usuário, subiria e ficaria sem fazer nada útil).
