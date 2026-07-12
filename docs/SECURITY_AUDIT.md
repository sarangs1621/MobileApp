# Security Audit — M17 Step 11 (ADR-025 §10)

**Date:** 2026-07-12 · **Scope:** every milestone M1–M17. **Method:** static evidence
(file:line) cross-checked against the architecture invariants (ADR-001/002/003/004/007)
plus the empirical RLS/permission proofs each milestone shipped. Verdicts: **PASS** /
**WARN** (works, but a tracked gap or plan-tier/operational item) / **FAIL** (exploitable).

**Result: 0 FAIL. Core controls PASS. 7 WARN — all tracked, none exploitable in the
current single-tenant, service-role-gated architecture.**

The load-bearing fact for every domain: **authorization is decided in the business layer
against a DB-built `Principal`** (`context.ts:38` → `resolvePrincipal` → `users.findById`
→ `mapUserToPrincipal`), so role/status/schoolId come from the DB `User` row, **never the
JWT** (ADR-002). RLS is defense-in-depth (the app connects as service_role/BYPASSRLS).

## Summary

| Area | Verdict | Basis |
|---|---|---|
| Authentication | **PASS** | server `getUser()` revalidation, no JWT role, mid-session revocation, SecureStore/SSR cookies (M1 review) |
| Authorization (Permissions) | **PASS** | `assertCan` on every mutation; no transport role gate; `system:manage` SA-only |
| RLS (defense-in-depth) | **PASS** | 14 `*_rls` migrations + 1 inline; all 52 models covered; anon denied |
| Storage | **PASS** | private buckets, mint-after-authz, schoolId-namespaced paths, no `getPublicUrl` |
| Transport (headers/CSRF/rate-limit) | **PASS** | 6 headers, JSON-POST CSRF, rate-limited publish/approve/upload |
| Audit trail | **PASS** | 99/99 `recordAudit` in-transaction |
| Injection | **PASS** | one parameterized `$queryRaw` (`SELECT 1`); no `*Unsafe`/`Prisma.raw` |
| Secrets & logging | **PASS** | service-role server-only; logger emits no tokens/PII/bodies |
| Dependencies | **WARN** | 2 moderate transitive advisories (unremediated) |
| Tenant isolation | **PASS** ⚠ | scoped everywhere; one latent coupling in `mark.repository` |
| **Domains** Attendance, Homework, Exams, Report Cards, Fees, Announcements, Documents, Behaviour, Timetable, Settings, Notifications | **PASS** | each = RLS migration + `assertCan` service gate + in-tx audit (below) |

---

## Cross-cutting controls

### Authentication — PASS
Server-side `supabase.auth.getUser()` revalidation on every request (never `getSession()`);
`AuthUser` carries only `userId` — no role/schoolId from the JWT. Mid-session revocation:
`protectedProcedure` re-checks `status === "ACTIVE"` from the DB per request (`trpc.ts`), so a
DISABLED user is cut off despite a valid token. Mobile sessions in SecureStore; web in
`@supabase/ssr` cookies (SameSite-Lax). Public signup disabled (`shouldCreateUser:false`, M1
fix). Evidence: `docs/SECURITY_REVIEW_M1.md`, `packages/auth/src/context.ts`.

### Authorization / Permissions — PASS
Every mutation service opens with `assertCan(ctx.user, PERMISSIONS.X)`
(`packages/business/src/authorization.ts:27`); sampled `enrollment.service.ts:102/152/179/210`.
**No transport-layer role authz** — grep for `role === "..."` in `packages/api/src` = 0 hits (all
role checks are UI presentation gating in apps only). M17's `system:manage` is granted to
**SUPER_ADMIN only** (not OFFICE_ADMIN) — proven by `packages/api/src/routers/system.test.ts`.

### RLS — PASS
14 `*_rls` migrations + inline RLS for ClassTeacherAssignment
(`20260710020000_class_teacher_assignment/migration.sql:62`) cover **all 52 models** — no table
lacks RLS. Uniform shape: `ENABLE ROW LEVEL SECURITY` + `*_admin_all FOR ALL TO authenticated
USING (is_academic_admin()/is_admin())` + role-scoped SELECT policies. **No policy grants
`anon` anything** (RLS-enabled + no matching policy = deny). `ENABLE` (not `FORCE`) is
**intentional** — the service_role app path bypasses by design; RLS is the second line, the
business `assertCan` is the first. `GRANT ... TO anon` appears only in `*/rls-verify.sql` test
harnesses, never in applied migrations.

### Storage (ADR-004) — PASS
All 5 buckets private (`packages/constants/src/index.ts:51`); grep `getPublicUrl|publicUrl` = 0
hits. Every signed-URL mint gates first and namespaces the path by `schoolId` server-side (a
client can't choose a cross-tenant path): `mintDocumentUploadUrl`
(`people/document-storage.service.ts:49`), `mintHomeworkUploadUrl` (`homework/attachment.service.ts:47`),
`mintSubmissionUploadUrl` (`homework/submission-attachment.service.ts:43`), `documentUploadUrl`
(`document/document.service.ts:132`), announcement (`announcement/attachment.service.ts:65`),
`brandingLogoUploadUrl` (`settings/branding.service.ts:82`). Downloads mint from the DB row's
stored `storagePath` after a tenant/scope re-check, never a client-supplied path. TTL 60s–300s.

### Transport: headers / CSRF / rate-limit — PASS
6 response headers (`apps/web/next.config.ts`): X-Frame-Options DENY, nosniff, Referrer-Policy,
HSTS, Permissions-Policy, **CSP (report-only — WARN below)**. CSRF: tRPC JSON-POST forces a
preflight, no CORS headers set → cross-origin blocked; SameSite-Lax cookies; no state-changing
GET. **Rate limiting** (M17): `homework.publish`/`reportCard.publish`/`reportCard.approve`/
`announcement.publish`/`document.approve` (20/min) + upload mints (30/min), keyed per principal
(`packages/api/src/rate-limit.ts`). Login is Supabase-direct (rate-limited by Supabase).

### Audit trail (ADR-007) — PASS
All **99** `recordAudit` call sites pass the `withTransaction` repos handle (`recordAudit(ctx,
repos, …)`, 0 use the non-tx `ctx.repositories`), so the audit row commits or rolls back with the
mutation. Every write-bearing service file has ≥1 audit write. Def: `people/scope.ts:82` →
`repos.audit.record`.

### Injection — PASS
The entire repo has **one** raw-SQL call: `packages/db/src/health.ts:10`
`prisma.$queryRaw\`SELECT 1\`` — parameterized tagged template, constant, no interpolation. No
`$queryRawUnsafe` / `$executeRaw` / `Prisma.raw`.

### Secrets & logging — PASS
`SUPABASE_SERVICE_ROLE` is in the t3-env **server** block (`apps/web/src/env.ts:14`) — importing
it client-side is a build error; used only in `api/ready/route.ts` + `lib/storage.ts`. The
structured logger (`packages/core/src/logger.ts`) emits only `requestId/userId/schoolId/route/
durationMs/status/error/stack` (`trpc.ts:97-111`) — **no request bodies, tokens, PII, or audit
`before/after` payloads**. Business log sites carry entity IDs + `errorFields(err)` only. No
hardcoded JWT-shaped literals; the only committed env files are `.env.example`.

---

## Per-domain verdicts — all PASS

Each domain composes the same three proven controls: an RLS migration (defense-in-depth), an
`assertCan(...)` business gate on every mutation, and an in-transaction `recordAudit`. Parents/
teachers additionally get a **business read filter** (per-user visibility) on top of coarse RLS.

| Domain | RLS migration | Notes |
|---|---|---|
| Attendance (M4) | `20260707010000_attendance_rls` | forward-only lifecycle; immutable corrections; B3 actors |
| Exams (M5) | `20260709010000_exam_rls` | teacher INSERT/UPDATE `WITH CHECK`; parent **published-only** mark reads |
| Homework (M6) | `20260710010000_homework_rls` | parent submit gated (`assertParentOwnsEnrollment`); attempt-scoped uploads |
| Report Cards (M7) | `20260710040000_report_card_rls` | class-teacher/parent scoped; snapshot frozen at approve |
| Timetable (M9) | `20260711020000_timetable_rls` | read-mostly; double-booking structurally impossible |
| Notifications (M10) | `20260711040000_notification_rls` | per-user recipient rows; admin `is_academic_admin()` |
| Announcements/Calendar (M11) | `20260711060000_announcement_calendar_rls` | teacher-draft/admin-publish; published-only reads |
| Behaviour (M12) | `20260712020000_discipline_rls` | teacher enrollment-derived; immutable after CLOSED |
| Fees (M13) | `20260712040000_fees_rls` | money `Int` paise; CHECK constraints; append-only Payment; parent own-child |
| Documents (M15) | `20260712060000_documents_rls` | APPROVED-only visibility; 60s signed URLs |
| Settings (M16) | `20260712070100_settings_rls` | Branding any-authenticated read; School/System admin-only |

---

## WARN register (tracked; none exploitable today)

| # | Sev | Finding | Why not FAIL / remediation |
|---|---|---|---|
| 1 | Low-Med | **`mark.repository.ts:44-45`** `listByExamSection`/`listByEnrollment` carry **no `schoolId` filter**. | Safe today — every caller (`exam/mark.service.ts:161/200/324/341`) runs `loadExamSectionInSchool`/`loadEnrollmentInSchool` first. Latent: a future caller omitting the in-school load could read cross-tenant. Repos are authz-free by design (ADR-003). Fix = a defense-in-depth `schoolId` param — a **frozen-M5 domain change**, out of M17 scope; tracked for a future security-hardening change. |
| 2 | Med | **CSP is report-only**, not enforcing (`next.config.ts`). | Deliberate phase 1 (ADR-025 §2 dev. 2) — surfaces violations without white-screening Next 15. Enforce phase = drop `'unsafe-inline'` from script-src + per-request nonces. |
| 3 | Med | **`pnpm audit`: 2 moderate** transitive advisories — `postcss` (via Next, build-time) and `uuid <11.1.1` (via a root dep + Expo CLI). | Toolchain/transitive, no runtime-exploitable path; major bumps risk the frozen build. CI fails on **high/critical** (`--audit-level high`); these are accepted + tracked. |
| 4 | High (ops) | **Credentials pending rotation** — service-role key, DB password, seed admin password were shared during setup (M1.5). | **Must rotate before real data.** Procedure: `docs/BACKUP.md §5`. Operational, not a code defect. |
| 5 | Med (ops) | **Real SMS provider pending** — only the Supabase test OTP number works. | Parent go-live blocker; provider + India DLT needed. Tracked since M1.5. |
| 6 | Low (ops) | **PITR + leaked-password (HIBP) require Supabase Pro** — currently free tier. | Enable on upgrade (`RUNBOOK_SUPABASE_SETUP.md §6`). Backup meanwhile via `pg_dump` (`BACKUP.md §1b`). |
| 7 | Low | **Static probe password** literal at `packages/business/scripts/verify-auth.ts:73`. | Ops-only verification script; creates a throwaway probe user, never production data. Move to env if it's ever run against real data. |

## Sign-off

Core security controls (auth, authorization, RLS, storage, audit, injection, secrets) are
**PASS with cited evidence**. The 7 WARNs are tracked, non-exploitable in the current
architecture, and each has a named remediation owner (a future frozen-module change, a phase-2
CSP, a dependency bump, or an operational/provisioning step). **No FAIL.**
