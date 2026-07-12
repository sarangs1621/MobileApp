# ADR-025 — Production Readiness, Security & Operations — M17

**Status:** Accepted — **M17 implemented (Steps 1–12)** · **Date:** 2026-07-12 · **Deciders:** Architecture, Product, Ops
**Related:** ADR-001 (auth — server-side `getUser()` revalidation, no role from JWT; M17 rate-limits the login path, changes no auth logic) ·
ADR-002 (business layer is the authorization gate; routers thin — M17's logger/error-mapping wrap this seam, never move logic into it) ·
ADR-003 (repositories own all Prisma — M17 adds **only** performance indexes proven additive by `migrate diff`, no query behaviour change) ·
ADR-004 (private buckets + server-minted signed URLs — M17 audits storage access and rate-limits upload mints, adds no storage code) ·
ADR-005 (notification delivery seam — the 5 fire-and-forget `console.error` notify-failure sites become structured `logger.error`; graceful degradation preserved) ·
ADR-007 (AuditLog — M17 **reads/exports** the audit trail for the Super-Admin ops console; writes nothing new) ·
ADR-008 (single-tenant, future SaaS — `schoolId` already on every row; observability logs it) ·
`docs/SECURITY_REVIEW_M1.md` (M1 shipped 5 security headers + deferred **CSP** and **app-level rate limiting** to "M2+" — M17 discharges both) ·
PERMISSIONS_MATRIX (M17 adds **one** permission — `system:manage`, **Super Admin only**).
**Precedes:** M17 (Production Readiness, Security & Operations) — this ADR fixes the philosophy and per-area posture; Steps 2–12 execute it.

---

> **Milestone framing.** M17 hardens the app for production deployment over frozen M1–M16. It adds **no business feature,
> no domain rule, no module redesign.** Everything is **additive infrastructure**: security headers/rate-limits, one
> centralized logger, monitoring endpoints, error boundaries, deployment/CI-CD/backup automation, and one **Super-Admin-only**
> `system:manage` permission for read-only ops tooling. The **only** schema change permitted is missing performance indexes,
> each proven additive by `prisma migrate diff`. The **only** permission added is `system:manage` (SA only). No feature flag.
> OUT OF SCOPE: every business engine's behaviour (auth/attendance/exam/fee/report-card/timetable/homework/analytics/
> notifications/announcements/documents/discipline/settings), PDF rendering, real SMS/push delivery, and any new domain data.

## Context

Most production-hardening seams already exist from earlier milestones; M17 is largely **fill the named gaps + verify the
rest**, not build-from-zero. An honest current-state inventory is the load-bearing part of this ADR — it scopes every
later step as *gap-to-fill* vs *verify-only* and gives each STOP a checklist.

### Current state — already hardened (verify-only, do not rebuild)

- **Security headers (5/6)** — `apps/web/next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`. **CSP is the one missing header** (M1 deferred it pending
  nonce wiring — `SECURITY_REVIEW_M1.md` §Deferred).
- **Auth is sound (ADR-001, reviewed M1)** — server-side `getUser()` revalidation on every request, no role/schoolId from
  JWT, mid-session revocation via per-request `status===ACTIVE` DB check, SecureStore on mobile, `@supabase/ssr` cookies on
  web, SameSite-Lax + JSON-POST CSRF posture. Supabase brute-force limits cover auth OTP/sign-in today.
- **Health + readiness split already exists** — `apps/web/app/api/health/route.ts` (dependency-free liveness, always 200)
  and `apps/web/app/api/ready/route.ts` (calls `checkReadiness()` in `packages/api`, DB connectivity, 503 when not ready).
- **API error mapping exists** — `packages/api/src/trpc.ts` `mapDomainErrors` maps every `DomainError.code` → tRPC code on
  every procedure; `errorFormatter` surfaces Zod field errors.
- **Typed fail-fast env** — `apps/web/src/env.ts` + `apps/mobile/src/env.ts` (`@t3-oss/env` + zod), `.env.example` at root
  and `packages/db/.env.example`.
- **CI exists** — `.github/workflows/ci.yml`: lint → typecheck → test → `db:validate` → build, on push-to-main + all PRs.
- **Audit trail exists (ADR-007)** — `AuditLog` written in-transaction by every sensitive mutation across M1–M16.
- **Logging is nearly clean** — **zero** `console.*` in app source; the only source-level calls are **5 deliberate
  `console.error`** for fire-and-forget notification failures in `packages/business/src` (fee ×2, notification events,
  behaviour, announcement).

### Named gaps M17 fills

CSP · app-level rate limiting · centralized structured logger · web App-Router error boundaries (`error.tsx`/
`not-found.tsx`/`global-error.tsx`) · mobile global error boundary · Docker/containerization + production compose ·
CI audit + docker-build + deploy stages · backup/DR runbooks · Super-Admin ops tooling (`system:manage`) · remove the
stale root `package-lock.json` (pnpm is authoritative).

## Decision

### 0. Freeze reconciliation — instrumentation may touch frozen modules (the keystone)

Constraint 1 freezes M1–M16 domain behaviour; constraint 5 **explicitly permits** changes to existing APIs *when required
for logging, monitoring, or error handling*. These are consistent, and the reconciliation is stated here once so no later
step reads as a freeze violation:

> **Observability, error-handling, and security instrumentation may touch frozen files. Such a change is permitted by
> constraint 5 and by the frozen-module "security fix" exception, provided it changes no domain behaviour, no business
> rule, and no data.** Concretely this authorizes: replacing the 5 business-layer `console.error`s with `logger.error`
> (same fire-and-forget semantics), wrapping frozen router/service surfaces with logging/error middleware, adding error
> boundaries around frozen UI, and adding performance-only indexes. It does **not** authorize changing any transition,
> validation, permission grant, query result, or audit content. Every such touch is called out at its step's STOP.

### 1. Production philosophy — additive, verify-first, platform-leaning

- **Additive-only.** No domain code path changes meaning. New files (logger, error boundaries, Dockerfile, runbooks,
  ops router) and additive edits (headers, indexes, `console.error`→`logger`) only. Proven at each STOP by scoped diff.
- **Verify before build.** Where a seam already exists (health/ready, error mapping, env validation, headers), M17
  **verifies and closes the gap**, it does not re-implement. The inventory above is the spec for which is which.
- **Lean on the platform.** Supabase provides Postgres PITR/`pg_dump`, storage durability, and auth rate limiting. M17
  **documents and operationalizes** these (runbooks, checklists) rather than building parallel backup/DR infrastructure
  (YAGNI — see §8). Credential rotation is a known pre-prod blocker (project memory) and is captured in the runbooks.

### 2. Security hardening (Step 2)

- **Add CSP** as the 6th header, discharging the M1 deferral. Start in a **report-only** posture if inline-script nonce
  wiring proves fragile under Next 15 — a working header that doesn't break the app beats a strict one that does. HSTS/
  frame/nosniff/referrer/permissions stay as-is (verify-only).
- **Rate limiting** on the sensitive mutation surfaces named by the brief — login, homework/report-card/announcement
  publish, document approval, upload-URL mints. A middleware/token-bucket at the transport edge (not inside frozen
  services); keyed by principal + route. Discharges the M1 "app-level rate limiting deferred to M2+" item.
- **Review-only** (document findings, change nothing unless a real hole): cookies, CSRF, auth, uploads, signed URLs,
  storage access — all already reviewed sound in M1/ADR-004; M17 re-confirms and records evidence in `SECURITY_AUDIT.md`
  (Step 11).
- **Dependencies**: run `pnpm audit`; remove the stale root `package-lock.json`. Wire audit into CI (Step 8).

### 3. Observability — structured logging (Step 3)

- **One centralized logger** (a thin module, no heavy dependency unless a one-file wrapper is insufficient — pino is the
  fallback, not the default). JSON output; fields: `timestamp`, `level`, `requestId`, `userId`, `schoolId`, `route`,
  `durationMs`, `status`, `error`, `stack`. Levels: INFO / WARN / ERROR.
- **Request context** (`requestId`/`userId`/`schoolId`/`route`/`duration`) is populated at the transport edge (tRPC
  middleware + Next request scope), where the `Principal` already exists — not inside frozen services.
- Replace the 5 business `console.error`s with `logger.error` (identical fire-and-forget semantics — §0). `console.error`
  is retained only where genuinely appropriate (last-resort boundaries that must not depend on the logger).

### 4. Monitoring — health & readiness (Step 4)

- **Preserve the existing liveness/readiness split** (deliberate deviation from the brief's literal list, which places
  "database, storage" under `/health`). A liveness probe that fails on DB-down causes pointless pod restarts; dependency
  checks belong in readiness.
  - **`/health` (liveness)** — static + `version`, `uptime`, `environment`. Dependency-free, always fast.
  - **`/ready` (readiness)** — `database` **and** `storage` reachability (extend the existing `checkReadiness`), 503 when
    not ready.
- Both stay lightweight (no heavy queries, short timeouts). These **enhance** the existing routes, not create new ones.

### 5. Error handling (Step 5)

- **Web**: add App-Router `error.tsx` (500 boundary), `global-error.tsx` (root shell failure), `not-found.tsx` (404) —
  none exist today. They wrap frozen pages without changing them.
- **Mobile**: add a global error boundary in the app shell (`_layout.tsx`) rendering a recoverable error screen.
- **API**: `mapDomainErrors` already gives consistent error mapping (verify-only). Confirm storage-failure and
  notification-failure paths degrade gracefully (the latter already do — §0/ADR-005).

### 6. Performance & indexes (Step 6)

- Audit Prisma queries for N+1, missing pagination, join shape, CSV export cost; run `EXPLAIN ANALYZE` on expensive reads
  (analytics aggregates, list endpoints).
- **Add an index only when `EXPLAIN ANALYZE` justifies it.** Every index is proven **additive** by `prisma migrate diff`
  (CreateIndex only, zero ALTER on frozen columns) — the sole permitted schema change (constraint 2).

### 7. Deployment (Step 7) & CI/CD (Step 8)

- **Dockerfile** (multi-stage, Next standalone output for web), **`docker-compose.yml`** (local: web + Postgres) and a
  **production compose** (healthchecks wired to `/health` + `/ready`), refined **`.env.example`**, deployment + production
  build scripts. No orchestration platform is prescribed (YAGNI — compose covers single-tenant v1).
- **CI/CD**: extend the existing workflow to the full gate — lint → typecheck → test → build → `db:validate` → **docker
  build** (+ `pnpm audit`). Any stage fails ⇒ pipeline fails. Deploy job is scaffolded but gated (no live secrets in repo).

### 8. Backups, recovery & disaster recovery (Step 9) — runbooks, not infrastructure

Runbooks (`BACKUP.md` + `OPERATIONS.md`) covering: Postgres backup (Supabase PITR + `pg_dump`), restore, storage backup,
migration rollback, secret rotation (ties to the known pre-prod credential-rotation blocker), disaster recovery, and
deployment rollback. **M17 builds no backup service** — it operationalizes the Supabase platform + `pg_dump`.

### 9. Operations & `system:manage` (Step 10)

- **One new permission `system:manage`, Super Admin ONLY** (constraint 3). It is **not** granted to Office Admin — do not
  mirror M16's `settings:manage` SA+OA shape. Added to `packages/constants/src/permissions.ts` and `ROLE_PERMISSIONS`
  (SUPER_ADMIN only).
- **Read-only / non-destructive ops tooling** gated by it: health/diagnostics view, audit-log export (reads ADR-007),
  storage verification, cache clear, and a reserved hook for future maintenance. **No business-data modification** —
  these read, export, or clear caches; they never write domain rows.

### 10. Security audit & documentation (Steps 11–12)

- **`SECURITY_AUDIT.md`** — every milestone reviewed (permissions, RLS, storage, notifications, and each domain) with
  PASS / WARN / FAIL + evidence (file/line/proof). This is the milestone's assurance artifact.
- **Docs**: `DEPLOYMENT.md`, `SECURITY.md`, `OPERATIONS.md`, `BACKUP.md`, `ENVIRONMENT.md`, plus `project_memory.md` and
  `docs/milestones/M17.md`. Every architectural decision recorded (implementation notes fold back into this ADR after
  the steps run, the ADR-024 precedent).

## Deviations from the literal brief (flagged for veto at STOP)

1. **`/health` stays liveness-only; DB + storage checks live in `/ready` (§4).** The brief lists "database, storage" under
   `/health`; putting dependency checks in a liveness probe causes pointless restarts. The existing split is correct and
   kept. If you want the literal single-endpoint shape, say so.
2. **CSP may ship report-only first (§2)** if strict nonce wiring risks breaking the Next 15 app shell — enforce-mode
   follow-up once verified. A functioning header now beats a strict header that white-screens the app.
3. **No new backup/DR infrastructure (§8)** — runbooks over Supabase PITR/`pg_dump`, not a built backup service (YAGNI).
4. **No orchestration platform prescribed (§7)** — Docker + compose only; k8s/ECS is a future ops decision, not M17.
5. **`system:manage` is Super-Admin-only (§9)** — deliberately narrower than M16's SA+OA `settings:manage`.

## Alternatives considered

1. **Rebuild health/ready, error mapping, env validation from the brief's wording.** Rejected — they already exist and
   are correct; M17 verifies and closes the CSP/rate-limit/logger/boundary gaps instead (verify-first philosophy).
2. **Put DB/storage checks in `/health`.** Rejected (§4, Deviation 1) — breaks the liveness/readiness contract.
3. **Build a backup/DR service.** Rejected (§8) — Supabase PITR + `pg_dump` + runbooks meet single-tenant v1; a bespoke
   service is speculative and duplicates the platform.
4. **Heavy logging framework (winston/full pino stack) up front.** Rejected — a thin JSON logger module meets the field
   spec; pino is the fallback only if the wrapper proves insufficient (no premature dependency).
5. **Grant `system:manage` to Office Admin too.** Rejected (constraint 3) — ops tooling is Super-Admin-only by mandate.

## Consequences

- (+) **Zero business-feature change** — the milestone is instrumentation + infra; every domain engine's behaviour,
  permissions, and audit content are untouched (proven per-step by scoped diff, and the freeze carve-out §0 is explicit).
- (+) **Verify-first keeps the diff small** — most "create" items are "close a named gap"; the inventory scopes each step.
- (+) **Platform-leaning** — reuses Supabase PITR/storage/auth-limits and the existing audit trail; no parallel infra.
- (+) **One narrow permission** — `system:manage`, SA-only, read/export/clear only; no new business-data write path.
- (−) **CSP may land report-only first (§2)** — a documented two-phase rollout, not a defect.
- (−) **Backup/DR is runbook-operationalized, not automated in M17 (§8)** — automation (scheduled `pg_dump`, off-site
  copy) is a named future ops step; the runbook makes the manual path reliable meanwhile.
- (−) **The known pre-prod blockers remain** (credential rotation, real SMS provider) — M17 documents them in the runbooks
  and security audit but does not resolve them (they need provisioning decisions, not code).

## STOP — Step 1 boundary

Awaiting approval of: **(a)** the additive/verify-first/platform-leaning philosophy (§1); **(b)** the freeze
reconciliation carve-out permitting instrumentation to touch frozen modules with no behaviour change (§0); **(c)** the
per-area posture — CSP + rate-limit (§2), centralized JSON logger (§3), the preserved liveness/readiness split (§4),
web+mobile error boundaries (§5), justified-only additive indexes (§6), Docker/compose + CI docker-build/audit (§7),
runbook-based backup/DR (§8), and **Super-Admin-only** `system:manage` ops tooling (§9); and **(d)** the five flagged
deviations from the literal brief. Implementation notes (Steps 2–12) fold back into this ADR after each step, the ADR-024
precedent.
