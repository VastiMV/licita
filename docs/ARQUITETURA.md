# Arquitetura

Stack construída sobre um cluster Kubernetes. Domínio de negócio em
[`DOMINIO.md`](DOMINIO.md).

## Visão geral

```
                         ┌───────────────┐
        internet ───────►│   Ingress     │
                         └──────┬────────┘
                    ┌───────────┴────────────┐
                    ▼                        ▼
           ┌─────────────────┐      ┌──────────────────┐
           │  frontend (svc) │      │  backend (svc)    │
           │  Angular (nginx)│      │  Django + DRF      │
           └─────────────────┘      └────────┬──────────┘
                                              │
                          ┌───────────────────┼────────────────────┐
                          ▼                   ▼                    ▼
                 ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
                 │ postgres (sts) │  │ rabbitmq (svc)   │  │ celery-worker   │
                 │ PVC            │  │                  │  │ celery-beat     │
                 └────────────────┘  └────────┬─────────┘  └────────┬────────┘
                                               └─────────────────────┘
                                          (worker/beat consomem do broker)
```

Namespace único por enquanto: `licita`.

## Framework

- **Backend:** Django (última versão estável) como API via Django REST
  Framework. Sem views server-side renderizadas — só JSON.
- **Frontend:** Angular (última versão estável), consumidor web da API.
  Servido como estático (build de produção) atrás de nginx no próprio pod.
- **Mobile (futuro):** Flutter, ou outro framework nativo/híbrido, consumindo
  a mesma API DRF. Não implica mudança no backend — é só mais um client.

### Backend — organização em apps Django

| App | Responsabilidade |
|---|---|
| `accounts` | usuários, autenticação (JWT), perfil |
| `catalogo` | model `Pdm`, sincronização do catálogo de materiais |
| `licitacoes` | model `Licitacao`, busca de oportunidades (live, cruza PNCP + catálogo) |
| `filtros` | model `Filtro` (dono = usuário autenticado) |
| `alertas` | model `Alerta`, geração e disparo de notificação |
| `integracoes` | clients HTTP para PNCP e compras.gov.br, isolados do resto (mockáveis nos testes) |
| `core` | settings, healthcheck, exceptions/handlers comuns da API |

### Frontend — organização Angular

- Standalone components (padrão atual do Angular), lazy-loaded por feature:
  `oportunidades/`, `filtros/`, `alertas/`, `auth/`.
  Sinaliza-se aqui a intenção; a estrutura definitiva de módulos é detalhada
  quando o harness de código for gerado.
- Um `ApiService`/`HttpInterceptor` central cuida do token JWT e do refresh.
- Consome só a API DRF — nenhuma lógica de negócio (matching de filtro,
  parsing de catálogo) duplicada no frontend.

## Autenticação

Angular é client puro da API DRF — não há sessão server-side compartilhada, o
que combina com o requisito de pods efêmeros/escaláveis. Mecanismo:
`djangorestframework-simplejwt` (access + refresh token).

### Fluxo

1. `POST /api/auth/login/` — recebe `email`/senha, devolve `access` (curta
   duração, ~5–15 min) no corpo da resposta e seta o `refresh` (~7 dias) como
   cookie `httpOnly`, `Secure`, `SameSite=Lax`.
2. Angular guarda o `access` **em memória** (campo privado do `AuthService`),
   nunca em `localStorage`/`sessionStorage` — reduz o que um XSS consegue
   roubar de forma persistente.
3. `HttpInterceptor` injeta `Authorization: Bearer <access>` em toda chamada
   à API.
4. Request que volta `401` dispara `POST /api/auth/refresh/` (o cookie
   `httpOnly` vai junto automaticamente, sem o JS tocar nele); o interceptor
   trava chamadas concorrentes de refresh para não disparar várias em
   paralelo, aplica o `access` novo e repete o request original.
5. `POST /api/auth/logout/` invalida o `refresh` (blacklist do
   `simplejwt`) e o Angular descarta o `access` da memória.
6. Rotas protegidas usam `canActivate` (functional guard) checando se há
   `access` válido em memória; sem ele, redireciona para `/login`.

### Implicações de infraestrutura

- Cookie `httpOnly` exige `withCredentials: true` no Angular e
  `CORS_ALLOW_CREDENTIALS = True` + `CORS_ALLOWED_ORIGINS` explícito no
  Django (nunca `*` quando `credentials` está ligado).
- `/api/auth/refresh/` fica sujeito a CSRF (é o único endpoint de auth que
  depende de cookie); os demais usam só o header `Authorization` e não
  precisam de CSRF token.
- `Filtro` (ver [`DOMINIO.md`](DOMINIO.md)) ganha `owner = FK User`; todo
  `ViewSet` de `filtros`/`alertas` usa `permission_classes = [IsAuthenticated]`
  e filtra o queryset por `request.user`.
- Sessão de admin do Django continua disponível em `/admin/` (cookie de
  sessão padrão), só para operação interna — não é o mecanismo usado pelos
  clients.

## Pods

Um pod por responsabilidade, todos **stateless e efêmeros** (nada em disco
local que não seja regenerável), para escala horizontal sem coordenação:

| Deployment | Réplicas iniciais | Escala horizontal |
|---|---|---|
| `frontend` | 1 | sim — estático, sem estado |
| `backend` | 1 | sim — sem sessão em memória; auth é JWT |
| `celery-worker` | 1 | sim — várias réplicas concorrem na mesma fila |
| `celery-beat` | 1 | **não** — agendador é singleton por definição; nunca escalar além de 1 réplica |

`postgres` e `rabbitmq` não são `Deployment`: `postgres` é `StatefulSet` (ver
abaixo); `rabbitmq` roda como `StatefulSet` de 1 réplica nesta fase (fila
única, sem cluster) — reavaliar cluster de 3 nós só se o volume justificar.

### Assíncrono — Celery + RabbitMQ

Tudo que depende de rede externa ou é demorado sai do request/response e vira
task Celery, com RabbitMQ como broker:

| Task | Gatilho | Frequência |
|---|---|---|
| `sincronizar_catalogo_pdm` | Celery Beat | diária (ou sob demanda via endpoint admin) |
| `verificar_filtros_ativos` | Celery Beat | a definir (ex.: a cada 15–30 min) — varre `Filtro.objects.filter(ativo=True)`, consulta PNCP/compras.gov.br, cria `Alerta` |
| `enviar_email_alerta` | disparada por `verificar_filtros_ativos` | por alerta criado |
| chamadas à API do PNCP/compras.gov.br feitas por busca interativa do usuário | request síncrono da `licitacoes` view | -- ficam síncronas mesmo, são a resposta da busca; só o que não bloqueia a resposta ao usuário vira task |

Agendamento via `django-celery-beat` (schedule editável no banco/admin, não
hardcoded), substituindo o `APScheduler` embutido do protótipo — que não
sobrevive a múltiplas réplicas do pod da API.

## Banco de dados

- **PostgreSQL**, um banco por enquanto, no mesmo namespace do resto.
- Roda como **`StatefulSet`** (identidade estável de pod + volume, ao
  contrário de `Deployment`), 1 réplica nesta fase — réplica de leitura fica
  para quando houver necessidade real.
- **PVC escrito manualmente** (não dinâmico via `StorageClass` default),
  para controle explícito de tamanho, política de retenção
  (`persistentVolumeReclaimPolicy: Retain`) e localização do volume.
- **`StorageClass` dedicada**, para que o volume dos dados seja fácil de
  localizar e intervir manualmente (backup, migração) — parâmetros exatos
  (provisioner, zona) dependem de qual cluster/cloud hospeda o Kubernetes;
  a definir quando essa informação existir.
- Credenciais via `Secret` (`POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DB`), nunca em `ConfigMap`.

## Configuração e segredos

| Recurso | Conteúdo |
|---|---|
| `ConfigMap` `backend-config` | `DJANGO_SETTINGS_MODULE`, URLs internas de serviço, feature flags |
| `Secret` `backend-secrets` | `SECRET_KEY`, credenciais do Postgres, credenciais RabbitMQ, credenciais do provedor de e-mail |
| `Secret` `postgres-secrets` | usuário/senha do banco |

## Estratégia de testes

**Nenhum código de funcionalidade entra sem teste antes dele.** Isso vale
para todo item de "Próximos passos" abaixo: os testes que especificam o
comportamento são escritos e revisados antes de escrever a implementação —
não depois, "para cobrir". Um PR que só adiciona teste depois do código é
retrabalho, não é o processo.

Ferramental é o padrão nativo de cada framework — sem introduzir runner
alternativo por preferência pessoal:

### Por camada

| Camada | Ferramenta | Escopo mínimo |
|---|---|---|
| Backend (models, serializers, regras) | `django.test.TestCase` (test runner padrão do Django, via `manage.py test`) | toda regra de `docs/DOMINIO.md` (matching de filtro, fallback catálogo↔PNCP, geração de `Alerta`) tem teste antes de existir código |
| Backend (endpoints DRF) | `rest_framework.test.APITestCase` (extensão do `TestCase` padrão, já pensada para DRF) | autenticação (login, refresh, 401 sem token, logout invalida refresh), permissão (dono só vê seu próprio `Filtro`), contrato de cada endpoint |
| Clients de integração (`integracoes/`) | `TestCase` + `unittest.mock`/`requests-mock` | **sem rede real nos testes** — mesma disciplina do protótipo (`tests/conftest.py` já desligava a busca do PNCP por padrão); contrato mockado a partir do `api-spec.json` e dos comportamentos documentados em `DOMINIO.md` (paginação 10–500, `/api/search/` etc.) |
| Tasks Celery | `TestCase` com `CELERY_TASK_ALWAYS_EAGER=True` | `sincronizar_catalogo_pdm`, `verificar_filtros_ativos`, `enviar_email_alerta` rodam síncronas no teste, sem broker real |
| Frontend (Angular) | Karma/Jasmine gerado pelo próprio `ng generate` (`*.spec.ts` ao lado de cada arquivo, `ng test`) | `AuthService`/interceptor (refresh automático, fila de requests em 401, logout limpa estado), guards de rota, componentes de `oportunidades`/`filtros`/`alertas` |
| Frontend (fluxo ponta a ponta) | a definir (Playwright é o candidato natural — não tem padrão nativo do Angular CLI para e2e desde a remoção do Protractor) | login → criar filtro → alerta aparece — pelo menos o caminho feliz, antes de considerar uma feature "pronta" |

### CI

Pipeline bloqueia merge se os testes não passarem — a definir plataforma
(GitHub Actions é o candidato natural dado o remoto já ser GitHub) quando o
harness de código for gerado.

## O que falta definir (bloqueado em decisão externa, não técnica)

- Provisão exata da `StorageClass` (qual cluster/cloud hospeda — impacta
  `provisioner` e parâmetros de zona).
- Provedor de e-mail transacional para `enviar_email_alerta`.
- Domínio(s) e configuração de TLS no `Ingress`.
- Estratégia de backup do Postgres (frequência, destino).

## CI e imagens

Build manual, não em cada push — `.github/workflows/build-image.yml`
(`workflow_dispatch` com um dropdown `frontend`/`backend`/`both`, acionado em
Actions → Run workflow). Builda a imagem (`frontend/Dockerfile`,
`backend/Dockerfile`) e publica em `ghcr.io/vastimv/licita-frontend:latest` /
`licita-backend:latest`. Sem tag por commit ainda — só `:latest`, trocar
exige `kubectl rollout restart` (ver [`k8s/README.md`](../k8s/README.md)).

O Dockerfile do frontend roda a suíte de testes como parte do build: a
imagem só existe se os testes passaram.

## Kubernetes — o que já existe

Namespace `inside-solutions-licita` e o Deployment/Service do frontend, via
`kubectl apply -f k8s/` (sem GitOps ainda). Ver
[`k8s/README.md`](../k8s/README.md) para o passo a passo, inclusive como
criar o `Secret` de pull do GHCR — nunca commitado, sempre criado
imperativamente no cluster.

## Próximos passos possíveis

1. Manifests que ainda faltam: `RabbitMQ`, `celery-worker`/`celery-beat`.
   Postgres, backend e Ingress já existem (ver [`k8s/README.md`](../k8s/README.md)).
2. Portar os clients de integração (`PncpClient`, `ComprasGovClient`) do
   protótipo para `integracoes/`, com os aprendizados de
   [`DOMINIO.md`](DOMINIO.md) preservados (paginação 10–500, busca via
   `/api/search/`, fallback pro catálogo).
