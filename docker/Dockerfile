# Multi-stage production image for Maximus web
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
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
RUN useradd -m -u 10001 maximus
COPY --from=build /app /app
USER maximus
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", ".output/server/index.mjs"]
