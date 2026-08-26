# syntax=docker/dockerfile:1
#
# Servido por Daphne (ASGI) — ver config/asgi.py e docs/ARQUITETURA.md.
# Migração e criação de superusuário ficam fora da imagem de propósito: são
# passos de deploy (Job/initContainer no Kubernetes), não algo que roda
# escondido no boot do container.

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --uid 1000 licita
USER licita

EXPOSE 8000
CMD ["daphne", "--bind", "0.0.0.0", "--port", "8000", "config.asgi:application"]
