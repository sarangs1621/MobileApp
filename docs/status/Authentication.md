# Status — Authentication & Authorization

- **Status:** Implemented + security-reviewed (M1 Steps 1–9); tests + docs remaining.
- **Current milestone:** M1
- **Completion:** ~90% (Steps 10–11 pending)
- **Dependencies:** `@repo/db`, `@repo/auth`, `@repo/core`, `@repo/business`, `@repo/api`, `@repo/constants`, `@repo/validation`, `@repo/ui`, `@repo/i18n`
- **Frozen?** Yes — implemented layers are frozen (amend only for a security fix from Step 9, a critical bug, or explicit approval).
- **Known issues:**
  - Provisioning (Supabase Admin API) + seed super-admin + SMS provider not built → no real sign-in/OTP yet.
  - Live sign-in/OTP unverified in dev (no Supabase project); verified structurally + unit tests with mocks.
  - Activation (INVITED→ACTIVE) is audited (`USER_ACTIVATED`).
- **Frozen-module amendments (Step 9 security fixes — allowed by freeze protocol):**
  - `packages/auth/src/session.ts` — `signInWithOtp` now passes `shouldCreateUser: false` (blocks anon-key user creation / SMS pumping).
  - `apps/web/next.config.ts` — baseline security headers (X-Frame-Options, nosniff, Referrer-Policy, HSTS, Permissions-Policy).
  - Full report + Supabase dashboard checklist: `docs/SECURITY_REVIEW_M1.md`.
- **Next work:** Step 10 (tests) → Step 11 (docs).
- **Feature rules:** `docs/features/authentication.md`. Permission catalog: `docs/PERMISSIONS_MATRIX.md`.
