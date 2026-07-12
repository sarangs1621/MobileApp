# syntax=docker/dockerfile:1
# Production image for the web app (ADR-025 §7). Multi-stage: install → build →
# minimal standalone runner. The build runs entirely on Linux, so `pnpm install`
# (postinstall → `prisma generate`) produces the Linux Prisma query engine, which
# Next then traces into the standalone bundle. Node pinned to .nvmrc, pnpm to CI.

FROM node:24.11.1-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# OpenSSL is required by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Build the self-contained standalone server ----
FROM base AS builder
ENV SKIP_ENV_VALIDATION="true" \
    TURBO_TELEMETRY_DISABLED="1" \
    NEXT_TELEMETRY_DISABLED="1"
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# ---- Minimal runtime image ----
FROM base AS runner
ENV NODE_ENV="production" \
    PORT="3000" \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED="1"
# Run as non-root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Standalone server + its traced node_modules (monorepo layout preserved), then
# the static assets Next does not inline into the standalone output.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
# Liveness — see /api/health (ADR-025 §4). Node 24 ships a global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
