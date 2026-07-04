# Current Milestone

**M1 — Authentication & User Profiles**

## Current Step

**Step 9 — Security Review** (Steps 1–8 complete; Steps 10–11 pending).

## Scope (M1)

Authentication · Authorization · User Profiles · Session management.
Roles: SUPER_ADMIN, OFFICE_ADMIN, TEACHER, PARENT, ACCOUNTANT (students don't log in; class-teacher is an assignment, not a role).

## Out of scope

Students, attendance, classes, exams, homework, fees, notifications delivery, and any CRUD for school entities — those are M2+.

## Deliverables (remaining)

- Step 9 — Security review (JWT, storage, cookies, session expiry/refresh, brute-force/rate-limit, CSRF, sensitive logging, Supabase config).
- Step 10 — Tests (auth/authz/permission/route-protection/session/edge cases).
- Step 11 — Documentation (API, auth architecture; ADRs only if a new decision).

## Stop conditions

Complete only the current step, validate, update `docs/project_memory.md`, then **stop and wait for approval**. Do not begin M2.

## Milestone-level blockers

Provisioning (Supabase Admin API) + seed + SMS provider pending before real sign-in/OTP.
Source of truth: **Dev PRD v1.3**.
