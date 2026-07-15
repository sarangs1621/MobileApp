# Security (M17 / ADR-025 §2)

Security posture and the pre-production checklist. Full evidence-based review:
**`docs/SECURITY_AUDIT.md`** (M1–M17, 0 FAIL). Architecture rationale: ADR-001/002/004.

## Model in one line
Authorization is decided in the **business layer** against a **DB-built `Principal`**
(role/status/schoolId from the DB `User` row, never the JWT). RLS is defense-in-depth; the
app connects as service_role. Tenancy is a loose `schoolId` on every row.

## Controls
- **Auth (ADR-001):** server-side `getUser()` revalidation every request; mid-session revocation
  (`protectedProcedure` re-checks `status === ACTIVE`); public signup disabled; SecureStore
  (mobile) / `@supabase/ssr` SameSite-Lax cookies (web).
- **Authorization:** `assertCan(principal, permission)` on every mutation; scope predicates for
  ownership; **no transport role gate**. `system:manage` (ops) is **SUPER_ADMIN only**.
- **RLS:** every table (52 models) RLS-enabled; anon denied; per-role SELECT policies.
- **Headers (`next.config.ts`):** X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS,
  Permissions-Policy, **CSP (ENFORCED — per-request nonce + `'strict-dynamic'`, set in `apps/web/middleware.ts`)**.
- **CSRF:** tRPC JSON-POST forces preflight; no CORS headers; SameSite-Lax; no state-changing GET.
- **Rate limiting:** publish/approve (20/min) + upload mints (30/min), per principal
  (`packages/api/src/rate-limit.ts`). Login is Supabase-direct (rate-limited there).
- **Storage (ADR-004):** all buckets private; signed URLs minted server-side **after** an
  authz + tenant check; paths namespaced by `schoolId`; 60–300s TTL.
- **Audit (ADR-007):** sensitive mutations write an `AuditLog` row in the same transaction.
- **Secrets:** service-role key is server-only (t3-env `server` block); structured logs carry
  no tokens/PII/bodies.

## Reporting a vulnerability
Email the maintainer (repo owner). Do not open a public issue for an exploitable finding.
Include repro steps and affected file/route.

## Pre-production checklist (blockers — from SECURITY_AUDIT WARN register)
- [ ] **Rotate credentials** — service-role key, DB password, seed admin password (shared during
      setup, M1.5). Procedure: `BACKUP.md §5`.
- [ ] **Enable Supabase PITR + leaked-password (HIBP)** protection (Pro plan).
- [ ] **CSP → enforce** — drop `'unsafe-inline'` from `script-src`, wire per-request nonces.
- [ ] **Real SMS provider** + India DLT (test OTP number only today).
- [ ] **Custom SMTP** for auth emails before production volume.
- [ ] Re-run `pnpm audit`; upgrade any **high/critical** (2 moderate transitive are accepted/tracked).
- [ ] Apply the Supabase auth config checklist (`SECURITY_REVIEW_M1.md`, `RUNBOOK_SUPABASE_SETUP.md §2`).
