# syntax=docker/dockerfile:1
#
# Build roda em Linux de propósito: testar localmente no Windows bateu num
# crash de binário nativo do Rolldown/Vite específico da máquina (ver
# histórico do repo — commits "Troca npm por pnpm"/revert). A imagem
# elimina essa variável: o build e os testes sempre rodam no mesmo Linux
# que vai pra produção.

FROM node:22-slim AS build
WORKDIR /app

# Copia só os manifestos primeiro pra cachear a camada do npm ci — só reinstala
# quando package.json/lock mudam, não a cada alteração de código.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Testes fazem parte do build da imagem: uma imagem só existe se os testes
# passaram (ver docs/ARQUITETURA.md, "Estratégia de testes").
RUN npx ng test --watch=false
RUN npx ng build

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
