# Project Rules — always load

Condensed from the ADRs + convention docs. This is the ruleset for every session;
do **not** re-read the full PRD unless a task needs a specific spec.

## Stack (locked)
Turborepo + pnpm · TypeScript (strict) · Next.js 15 (web) · Expo + expo-router + NativeWind (mobile) ·
tRPC + Zod · Prisma + Postgres (Supabase) · Supabase Auth · TanStack Query · Zustand · shadcn tokens.
Runtime: **Node 24 LTS via nvm** (`export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"`), **pnpm 9**.

## Architecture rules
- Layering: **UI → tRPC router → business service → repository → Prisma → DB**; deps point inward.
- **Routers are transport-only:** validate (Zod) → authorize (business) → delegate. No logic, no Prisma in routers.
- **Business logic lives only in `packages/business` services.** Pure domain rules in `packages/core` (no framework).
- **Only `packages/db` imports `@prisma/client`.** Data access via repositories; repositories contain **no authorization**.
- **Authorization is application-enforced, permission + scope, in the business layer** (ADR-002):
  `assertCan(principal, PERMISSION)` (role→permission via `ROLE_PERMISSIONS`) then `assertScope(...)`.
  There is **no transport role gate**. Role/schoolId/status come from the **DB `Principal`**, never the JWT/client.
- **Supabase Auth owns credentials/OTP/JWT** (ADR-001); we store no passwords; `User.id == auth UID`.
- **Supabase calls only inside `packages/auth`** (client factories + session/credential helpers).
- Sensitive mutations (marks, attendance, roles/users, enrollment, money) **write an `AuditLog` row in the same transaction** (ADR-007).
- **RLS is defense-in-depth**, not the primary gate (Prisma bypasses it) — it guards Storage/signed URLs/direct access (ADR-004).
- **Single-tenant now**, `schoolId` loose scalar on every table (ADR-008). Add-ons behind `FeatureFlag` (ADR-006).
- **IST everywhere** (store UTC, render IST); calendar-date columns use `@db.Date` (v1.3 decision #22).
- **Storage fields hold private-bucket paths (`*Path`), never URLs** (v1.3 decision #24); sign per read after authz.

## Dependency (import) rules — enforced by ESLint `no-restricted-imports`
- `core`: only `types` / `constants` / `utils` (no frameworks, no db/api/auth).
- `business`: composes `db` + `core` + `notifications` + `auth`; no React/UI.
- `api`: → `business` / `auth` / `validation` / `constants` / `core`; **never `db` or `@prisma/client`**.
- `apps/*`: → `api` (client), `ui`, `i18n`, `types`, `constants`, `validation`, `utils`; **never `db` / `business` / `@prisma/client`**.
- Mobile imports `AppRouter` **type-only** (never a value from `@repo/api`) or Metro bundles Prisma.

## Coding rules
- Strict TS: no `any`, no `@ts-ignore`/`eslint-disable` (fix the cause). No magic numbers (name in `constants`).
- Shared Zod schemas in `packages/validation` (reused by tRPC + RHF). DTOs from `packages/types` (never raw Prisma rows).
- Money = integer minor units. Timestamps stored UTC. Import order + no unused imports (ESLint).
- Files small; feature-first; naming per `docs/CODING_STANDARDS.md`. Conventional Commits (`type(scope): subject`).
- React: Server Components by default (`"use client"` only when needed); TanStack Query for server state, Zustand for local.

## Definition of Done (summary — full list in docs/DEFINITION_OF_DONE.md)
Requirements complete · DB reviewed (constraints/indexes/`onDelete`/migration) · Security (authz in service, RLS where relevant, no client secrets) ·
Validation (Zod) · Tests pass (unit + integration + authz/edge) · Docs updated · a11y (labels, ≥44px, contrast) ·
Performance (no N+1) · **no TS errors · no ESLint errors** · bilingual (en+ml) · audit where required · IST correct · web+app parity.

## Validation commands (run from repo root, Node 24 on PATH)
`pnpm run typecheck` · `pnpm run lint` · `pnpm run test` · `pnpm run db:validate` · `pnpm run build`
(web build needs `SKIP_ENV_VALIDATION=true`; mobile bundle: `pnpm --filter mobile run export`).

## Frozen modules
Completed/approved modules are **read-only**. Modify only for a critical bug, a security fix, or explicit user approval.
Check `docs/project_memory.md` → "Frozen Modules" before editing anything.
