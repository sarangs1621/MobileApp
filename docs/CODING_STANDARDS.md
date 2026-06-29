# Coding Standards — School Management Portal

Authoritative engineering conventions for this monorepo. These are enforced in code review and, where noted, by tooling (ESLint, tsconfig, CI). They complement — never override — the Developer PRD.

---

## 1. Folder & package conventions
- **Monorepo layout** is fixed by Dev PRD §4.1: `apps/{web,mobile}` + `packages/{api,auth,business,constants,core,db,i18n,notifications,types,ui,utils,validation}`.
- **Feature-first inside a package.** A feature folder contains: `components/`, `hooks/`, `services/`, `schemas/`, `types/`, `constants/`, `utils/`, `tests/`. Omit a sub-folder only if the feature genuinely has nothing for it.
- **Layer boundaries are import rules** (§5). `core` is pure; `db` is the only Prisma consumer; `api` never imports Prisma; apps never import `db`/`business` directly.
- **One responsibility per file; prefer small files.** Split when a file mixes concerns or exceeds comfortable reading length.

## 2. Naming conventions
- **Files:** React components `PascalCase.tsx`; hooks `useThing.ts`; services `thing.service.ts`; Zod schemas `thing.schema.ts`; tests `thing.test.ts`; everything else `kebab-case.ts`.
- **Symbols:** `PascalCase` types/interfaces/components/enums; `camelCase` variables/functions; `UPPER_SNAKE_CASE` true constants; booleans read as predicates (`isActive`, `hasPractical`, `canApproveLeave`).
- **No abbreviations** beyond well-known ones (`id`, `url`, `db`). No Hungarian notation; **no `I`-prefixed interfaces**.

## 3. TypeScript rules
- **Strict mode on** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`). **`any` is banned** — use `unknown` + narrowing.
- **Never disable** TypeScript or ESLint (`// @ts-ignore`, `eslint-disable`) — fix the cause. A genuinely unavoidable exception requires a `// reason:` comment **and** reviewer sign-off.
- **No magic numbers/strings** — name them in `packages/constants`.
- Prefer `type` for unions/shapes, `interface` for extensible contracts. Make illegal states unrepresentable (discriminated unions over boolean soup).
- All money is integer minor units; all timestamps stored UTC, rendered IST (use `packages/utils` date helpers — never raw `new Date()` for calendar logic).

## 4. Import rules
- **Use workspace aliases** (`@repo/core`, `@repo/db`, …); no deep relative climbs (`../../../`).
- **Respect layer direction** (Dev PRD §4.1): enforced with ESLint `no-restricted-imports`/`import/no-cycle`. No circular dependencies.
- Type-only imports use `import type`. Order: node/builtins → external → workspace → relative; no unused imports.

## 5. Prisma conventions
- **Schema in `packages/db` only;** only `db` imports `@prisma/client`. Everything else goes through **repositories**.
- **Every migration is reviewed**; never edit an applied migration — add a new one. `prisma validate` + `prisma migrate` run in CI before deploy.
- Models `PascalCase` singular; fields `camelCase`. Add **explicit relations** for in-domain references; document any intentionally loose `*Id` inline (see Dev PRD §6).
- Declare **unique constraints, indexes, and `onDelete`** deliberately — no implicit cascades. Multi-row writes that must be atomic use `prisma.$transaction`.
- **"Unique when present" uses a partial unique index, not `@@unique`, on a nullable column.** A plain composite unique does **not** constrain rows where a column is `NULL` (Postgres treats NULLs as distinct), so for nullable-scoped uniqueness add a raw-SQL partial index in the migration and document it with a schema comment. Established uses: `GuardianStudent` (one primary per student — `WHERE "isPrimary"`) and `ReportCard` (one card per exam — `WHERE "examId" IS NOT NULL`, ADR-009). Conversely, when a column must dedupe, make it **non-null with a sentinel** so `@@unique` works (e.g. `Attendance.period @default(0)`).
- **A DB constraint is the integrity guarantee; a service-layer check is only a complement** (better errors, defense in depth). Never rely on a service check alone for uniqueness — it is racy under concurrency.

## 6. tRPC conventions
- **Routers are transport-only** (Dev PRD §4.2): `input(zodSchema)` → role guard → call a `packages/business` service → return. **No business logic, no Prisma in routers.**
- Use `protectedProcedure`/scoped procedures; never re-validate by hand what Zod already guarantees.
- Add-on procedures **check the feature flag** and return `FORBIDDEN` when off (ADR-006). Sensitive mutations **write an `AuditLog` row** in the same transaction (ADR-007).
- Inputs/outputs are typed via shared `packages/validation` + `packages/types`; no `any` in router signatures.

## 7. React (web — Next.js 15) conventions
- **App Router; Server Components by default**, `"use client"` only when needed (interactivity/hooks).
- **No business logic in components or pages** — call hooks that call the typed API; data via **TanStack Query**, UI/ephemeral state via **Zustand**, forms via **React Hook Form + Zod**.
- Styling: **TailwindCSS + shadcn/ui**, design tokens from `packages/ui`. Avoid deep component nesting; prefer composition. Accessible by default (labels, roles, focus, contrast). All user-facing strings via `packages/i18n` (en + ml) — **no hardcoded copy**.

## 8. React Native (mobile — Expo) conventions
- **expo-router** for navigation; role-based stacks after sign-in. Styling via **NativeWind** + the same `packages/ui` tokens.
- Same separation: components are dumb, logic in hooks/services; TanStack Query for server state (with persistence for read caches), Zustand for local state.
- Push via `expo-notifications` (register on login, clear on logout). Large tap targets, high contrast, Malayalam font bundled and verified on iOS + Android. OTA only for JS-only fixes.

## 9. Testing rules
- Every feature ships **unit + integration tests, plus edge-case, validation, and authorization tests** (Dev PRD §12).
- **Pure domain logic in `packages/core`** (grade calc, attendance %, promotion) is unit-tested exhaustively. **Services** are tested with fake repositories (no DB). **Key tRPC procedures** get integration tests for authz scope and audit writes.
- Tests are deterministic (fixed IST clock, seeded data); name them by behavior; no skipped/`.only` tests committed.

## 10. Git & commit conventions
- **Trunk-based with short-lived branches:** `feat/…`, `fix/…`, `chore/…`, `docs/…`. Never commit straight to the default branch.
- **Conventional Commits:** `type(scope): subject` — types `feat|fix|chore|docs|refactor|test|perf|build|ci`; scope is the package/feature (e.g. `feat(attendance): bulk mark upsert`). Imperative mood, ≤72-char subject, body explains *why*.
- One logical change per PR; PR description links the milestone/§ and lists tests. **CI must be green** (lint → typecheck → test → `prisma validate` → build) before merge; merge is blocked on failure. No secrets in commits.
