# Deployment (M17 / ADR-025 §7)

How to build and deploy the web app. The app is **Supabase-backed** (DB, auth, storage);
deployment ships the Next.js web container against a provisioned Supabase project.
Mobile ships via Expo/EAS (out of scope here).

## Prerequisites
- Docker + Docker Compose, a provisioned Supabase project (`RUNBOOK_SUPABASE_SETUP.md`),
  and a populated `.env` (see `ENVIRONMENT.md`).
- Node 24.11.1 / pnpm 9.15.9 for local (non-Docker) builds (`.nvmrc`, `packageManager`).

## Build
Next.js **standalone** output (`next.config.ts` `output: "standalone"` + `outputFileTracingRoot`)
produces a self-contained server. The multi-stage `Dockerfile` builds it on Linux, so the
in-container `pnpm install` (postinstall → `prisma generate`) emits the **Linux** Prisma engine
that Next traces into the bundle.

```bash
scripts/build.sh                 # docker build -t school-portal-web:latest .
# or non-Docker:
SKIP_ENV_VALIDATION=true pnpm --filter web build
```

## Deploy
```bash
scripts/deploy.sh                # migrate deploy → docker compose -f docker-compose.prod.yml up -d --build
```
`scripts/deploy.sh`:
1. Requires `.env`.
2. Applies pending migrations: `prisma migrate deploy` (never generates — the safe prod path).
3. Builds + starts the prod container (`docker-compose.prod.yml` — web only; DB/auth/storage are Supabase).

**Migrations run before the new container serves traffic.** If a release includes a migration,
a code-only rollback is unsafe — pair it with `BACKUP.md §4/§7`.

## Compose
- `docker-compose.yml` — **local dev**: web + a throwaway Postgres. Auth/storage still need
  real Supabase env.
- `docker-compose.prod.yml` — **production**: web only; compose healthcheck probes `/api/ready`.

## Health & readiness (ADR-025 §4)
- `GET /api/health` — **liveness**: `{ status, version, uptime, environment, ... }`, dependency-free,
  always 200. The Dockerfile `HEALTHCHECK` uses it.
- `GET /api/ready` — **readiness**: DB + storage reachability; **503** when not ready. The prod
  compose healthcheck + any load balancer should gate traffic on this.

Set `APP_VERSION` at build/deploy (git SHA or tag) — it surfaces in `/api/health`.

## CI/CD (`.github/workflows/ci.yml`)
On push-to-main + all PRs: **`ci`** job (install → `pnpm audit --audit-level high` → lint →
typecheck → test → build → db:validate) then **`docker`** job (`needs: ci`) builds the web image
(validates the Dockerfile end-to-end). Any stage fails ⇒ pipeline fails. No deploy job is wired
(no live secrets in CI) — deployment is `scripts/deploy.sh` from a host with `.env`.

## Push notifications go-live (Phase 1)

Push delivery is wired end-to-end but ships **off by default on BOTH ends** — until both
switches below are set, the app looks done while delivering zero pushes:

1. **Server** — set `PUSH_NOTIFICATIONS_ENABLED="true"` in the deploy `.env` (see
   `.env.example`); optional `EXPO_ACCESS_TOKEN` if the Expo project enforces push security.
   Without it the Expo adapter is never wired and every notification is in-app only.
2. **Mobile build** — set the EAS project id in `apps/mobile/app.json` →
   `extra.eas.projectId` (from `eas init` / expo.dev project page). Without it the app
   skips push registration entirely, so no device ever gets a token. The mobile Settings
   screen shows a visible warning while registration is skipped.

Verify: log in on a device, Settings shows no push warning, then trigger any notifying
action (e.g. publish an announcement) and confirm the push arrives with the app closed.

## Rollback
`BACKUP.md §7` — re-point to the previous tagged image; pair with a forward corrective migration
or restore if the bad release changed the schema.
