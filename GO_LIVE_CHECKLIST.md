# 🚀 Production Go-Live Checklist — School Portal

Work top to bottom. Each section is a gate: don't start the next until the current one's checkboxes are all ticked. Paste real credentials into `.env` (copy from `env.production.template`) as you collect them, and record human logins in `LOGIN.local.md` (gitignored) — **never** commit real secrets.

**Legend:** 🔴 hard blocker (app won't work without it) · 🟡 required before production · 🟢 optional/recommended

---

## Phase 0 — Start the slow paperwork NOW (do this first)

- [ ] 🔴 **Begin TRAI DLT registration** (India SMS). This gates parent OTP login and takes days. Register your entity + sender ID + message templates with a DLT operator. Everything else can proceed in parallel while this processes.

---

## Phase 1 — Create accounts & collect credentials

### 1a. Supabase (production project) — 🔴 required
- [ ] Create a project at supabase.com (region: `ap-south-1` or `ap-southeast-1`).
- [ ] Collect and paste into `.env`:
  - [ ] Project URL → `NEXT_PUBLIC_SUPABASE_URL` **and** `EXPO_PUBLIC_SUPABASE_URL` = `________________`
  - [ ] anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` **and** `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `________________`
  - [ ] service_role key → `SUPABASE_SERVICE_ROLE` (server-only!) = `________________`
  - [ ] DB connection string (session pooler, **port 5432**, URL-encode `#`→`%23`) → `DATABASE_URL` = `________________`
- [ ] Generate a **Management API personal access token** (account → tokens) for the scripted auth config in Phase 3. Revoke it after. = `________________`

### 1b. Twilio (SMS for parent OTP) — 🔴 required
- [ ] Create a Twilio account + a Messaging Service. Collect:
  - [ ] Account SID (`ACxxxx…`) = `________________`
  - [ ] Auth Token = `________________`
  - [ ] Messaging Service SID (`MGxxxx…`) = `________________`
- [ ] Link your DLT-approved sender/templates (from Phase 0) to the Messaging Service.
- [ ] *(Alternative: MSG91 or Gupshup — often simpler for Indian DLT. If used, note their API keys instead.)*

### 1c. Web hosting — 🔴 required
- [ ] Provision a host with **Docker + Docker Compose** (any cloud VPS/container platform).
- [ ] Register/point a **domain** at it. Your web URL = `________________`
- [ ] Set `EXPO_PUBLIC_API_URL` in `.env` to that domain (`https://…`).

### 1d. Expo / EAS — 🔴 required to ship the mobile app
- [ ] Create an Expo account, run `eas init` in `apps/mobile`.
- [ ] EAS project id → set in `apps/mobile/app.json` → `extra.eas.projectId` = `________________`
- [ ] *(Optional)* `EXPO_ACCESS_TOKEN` if you enable Expo push security = `________________`

### 1e. App store accounts — 🟡 required to distribute
- [ ] Apple Developer Program ($99/yr) — for App Store / TestFlight.
- [ ] Google Play Developer ($25 one-time) — for Play Store / internal testing.

### 1f. Email (SMTP) — 🟡 required before production
- [ ] Create a Resend (or other SMTP) account → `RESEND_API_KEY` = `________________`
      (Supabase's built-in email has a tiny cap — not for production.)

### 1g. Monitoring — 🟢 recommended
- [ ] Sentry → `SENTRY_DSN` = `________________`
- [ ] PostHog → `POSTHOG_KEY` = `________________`

> ℹ️ **Payments (Razorpay) — skip.** Fees are read-only in v1; no in-app payment.

---

## Phase 2 — Fill the environment file

- [ ] `cp env.production.template .env` at the repo root.
- [ ] Fill every **REQUIRED** value from Phase 1.
- [ ] Set `APP_ENV=production`, `EXPO_PUBLIC_APP_ENV=production`, `PUSH_NOTIFICATIONS_ENABLED=true`.
- [ ] Set `SEED_SCHOOL_NAME`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD` (≥10 chars).
- [ ] Confirm `SKIP_ENV_VALIDATION` is **NOT** set (you want fail-fast validation in prod).

---

## Phase 3 — Configure Supabase

Follow `docs/RUNBOOK_SUPABASE_SETUP.md §2` (scriptable via the Management API token, or do it in the dashboard).

- [ ] 🔴 **Allow new sign-ups → OFF** (accounts are Admin-API provisioned only).
- [ ] 🔴 **Phone provider → ON**, SMS provider = **Twilio** with the SID/Token/Messaging-Service-SID from 1b.
- [ ] 🔴 **Test OTP number**: `TEST_OTP_PHONE` → `TEST_OTP_CODE` (matches your `.env`, so `verify:auth` passes).
- [ ] OTP expiry ≤ **600 s**, 6-digit codes.
- [ ] Auth **rate limits** ON (defaults).
- [ ] Password **min length ≥ 10** (+ leaked-password/HIBP if on Pro plan).
- [ ] **Site URL** = your real domain; **Redirect allowlist** = real origins + `/update-password`.
- [ ] Configure **custom SMTP** (Resend) for auth emails.
- [ ] Create **4 private storage buckets** (Public **OFF** on all):
  - [ ] `student-documents`
  - [ ] `homework-files`
  - [ ] `documents`
  - [ ] `branding`
- [ ] Revoke the Management API token when done.

---

## Phase 4 — Deploy the backend/web + provision real data

Run from the repo root (host has the filled `.env`):

- [ ] Apply schema: `pnpm --filter @repo/db exec dotenv -e ../../.env -- prisma migrate deploy`
- [ ] Bootstrap school + super-admin: `pnpm --filter @repo/business run bootstrap`
- [ ] 🔴 **Live auth verification (all must PASS):** `pnpm --filter @repo/business run verify:auth`
- [ ] Deploy the web container: `scripts/deploy.sh` (migrate → build → `docker-compose.prod.yml up`)
- [ ] Health checks: `GET /api/health` → 200, `GET /api/ready` → 200 (DB + storage reachable).
- [ ] Provision real staff/parents as needed:
  - `pnpm --filter @repo/business run provision -- --role TEACHER --email … --password …`
  - `pnpm --filter @repo/business run provision -- --role PARENT --phone +91… --locale ml`

---

## Phase 5 — Remove QA seed/bypass (before real data goes live)

- [ ] 🔴 Wipe the throwaway QA seed + parent login bypass:
  ```bash
  SEED_WIPE_CONFIRM=yes pnpm --filter @repo/db seed:teardown
  ```
  ⚠️ Destructive — TRUNCATEs all tables + deletes seeded auth users. Only run against the intended DB.

---

## Phase 6 — Build & ship the mobile app

- [ ] Confirm `apps/mobile/app.json` → `extra.eas.projectId` is set (Phase 1d).
- [ ] Confirm `apps/mobile/.env` (or EAS secrets) has the 4 `EXPO_PUBLIC_*` values pointing at production.
- [ ] `eas build` for **iOS** and **Android**.
- [ ] Submit to TestFlight / Play internal testing, then to the stores.

---

## Phase 7 — Final production verification (on real devices)

- [ ] 🔴 **Real parent phone-OTP login works end-to-end** (a real number receives the SMS and signs in). This is the flow that has never been exercised for real — budget time for it to fail once.
- [ ] Staff email/password login works (web + mobile).
- [ ] Push notification arrives on a device with the app closed (publish an announcement to test).
- [ ] Storage round-trips: upload a student document, homework file, certificate, and school logo — each opens via signed URL; a non-linked parent is correctly Forbidden.
- [ ] Auth emails (password reset) actually arrive via Resend.
- [ ] Offline attendance queue syncs on reconnect (mobile).
- [ ] `/api/ready` stays 200 under real load.

---

## Phase 8 — Soft-launch / Pilot (validate with real users before full rollout)

Don't roll out to the whole school on day one. Run a small, controlled pilot first — this is how "should work" becomes "does work." Keep the QA seed **already wiped** (Phase 5); this uses real accounts and real data.

### 8a. Pick a minimal pilot cohort
- [ ] **1 class/section** (e.g. one Grade 1 section) as the pilot scope.
- [ ] **1–2 teachers** for that class (real staff accounts, provisioned in Phase 4).
- [ ] **3–5 real parents** from that class (real phone numbers — this is the true OTP test).
- [ ] **1 admin + 1 accountant** (yourself/office staff).
- [ ] Agree a **1–2 week** pilot window and a simple way for them to report issues (a WhatsApp group or the bug-log table from `QA_E2E_HANDOFF.md`).

### 8b. Exercise the real daily loop (each at least once)
- [ ] Teacher marks **attendance** for the pilot class on a real day → parents see it.
- [ ] Teacher sets **homework** → parents see it → a parent submits a file.
- [ ] Teacher enters **exam marks** → report card generates → parent views it.
- [ ] Accountant generates a real **fee invoice** → records a payment → receipt prints; parent sees the balance.
- [ ] Admin posts an **announcement** → confirm the **push notification** lands on parents' phones (app closed).
- [ ] Teacher ↔ parent **message** round-trip.
- [ ] A parent applies for **leave** / requests an attendance correction → admin approves.
- [ ] Confirm each parent sees **only their own child's** data (privacy check with real accounts).

### 8c. Watch the operational signals during the pilot
- [ ] **OTP delivery rate** — are real parents actually receiving the SMS reliably? (DLT/Twilio issues surface here.)
- [ ] **Errors** — Sentry (if wired) shows no recurring exceptions; `/api/ready` stays 200.
- [ ] **Push delivery** — notifications arrive within seconds, not minutes/never.
- [ ] **Performance** — screens load acceptably on a mid-range phone on mobile data (not just office Wi-Fi).
- [ ] **Offline** — mark attendance with the phone in airplane mode → reconnect → it syncs.
- [ ] Collect pilot feedback; triage any bugs; fix + redeploy.

### 8d. Backups & recovery (before you depend on real data)
- [ ] Confirm Supabase **automated backups** are on (see `docs/BACKUP.md`).
- [ ] Do one **test restore / `pg_dump`** so you know recovery works *before* you need it.

### 8e. Go/no-go for full rollout
- [ ] All 8b flows worked with real users.
- [ ] No unresolved 🔴 issues from the pilot.
- [ ] OTP + push delivery proven reliable for real numbers/devices.
- [ ] Backup + restore verified.
- [ ] ✅ **Only then** provision the rest of the school (all classes, teachers, parents) and announce general availability.

---

### The critical path
**DLT registration (Phase 0) → Supabase + Twilio wired (1a/1b/3) → real parent OTP verified (7).** Everything else is code that's already done; these are account setup + credential paste + one dashboard pass.
