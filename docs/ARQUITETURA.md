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

Autenticação: DRF + `djangorestframework-simplejwt` (access/refresh token).
Sessão de admin do Django continua disponível em `/admin/` só para operação
interna, não para os clients.

### Frontend — organização Angular

- Standalone components (padrão atual do Angular), lazy-loaded por feature:
  `oportunidades/`, `filtros/`, `alertas/`, `auth/`.
  Sinaliza-se aqui a intenção; a estrutura definitiva de módulos é detalhada
  quando o harness de código for gerado.
- Um `ApiService`/`HttpInterceptor` central cuida do token JWT e do refresh.
- Consome só a API DRF — nenhuma lógica de negócio (matching de filtro,
  parsing de catálogo) duplicada no frontend.

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

## O que falta definir (bloqueado em decisão externa, não técnica)

- Provisão exata da `StorageClass` (qual cluster/cloud hospeda — impacta
  `provisioner` e parâmetros de zona).
- Provedor de e-mail transacional para `enviar_email_alerta`.
- Domínio(s) e configuração de TLS no `Ingress`.
- Estratégia de backup do Postgres (frequência, destino).

## Próximos passos possíveis

1. Gerar o esqueleto de repositório (`backend/`, `frontend/`, `k8s/`,
   `docker/`) — escopo separado, sob pedido.
2. Escrever os manifests Kubernetes (`Deployment`, `StatefulSet`, `Service`,
   `Ingress`, `ConfigMap`/`Secret`, `PVC`/`StorageClass`).
3. Portar os clients de integração (`PncpClient`, `ComprasGovClient`) do
   protótipo para `integracoes/`, com os aprendizados de
   [`DOMINIO.md`](DOMINIO.md) preservados (paginação 10–500, busca via
   `/api/search/`, fallback pro catálogo).
