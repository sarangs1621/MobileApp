# ADR-009 — ReportCard.examId optional + partial unique index

**Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architecture, Product
**Related:** Dev PRD §6 (ReportCard), §8.5 · ADR-007 · supersedes the v1.2-draft "examId required" decision

## Context
A `ReportCard` links an enrollment to a generated PDF. A draft hardening made `examId` **required** so that `@@unique([enrollmentId, examId])` would be enforceable (a plain composite unique does not constrain rows where `examId` is `NULL`, because PostgreSQL treats `NULL`s as distinct).

That fix was rejected: making `examId` mandatory bakes a **product/UI assumption** ("every report card belongs to exactly one exam") into the schema. The PRD does not guarantee this, and plausible near-future needs break it: **annual consolidated cards, final academic reports, promotion reports, custom reporting periods, government/export formats**. A schema should model the domain, not today's workflow, and should not force a migration when a new report type appears.

So `examId` stays **nullable** — and we must choose how to enforce uniqueness for a nullable column.

## Decision
Keep `examId String?`. Enforce uniqueness for **exam-bound** cards with a **PostgreSQL partial unique index**, created in the migration (Prisma's `@@unique` cannot express a `WHERE` clause):

```sql
CREATE UNIQUE INDEX "ReportCard_enrollment_exam_key"
  ON "ReportCard" ("enrollmentId", "examId") WHERE "examId" IS NOT NULL;
```

- **Exam-bound cards (`examId` not null):** at most one per `(enrollment, exam)`; re-generation upserts that row.
- **Non-exam cards (`examId` null):** intentionally **not** constrained at the DB. Multiple report types may legitimately coexist for one enrollment. When a consolidated/period report feature is built, it adds its own discriminator (e.g. a `kind`/`periodLabel`) and its own uniqueness rule.
- The report-card **service also validates** before insert — defense in depth and a friendly error message — but the DB index is the race-free guarantee.

## Alternatives Considered

**1. PostgreSQL partial unique index — CHOSEN.**
- *Trade-offs:* Race-free, DB-enforced, and **self-documenting** — the `WHERE examId IS NOT NULL` states the exact domain rule ("unique when present"). Leaves the NULL space open for future report types with no migration. Costs one line of raw SQL in the migration (not expressible in the Prisma DSL), so the constraint lives in the migration + a schema comment rather than `@@unique`. We already use this same pattern for `GuardianStudent` (one primary per student), so it is a consistent idiom, not a one-off.
- *Note:* A plain `@@unique([enrollmentId, examId])` is **behaviorally equivalent** for enforcement (Postgres ignores NULLs), but it indexes NULL rows and, more importantly, **reads as if it constrains all cards** — hiding the deliberate NULL exemption. The partial index is preferred for explicitness and intent, at the cost of a little raw SQL.

**2. Business-layer validation only.**
- *Trade-offs:* Most flexible and gives great error messages, but it is **racy** — two concurrent generations can both pass the "does one exist?" check and then both insert, creating duplicates. A unique guarantee must live in the database. Kept as a **complement**, never the sole mechanism.

**3. Alternative schema — add a discriminator now** (e.g. `kind`/`periodLabel` + `@@unique([enrollmentId, kind, examId])`).
- *Trade-offs:* This is the right design **once non-exam report types actually exist**, because it lets us enforce uniqueness among them too. But adding it now is **premature (YAGNI)** — it invents columns and rules for unbuilt features and would itself need revisiting when those features land. Not demonstrably superior today; recorded here as the clean extension point.

## Consequences
- (+) Current functionality preserved: exactly one card per student per exam, race-free.
- (+) Future consolidated/annual/promotion/custom report cards are supported with **no database migration** — `examId` is already nullable and the NULL space is unconstrained.
- (+) Schema models the domain, not the UI; consistent partial-index idiom with `GuardianStudent`.
- (−) The constraint is migration-managed raw SQL + a schema comment, not a Prisma `@@unique` (slightly less visible in `schema.prisma`; mitigated by the inline comment).
- (−) Uniqueness among future non-exam report types is **not** enforced until that feature adds its discriminator — acceptable, since those types don't exist yet and the partial index doesn't pretend to cover them.
