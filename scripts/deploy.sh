#!/usr/bin/env bash
# Deployment (ADR-025 §7): apply pending DB migrations, then (re)start the
# production web container. Idempotent — safe to re-run. Requires a populated
# `.env` (DATABASE_URL points at the Supabase Postgres).
#
# Migrations run BEFORE the new container serves traffic. `migrate deploy` only
# applies already-committed migrations (never generates) — the safe prod path.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy .env.example and fill it in." >&2
  exit 1
fi

echo "==> Applying database migrations (prisma migrate deploy)"
# dotenv form loads the root .env (the proven runbook invocation).
pnpm --filter @repo/db exec dotenv -e ../../.env -- prisma migrate deploy

echo "==> Building and starting the production web container"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Deployed. Readiness: curl -f http://localhost:3000/api/ready"
