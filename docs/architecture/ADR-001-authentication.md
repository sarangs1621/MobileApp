# ADR-001 — Authentication via Supabase Auth

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture
**Related:** Dev PRD §2, §4.3, §8.1, §10 · ADR-002, ADR-005

## Context
The portal serves two credential styles for one school: **parents sign in by phone OTP**, **staff by email + password**. The data concerns minors (DPDP), so we want to avoid storing password material ourselves, avoid building OTP throttling/recovery, and have a single JWT both web (Next.js) and mobile (Expo) can verify. There is **no public self-signup** — accounts are pre-created at import and activated on first sign-in.

## Decision
Use **Supabase Auth** as the system of record for credentials, OTP, password reset, and JWT issuance.
- Our `User` table is a **profile keyed to the Supabase auth UID** (`User.id == auth.users.id`). We store **no passwords or OTP secrets**.
- First sign-in creates/activates the profile (`INVITED → ACTIVE`) with role + `schoolId`.
- tRPC context verifies the Supabase JWT, loads the profile, and exposes `{ userId, role, schoolId }`.
- Recovery = Supabase reset (staff) / OTP re-login (parents). OTP SMS uses the same provider configured in the notifications layer (ADR-005).

## Alternatives Considered
- **Custom auth (bcrypt + JWT):** maximum control, but we then own password storage, breach risk, OTP delivery/throttling, and reset flows for minors' guardians — high liability for no product gain. Rejected.
- **NextAuth/Auth.js:** good for web, but weaker for Expo native + phone-OTP, and still needs an OTP/SMS story. Rejected.
- **Clerk / Auth0:** capable, but adds a second vendor + cost on top of Supabase (already chosen for DB/Storage), and phone-OTP pricing/locale fit is worse for India. Rejected.

## Consequences
- (+) No password/OTP material stored by us; smaller breach surface; less code to maintain.
- (+) One JWT shared by web + mobile; clean tRPC context.
- (+) Pre-created accounts + activation match the bulk-import onboarding flow.
- (−) Coupling to Supabase Auth; a future migration would need a credential export plan.
- (−) Profile/auth split means a small reconciliation step (registerProfile) on first sign-in, which must be idempotent.
