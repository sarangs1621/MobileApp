# Definition of Done — School Management Portal

A feature, fix, or milestone item is **Done** only when **every** item below is satisfied and verifiable. "Works on my machine" is not Done. This is the gate for merge and for milestone sign-off (Dev PRD §12, §13).

> Rule of evidence: each box is checked against an artifact (a passing test, a screenshot, a CI run, a migration, a doc diff) — never against intent.

## Universal checklist (every change)

- [ ] **Requirements complete** — implements exactly the PRD scope for the item; no invented features, no removed features; any `[CONFIRM]` it depends on is answered (or the item is explicitly deferred).
- [ ] **Database reviewed** — schema changes have explicit relations, unique constraints, indexes for the query paths used, and deliberate `onDelete`; a reviewed Prisma migration exists; `prisma validate` passes; no edits to applied migrations.
- [ ] **Security reviewed** — authorization enforced in tRPC (coarse) **and** business service (scope); add-on endpoints gate on their feature flag; Supabase RLS in place for any Storage/direct-access path touched; no secrets client-side; uploads validate MIME + size.
- [ ] **Validation complete** — all external input validated with a shared Zod schema (`packages/validation`); no trust of client input; error cases return typed, localized errors.
- [ ] **Tests passing** — unit (incl. `packages/core` domain logic), integration on key tRPC procedures, plus **edge-case, validation, and authorization** tests; deterministic; all green in CI. Sensitive mutations have a test asserting the `AuditLog` row is written.
- [ ] **Documentation updated** — architecture/API/database docs and ADRs updated where affected; migration notes written; README updated if developer setup changed.
- [ ] **Accessibility checked** — labels/roles/focus order, large tap targets, sufficient contrast; verified on web and mobile where the feature appears.
- [ ] **Performance reviewed** — no N+1 queries (repository checked); lists virtualized; optimistic UI where the PRD calls for instant feel (e.g. attendance); PDFs/heavy work off the request path or within budget.
- [ ] **No TypeScript errors** — strict typecheck passes; **no `any`**, no `@ts-ignore`.
- [ ] **No ESLint errors** — lint passes; no `eslint-disable` without a `// reason:` and reviewer sign-off.

## Cross-cutting requirements (where applicable)

- [ ] **Bilingual** — all user-facing strings in `en` + `ml`; no hardcoded copy; Malayalam rendering verified on the surfaces touched.
- [ ] **Audit** — marks, attendance edits, role/user changes, enrollment/promotion, and payments write an `AuditLog` row in the same transaction (ADR-007).
- [ ] **IST correctness** — calendar-date fields (attendance/exam dates) are correct in IST; UTC off-by-one guarded.
- [ ] **Web + app parity** — the feature works on **both** web and mobile where the PRD says it should; teacher daily flows are fully mobile-capable.
- [ ] **Notifications via the abstraction** — any user notification goes through `NotificationService`, never a provider SDK (ADR-005).

## Milestone-level Done (in addition to the above for every item)

- [ ] All milestone deliverables in Dev PRD §13 met and demoed on **staging**.
- [ ] CI pipeline green end-to-end: lint → typecheck → test → `prisma validate` → `prisma migrate deploy` → build/deploy.
- [ ] Seed/runbook updated; backups and monitoring (Sentry/PostHog) confirmed for new surfaces.
- [ ] Open questions blocking the **next** milestone are flagged to the client.
