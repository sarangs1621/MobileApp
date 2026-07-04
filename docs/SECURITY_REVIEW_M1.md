# Security Review — M1 Authentication (Step 9)

Date: 2026-07-04 · Scope: JWT, storage, cookies, session expiry/refresh, brute-force/rate-limit, CSRF, sensitive logging, Supabase config.
Verdict: **architecture sound; 2 findings fixed; remaining items are Supabase dashboard configuration (blocked on provisioning).**

## Findings & fixes

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **High** | `signInWithOtp` omitted `shouldCreateUser: false` (supabase-js defaults to **true**) — anyone with the public anon key could create auth users and trigger SMS to arbitrary numbers (SMS pumping + violates the no-public-signup design, ADR-001). | **Fixed** in `packages/auth/src/session.ts`. |
| 2 | Medium | No security response headers on the web app; Supabase SSR auth cookies are JS-readable by design, so XSS/clickjacking are the practical session-theft vectors. | **Fixed** in `apps/web/next.config.ts`: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`. CSP deferred (needs nonce wiring for Next inline scripts) — tracked below. |

## Verified sound (no change needed)

- **JWT verification:** server uses `supabase.auth.getUser()` (server-side re-validation), never `getSession()`, for both cookie (web) and bearer (mobile) paths (`packages/auth/src/context.ts`). `AuthUser` carries no role/schoolId — authorization data comes only from the DB `Principal` (type-level guarantee, ADR-002).
- **Token storage:** mobile sessions in SecureStore (Keychain/Keystore), never AsyncStorage; web sessions in `@supabase/ssr` cookies. Service-role key is server-only env (`SUPABASE_SERVICE_ROLE`, no `NEXT_PUBLIC_` prefix) and currently unused.
- **Session expiry/refresh:** web middleware rotates tokens on navigation; browser client auto-refreshes between navigations; mobile `autoRefreshToken` + per-request current token. **Mid-session revocation works:** `protectedProcedure` re-checks `status === ACTIVE` from the DB on every request, so a DISABLED user is cut off despite a valid JWT.
- **CSRF:** mutations are tRPC POST with `application/json` (forces preflight; no CORS headers set → cross-origin blocked) + SameSite-Lax cookies. GET is queries only. No state-changing GET.
- **Sensitive logging:** no `console.*` of credentials/tokens/PII anywhere in auth code (repo-verified). Forgot-password page uses non-enumerating copy.
- **Admin mutations:** `setRole`/`disableUser`/`enableUser` gated by `assertCan` in the business layer, audited in-transaction, self-disable blocked.

## Required Supabase dashboard configuration (checklist — apply at provisioning)

Blocked on the pending Supabase project; must be applied before go-live:

1. **Disable public signups** (email and phone) — accounts are created only via the Admin API.
2. **OTP:** expiry ≤ 600s (default is 1h — too long), 6-digit codes, per-phone + per-IP SMS rate limits (SMS pumping cost control).
3. **Auth rate limits:** keep defaults on for sign-in attempts / OTP sends / verifications.
4. **Passwords:** minimum length ≥ 10; enable leaked-password protection (HIBP).
5. **Redirect URL allowlist:** only production/staging origins + `/update-password` (the reset flow passes `redirectTo`).
6. **Site URL** set to the production origin; JWT expiry 3600s and refresh-token rotation (defaults) left on.

## Deferred (documented, not M1-blocking)

- **Content-Security-Policy** — add once the app shell stabilizes (requires nonce plumbing for Next.js inline scripts).
- **App-level rate limiting on `/api/trpc`** — auth brute-force is already rate-limited at Supabase; revisit for business endpoints in M2+ (edge/WAF or middleware token bucket).
- Client-side minimum-length check on the update-password form (server enforces the Supabase minimum; this is UX polish).
