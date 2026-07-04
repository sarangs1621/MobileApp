# Status — Authentication & Authorization

- **Status:** Implemented (M1 Steps 1–8); security review + tests + docs remaining.
- **Current milestone:** M1
- **Completion:** ~85% (Steps 9–11 pending)
- **Dependencies:** `@repo/db`, `@repo/auth`, `@repo/core`, `@repo/business`, `@repo/api`, `@repo/constants`, `@repo/validation`, `@repo/ui`, `@repo/i18n`
- **Frozen?** Yes — implemented layers are frozen (amend only for a security fix from Step 9, a critical bug, or explicit approval).
- **Known issues:**
  - Provisioning (Supabase Admin API) + seed super-admin + SMS provider not built → no real sign-in/OTP yet.
  - Live sign-in/OTP unverified in dev (no Supabase project); verified structurally + unit tests with mocks.
  - Activation (INVITED→ACTIVE) is audited (`USER_ACTIVATED`).
- **Next work:** Step 9 (security review) → Step 10 (tests) → Step 11 (docs).
- **Feature rules:** `docs/features/authentication.md`. Permission catalog: `docs/PERMISSIONS_MATRIX.md`.
