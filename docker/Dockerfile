# Multi-stage production image for Maximus web
# Build: docker build -f docker/Dockerfile -t maximus-web .
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/provider-gateway/package.json packages/provider-gateway/
COPY packages/rate-limit/package.json packages/rate-limit/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @maximus/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
  && useradd -m -u 10001 maximus \
  && apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=maximus:maximus /app /app
USER maximus
EXPOSE 3000
# TanStack Start / Vite build emits apps/web/dist/server/server.js
WORKDIR /app
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
COPY --chown=maximus:maximus docker/entrypoint.sh /app/docker/entrypoint.sh
# entrypoint not executable until host chmod; run via sh
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
