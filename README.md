# Licita

Plataforma para acompanhar e ser avisado sobre oportunidades de licitação
pública (Lei 14.133), integrando com PNCP e compras.gov.br. Cada usuário
cadastra filtros (palavra-chave, UF, modalidade, UASG) e recebe alertas
quando surge uma nova licitação compatível.

O produto de origem foi um protótipo (FastAPI + SQLite, ver branches
`claude/siga-pregao-tool-6o8zbs` e `claude/tenta-de-novo-xu2sxb`) que validou
o domínio e as integrações externas. Este repositório reinicia a stack sobre
uma arquitetura de produção: Django/DRF + Angular + Kubernetes.

- **Especificação completa:** [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- **Domínio de negócio:** [`docs/DOMINIO.md`](docs/DOMINIO.md)

## Stack

| Camada | Tecnologia |
|---|---|
| Backend / API | Django + Django REST Framework |
| Frontend web | Angular |
| Mobile (futuro) | Flutter (ou outro, a definir) |
| Assíncrono | Celery + RabbitMQ |
| Banco de dados | PostgreSQL (StatefulSet no Kubernetes) |
| Orquestração | Kubernetes |

Ver [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) para pods, filas, modelo de
dados e manifests de infraestrutura.

## Status

- **`frontend/`** — Angular: design system, autenticação e as quatro telas
  (oportunidades, filtros, alertas, login). Ver [`frontend/README.md`](frontend/README.md).
- **`backend/`** — Django/DRF: projeto criado, autenticação por e-mail
  (`apps/accounts`) como primeiro model, Daphne/Channels e Celery já
  conectados na configuração. Os demais apps de domínio (catálogo,
  licitações, filtros, alertas, integrações) ainda não existem. Ver
  [`backend/README.md`](backend/README.md).
- Manifests Kubernetes ainda não existem.
