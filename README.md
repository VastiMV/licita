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

- **`frontend/`** — Angular: design system, autenticação e as telas de
  oportunidades (pesquisar + salvas), fornecedores, filtros, alertas e
  login. O Cotador é um modal aberto do card da busca ou da lista de salvas.
  Ver [`frontend/README.md`](frontend/README.md).
- **`backend/`** — Django/DRF: autenticação por e-mail (`apps/accounts`),
  integrações (`apps/integracoes`), catálogo de materiais (`apps/catalogo`),
  CAPAG (`apps/capag`), licitações (`apps/licitacoes` — busca ao vivo,
  oportunidades salvas e histórico), cadastro de fornecedores
  (`apps/fornecedores`) e formação de preço (`apps/cotador`, com exportação
  da proposta em .xlsx). `filtros` e `alertas` ainda não existem. Ver
  [`backend/README.md`](backend/README.md).
- Manifests Kubernetes ainda não existem.
