# Performance Review — M17 Step 6 (ADR-025 §6)

**Date:** 2026-07-12 · **Scope:** Prisma query layer (48 repositories), business services
(analytics-first), CSV export paths. **Constraint:** the only permitted change is *missing
indexes justified by the review, proven additive by `migrate diff`* (M17 constraint 2). Query
rewrites touch frozen M1–M16 domain logic and are **out of scope** — recorded here as follow-ups.

## Method

Static audit of every repository read/list/aggregate method, cross-referenced against the schema's
existing indexes; `EXPLAIN ANALYZE` on seeded local Postgres for the index candidates (empty tables
seq-scan regardless, so representative row counts were seeded). Index additivity proven by
`prisma migrate diff` (committed schema → edited schema) and the SQL executed on a scratch DB.

## Index coverage — already strong

The schema is meticulously indexed: every foreign key and hot filter/sort path across M1–M16 already
carries a rationale-commented `@@index`. The audit found only **two genuine gaps**, both the same
shape as an index that already exists elsewhere (`Document[schoolId, createdAt]`).

## Indexes added (justified, additive)

Migration `20260712080000_perf_indexes` — **two `CREATE INDEX`, zero ALTER** (proven):

| Index | Serves | Justification |
|---|---|---|
| `Invoice[schoolId, createdAt]` | fee-invoice list (`invoice.repository.ts:163`) | `where schoolId ORDER BY createdAt DESC` + `createdAt < before` keyset cursor — the default admin fee view; no existing index covered the sort. |
| `Payment[schoolId, createdAt]` | payment list (`payment.repository.ts:77`) | identical keyset shape (sort + cursor on `createdAt`). |

**`migrate diff` proof** (committed schema → edited schema):
```sql
CREATE INDEX "Invoice_schoolId_createdAt_idx" ON "Invoice"("schoolId", "createdAt");
CREATE INDEX "Payment_schoolId_createdAt_idx" ON "Payment"("schoolId", "createdAt");
```

**`EXPLAIN ANALYZE`** (seeded `Payment`, 5000 rows/school, `WHERE schoolId ORDER BY createdAt DESC LIMIT 20`):
- **Before:** `Seq Scan` on all rows → `top-N heapsort`.
- **After:** `Index Scan Backward using Payment_schoolId_createdAt_idx`, reads exactly 20 rows, no sort.

### Deviation from the audit's literal recommendation

The audit proposed `Payment[schoolId, paymentDate]` to enable a *future* SQL-groupBy rewrite of
`feeCollection`. That rewrite is **not** in M17 (frozen M14 logic), so a `paymentDate` index would be
**speculative** (YAGNI). The **current** payment query sorts and paginates on `createdAt`, so
`[schoolId, createdAt]` is the index the real query needs. Chosen accordingly.

## Query optimizations — RESOLVED (post-M17 hardening, 2026-07-14)

All six follow-ups below were implemented in the post-M17 security/perf hardening change,
result-preserving (the existing analytics/report-card test expectations were kept identical and
pass unchanged). New batch repo methods: `marks.listByEnrollments`,
`attendanceRecords.statusCountsByEnrollment`, `payments.monthlyTotals` (parameterized
`$queryRaw`, empirically verified on seeded local PG), `reportCards.listByEnrollments`. The
`Payment[schoolId, paymentDate]` index shipped **with** the `feeCollection` rewrite
(migration `20260714030000_perf_payment_paymentdate_index`), exactly as planned below.
Item 4 is subsumed: nothing calls `gpaForEnrollment` in a loop anymore — its remaining
single-call sites need the enrollment load as their security gate. Original findings:

1. **`atRiskStudents`** (`analytics.service.ts:509-520`) — ~3N+1 over the whole active-year cohort
   (per-enrollment attendance + GPA). Fix: one `attendanceRecord.groupBy([enrollmentId,status])` +
   one `marks … where enrollmentId in [...]`, reduced in JS. The `statusCounts` groupBy
   (`attendance-record.repository.ts:84`) already proves the pattern.
2. **`feeCollection`** (`analytics.service.ts:442-454`) — loads up to 100k `Payment` rows into JS to
   bucket by month. Fix: SQL `groupBy(date_trunc(paymentDate)) _sum(amount)` — the
   `invoice.aggregateForSchool` precedent. *(This is the query the audit's `paymentDate` index was
   for; add that index together with this rewrite, not before.)*
3. **`topPerformers`** (`analytics.service.ts:481-484`) — 2N+1; single `marks … in [...]` + in-JS
   `computeGpa`.
4. **`gpaForEnrollment` redundant `findById`** (`grade.service.ts:46`) — drop on the batch path;
   callers already hold the enrollment row.
5. **`classPerformance`** (`analytics.service.ts:343-348`) — bounded (~40/section) but same batch fix.
6. **`listReportCardsForSection`** (`report-card.service.ts:548`) — bounded (~40); one
   `reportCards.listByEnrollment({ enrollmentId: { in: [...] } })`.

## Audited clean

CSV exports (`components/analytics/csv.ts`, `dashboards.tsx`) export already-aggregated arrays
client-side — no export-time query. Fee invoice/payment UI lists are keyset-paginated. All
per-section / per-student / per-enrollment loops are naturally bounded. No other unindexed hot
filter/sort column found across the 48 repositories.
