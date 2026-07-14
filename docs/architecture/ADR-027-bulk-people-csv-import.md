# ADR-027 — Bulk People Import from CSV

**Status:** Accepted — **implemented** · **Date:** 2026-07-14 · **Deciders:** Architecture, Product
**Related:** ADR-002 (business layer is the authorization gate — the import asserts `student:manage` + `parent:manage` up front, then routes every row through the existing gated services) ·
ADR-007 (audit-in-transaction — each created student/parent/link writes its own audit row because the import **reuses** `createStudent`/`createParent`/`linkParent` verbatim) ·
ADR-010 (Student is identity-only — the import creates identities; enrollment/placement stays a separate `enrollment.enroll` flow, exactly like the manual UI).
**Supersedes (scope):** PRD §8.2's "CSV/Excel import with column mapping and `ImportJob` record" — see Deviations.

---

> **Framing.** This is a **batching wrapper** over three frozen M3 services, not a new engine. It adds no schema, no
> migration, no permission, no lifecycle state. One new service function parses a CSV and calls
> `createStudent` / `createParent` / `linkParent` per row, collecting per-row failures into a report.

## Context

PRD §8.2 requires bulk import of students and guardians with validation, a downloadable error report, and partial
success. The M3 people services already enforce every invariant that matters (unique admission number, unique Aadhaar,
guardian link conflicts, at-most-one-primary, audit-in-transaction). The only missing piece was a way to drive them
from a spreadsheet instead of one form at a time.

## Decision

1. **Reuse the M3 services per row — no direct repo writes.** Every row goes through the same permission → conflict →
   transaction → audit chain as the manual UI. A row failure (validation or service `ConflictError`) lands in the
   error report with its 1-based CSV line number; remaining rows continue (partial success by design).

2. **Synchronous mutation, no `ImportJob` table.** A school roster is thousands of rows at most; the import completes
   inside one request. The "error report" is the mutation's return value (`ImportReportDto`); the web UI renders it
   and offers it as a client-generated CSV download. <!-- ponytail: add an ImportJob table + async worker only if a
   real school's file ever times out the request. -->

3. **CSV only, fixed headers, no column-mapping UI.** The students page serves a template CSV whose headers are the
   contract (`IMPORT_COLUMNS`). Excel users export to CSV. A tiny RFC-4180 parser (quotes, escaped quotes, CRLF)
   lives in the service — no new dependency.

4. **One row = one student + at most one guardian.** Guardian columns are optional as a group. **Guardians dedupe by
   phone number within the school** (one upfront `parents.list`, matched in memory) so re-imports reuse rather than
   duplicate. Repeating an admission number **within the file** attaches additional guardians to the same student;
   an admission number **already in the DB** is a row error, never a silent merge — a typo must not attach a stranger
   to an existing child.

5. **Row atomicity is per service call, not per row.** If a student is created and its guardian link then fails, the
   student stands and the row's error says what failed. This mirrors the manual flow (create, then link) and avoids
   re-implementing the services' transactions.

6. **Permissions:** `student:manage` + `parent:manage` (both asserted before any work) — the exact set the row
   operations need; no new permission. Web-primary (PRD §roles): the UI is a dialog on the web Students page; no
   mobile surface.

## Deviations from PRD §8.2

- **Excel** import: dropped — CSV template covers it (export-to-CSV is one click in Excel/Sheets).
- **Column mapping** UI: dropped — fixed template headers instead.
- **`ImportJob` record**: dropped — synchronous report returned to the caller; per-entity audit rows already record
  what was created and by whom.

## Consequences

- The import can never bypass or drift from business rules — it has no rules of its own.
- N rows cost ~3N queries (conflict checks + creates). Fine at roster scale; batching would require duplicating
  service logic and was rejected.
- `IMPORT_COLUMNS` (business) and the web template constant must stay in sync — both cite each other.
