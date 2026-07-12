# ADR-022 — Analytics & Reporting — M14

**Status:** Accepted — **M14 implemented (Steps 1–9)** · **Date:** 2026-07-12 · design approved 2026-07-12 (no new permission — reuse domain reads + supersede flag-gated `analytics:view`; aggregate SQL in read-only repo methods; compute-on-read live with cached-summary as the deferred upgrade; at-risk = attendance < 75% OR GPA < 4, fee-overdue admin-only; Recharts web + hand-rolled mobile widgets; CSV client-side, no PDF) · **Deciders:** Architecture, Product
**Related:** ADR-002 (business layer is the authorization gate; routers thin — analytics adds **no** transport logic) ·
ADR-003 (repositories are the only place SQL/Prisma lives — analytics aggregation adds **read-only** repo methods, no writes) ·
ADR-007 (AuditLog — analytics are reads; **no** audit rows) ·
ADR-008 (loose `schoolId` — every aggregate is tenant-scoped) ·
ADR-010 (Enrollment is the mark/attendance/fee key — trends aggregate a student's enrollments) ·
ADR-011 (attendance %/working-day summary — **reuse `attendanceSummary`**) ·
ADR-012/ADR-014 (grade snapshots + `gpaForEnrollment` + `computeRank` — **reuse**; the cohort-aggregate precedent) ·
ADR-021 (fee `mapInvoice` OVERDUE compute-on-read — **reuse**) ·
PERMISSIONS_MATRIX (analytics introduces **no** permission; supersedes the flag-gated `analytics:view` row).
**Precedes:** M14 (Analytics & Reporting) — this ADR fixes the design; Steps 2–9 execute it.

---

> **Milestone framing.** M14 adds **role dashboards, charts, and CSV export** over frozen M1–M13. It is **purely
> additive and READ ONLY** — it computes over existing data and **mutates nothing**: no attendance, exam, report-card,
> homework, fee, announcement, or discipline write; **no new table, no schema change, no snapshot, no cron, no cache, no
> materialized view.** Every number is computed **live, on demand**. No AI/ML/prediction, no PDF, no email/push, no
> external BI (brief OUT OF SCOPE). To be proven at Step 2 by `prisma migrate diff` (**no diff**).

## Context

Analytics is the first **cross-cohort read** milestone. Everything it needs already exists:

- **Compute-on-read is the house style** — attendance % (`attendanceSummary`), GPA (`gpaForEnrollment`), report-card
  cohort rank (`computeRank`), and fee OVERDUE (`mapInvoice`) are all derived live today. M14 extends the same posture;
  it does **not** introduce the storage/scheduler infrastructure the brief forbids.
- **Reusable summaries exist** — `attendanceSummary` (`attendance/attendance.service.ts:297`), `gpaForEnrollment`
  (`exam/grade.service.ts:41`), `assembleSnapshot`/`computeRank` (`report-card/snapshot.ts`), fee `mapInvoice` OVERDUE
  derivation (`fee/mappers.ts`). M14 **reuses** these — it does not re-derive a metric that already has a function.
- **Scope is already solved** — `people/scope.ts` exports `accessibleStudentIds(ctx) → "ALL" | string[]`,
  `teacherSectionIds`, `parentChildIds`, `assertStudentInScope`, `isFullAccess`, `activeYearId`. Analytics routes **all**
  scoping through these — the same gate that governs raw reads governs the aggregate of those reads.
- **What does NOT exist:** repository-level aggregation. Repos have `.count()` wrappers only — **no `groupBy`, `_avg`,
  `_sum`.** The one cohort-aggregate precedent (`snapshot.ts`) aggregated **in-service over `list*` results** and left a
  `ponytail:` comment noting it recomputes O(cohort) and won't scale. §3 resolves this deliberately.
- **No chart library is installed** in either app (not even `react-native-svg`) — a genuine net-new dependency decision (§7).
- **Two `downloadCsv` utils already exist** (`attendance/ui.tsx:78`, `timetable/ui.tsx:151`) — M14 consolidates, does
  not add a third (§8).
- **Web dashboard is a placeholder** (`apps/web/app/(app)/dashboard/page.tsx` — role + nav links, no widgets) → the M14
  target. **Mobile home is already a real role-aware dashboard** (`apps/mobile/.../index.tsx`) → M14 adds summary
  widgets into the existing structure, it does not rebuild it.

## Decision

### 1. Zero schema, zero new permission, zero write

- **No new table, no column, no enum, no migration.** Analytics is computed from existing rows. Proven by `migrate diff`
  (no diff) at Step 2.
- **No new permission.** Analytics is aggregation of data the principal can **already read**, so each panel authorizes
  with its **existing domain read permission + existing scope** (the raw-read gate == the aggregate gate). This is the
  spec's stated preference and it makes over-exposure **structurally impossible** — a parent's attendance panel passes
  the identical `attendance:read + ownChild` gate as their raw attendance feed. The flag-gated, SA-only
  **`analytics:view`** row in the matrix is **superseded** (it predates teacher/parent dashboards and needs a
  feature-flag infra that does not exist — the same supersession M9/M10 applied to their planned rows).
- **`analytics:read` is deliberately NOT introduced.** Considered and rejected — a single analytics gate would either
  duplicate scoping the domain reads already do, or weaken it. Minimal fallback only if composite gating proves ugly in
  Step 3 (it won't): a thin "can hit analytics at all" gate with per-panel domain reads still doing the real scoping.
  Not added preemptively.

### 2. Scope — reuse the existing resolver

| Role | Analytics reach | Resolver (reuse `people/scope.ts`) |
|---|---|---|
| **Admin** (SA/OA) | whole school | `isFullAccess` / `accessibleStudentIds → "ALL"` |
| **Teacher** | own sections only | `teacherSectionIds` → `enrollments.studentIdsInSections(sectionIds, activeYear)` |
| **Parent** | own children only | `parentChildIds` |

No new scope predicate. Each analytics service composes a thin domain `scope.ts` over `people/scope.ts`, exactly as
M12/M13 (`behaviour/scope.ts`, `fee/scope.ts`) do.

### 3. Layering — aggregate SQL in repos, derivation in services (**the load-bearing decision**)

The brief says *"Business owns all aggregation logic … No SQL in services … No Prisma outside repositories"* **and**
*"Each service aggregates existing repositories only."* Those two lines admit two different milestones. This ADR chooses
explicitly:

- **Aggregate SQL (`groupBy` / `_avg` / `_sum` / `_count`) lives in NEW read-only repository methods.** These are
  in-bounds per ADR-003 (repositories own all data access; SQL belongs there) and additive (no table, no write). Example
  names: `mark.averageBySection(sectionIds, examId)`, `attendance-record.summaryBySection(sectionIds, range)`,
  `payment.sumByMonth(schoolId, yearId)`, `enrollment.countByYear(schoolId)`.
- **Business services own metric *derivation*** — percentages, trends, GPA, ranking, at-risk classification — composing
  repo aggregates and **reusing** the existing per-entity summaries (`attendanceSummary`, `gpaForEnrollment`,
  `mapInvoice`). **No SQL, no Prisma, no duplicated aggregation** in services.
- **Rejected reading — "aggregate in-JS over `list*` results, add no repo methods."** It re-implements in application
  code the GROUP BY the database already does (the "no duplicated logic" rule cuts against it), and it does not scale —
  a school-wide panel would pull every row into Node on every load. The `snapshot.ts` precedent already carries a
  `ponytail:` comment admitting exactly this limitation; M14 does not propagate it to school scale.

Routers stay thin: `validate (Zod) → protectedProcedure → delegate to service`. No aggregation in transport.

### 4. Scale ceiling + upgrade path (named, not silently accepted)

Compute-on-read + no cache + no materialized view means **school-wide panels** (monthly trends, exam statistics, top
performers, at-risk) run full DB aggregates on **every** dashboard load. For a single school this is fine — DB-side
`GROUP BY`/`AVG` over indexed, tenant-scoped rows is cheap. **The upgrade path, explicitly deferred:** if a school-wide
query gets slow, add a cached/materialized summary table behind the same service method — a swap invisible to routers and
UI. `ponytail:` this ceiling is named here so it is a decision, not a 3am surprise.

### 5. The metric catalogue — data source × gating permission (the core artifact)

Every metric in the brief, mapped to what computes it (reused where a function exists) and the **existing** permission +
scope that gates it. This **proves** the no-new-permission claim and **is** the Step-8 permission-matrix test spec.

**Student analytics** — parent (own child) / admin (any):

| Metric | Computes | Source (reuse / new read-only repo agg) | Gate |
|---|---|---|---|
| Attendance % | attended ÷ countable days | **`attendanceSummary`** (reuse) | `attendance:read` + ownChild |
| Homework completion | submitted ÷ assigned | `homework.listBySection` × `homework-submission.listByEnrollment` | `homework:read` + ownChild |
| Exam trend | % per exam over time | `mark.listPublishedByEnrollment` | `marks:read` + ownChild |
| Subject averages | avg % per subject | marks grouped by subject | `marks:read` + ownChild |
| Report-card GPA trend | GPA per published card | `report-card.listPublishedByEnrollment` + **`gpaForEnrollment`** (reuse) | `report_card:read` + ownChild |
| Fee status | dues / paid / overdue | `invoice.list` + **`mapInvoice`** OVERDUE (reuse) | `fee:read` + ownChild |
| Behaviour summary | counts by category/severity | `behaviour-incident.list` | `behaviour:read` + ownChild |

**Teacher analytics** — own sections:

| Metric | Computes | Source | Gate |
|---|---|---|---|
| Class averages | avg % per section | `mark.averageBySection` (new agg) | `marks:read` + ownSection |
| Attendance heatmap | attendance % per day × section | `attendance-record.summaryBySection` (new agg) | `attendance:read` + ownSection |
| Homework completion % | submitted ÷ assigned per section | homework × submissions | `homework:read` + ownSection |
| Exam performance | distribution per exam × section | marks grouped (new agg) | `marks:read` + ownSection |
| Behaviour counts | incidents per section | `behaviour-incident.list` grouped | `behaviour:read` + ownSection |

**Admin analytics** — school:

| Metric | Computes | Source | Gate |
|---|---|---|---|
| School overview | head-counts (students/sections) | `student` / `enrollment` counts | `student:read` + school |
| Attendance % (school) | school attendance % | `attendance-record` agg | `attendance:read` + school |
| Fee collection | collected vs due, over time | `payment.sumByMonth` / `invoice` agg (new) | `fee:read` + school |
| Exam statistics | pass %, distribution | marks grouped (new agg) | `marks:read` + school |
| Student growth | enrollments per year | `enrollment.countByYear` (new agg) | `student:read` + school |
| Top performers | top N by GPA | `gpaForEnrollment` + `computeRank` (reuse) | `marks:read` + school |
| At-risk students | see §6 | composite (attendance + academic) | `attendance:read` + `marks:read` + school |
| Monthly trends | attendance / collection by month | date-grouped aggregates (new) | respective domain read + school |

Every composite (top performers, at-risk) resolves under permissions the role **already** holds at the required scope —
verified: teacher holds `marks/attendance/behaviour/fee:read` at ownSection; parent holds all four at ownChild.

### 6. At-risk / top-performer heuristics (thresholds flagged for approval)

- **Top performers** — rank by `gpaForEnrollment` (reuse), take top N (default **N = 10**) per section (teacher) / school
  (admin).
- **At-risk** — a student flagged when **attendance % < 75** OR **latest exam average is a failing grade** (below the
  grade scale's pass band). **Fee-overdue is an admin-only additional signal** (teachers should not have a student's fee
  delinquency surfaced through an at-risk list even though `fee:read` permits it).
- **FLAGGED FOR YOUR APPROVAL:** the `75%` attendance cutoff, the pass-band definition of "failing", `N = 10`, and
  whether fee-overdue is included in the at-risk signal at all. These are product thresholds, not architecture.

### 7. Charts — one net-new web dep; mobile hand-rolled (flagged)

No chart library exists in either app.

- **Web:** add **Recharts** (the brief's named fallback; the mainstream React choice) — the **one** net-new dependency.
  Line / bar / pie / area, responsive only.
- **Mobile:** **no chart library in v1.** Not even `react-native-svg` is installed, so a chart lib
  (`victory-native`/`gifted-charts`) would drag in `react-native-svg` + native config for a first cut. Mobile v1 renders
  **simple bar/summary widgets with existing `View`/NativeWind** (the current stat-rendering norm) — numbers, progress
  bars, trend arrows. **FLAGGED:** if you want real mobile line/area charts now, say so and we add `react-native-svg` +
  `victory-native` at Step 6; default is the lazy hand-rolled version.

### 8. CSV export — reuse, no PDF

Consolidate the two existing dependency-free `downloadCsv` helpers into **one** shared util
(`apps/web/src/components/.../csv.ts`, Blob + anchor, quoted fields, CRLF) and reuse it for every export (attendance,
exam summaries, fee reports, behaviour, student/admin/teacher reports). **No PDF, no papaparse, no server-side CSV** —
client-side render from the same DTOs the dashboards use.

### 9. API surface — one thin `analytics` router

Mounted in `root.ts` as `analytics: analyticsRouter`. Procedures (all `protectedProcedure … .query`, thin transport):
`studentSummary`, `teacherSummary`, `schoolSummary`, `attendanceTrend`, `examTrend`, `feeCollection`,
`classPerformance`, `dashboard`. Inputs land in `packages/validation` as `xxxSummaryInput` / `xxxTrendInput`.

**`dashboard()` self-authorizes per panel.** With no single analytics permission, the composite gathers only the panels
the principal is entitled to — each panel calls its own domain-gated service; a panel the role can't read is simply
omitted, never errors. Authorization stays in business (ADR-002); the router only authenticates and delegates.

## Deviations from the literal brief (flagged for veto at STOP)

1. **New read-only aggregate methods are added to repositories** (§3) — a literal reading of "aggregates existing
   repositories only" could forbid this. Chosen because in-service JS aggregation duplicates the DB's GROUP BY and does
   not scale. Still additive + read-only; no schema, no write.
2. **Recharts is a net-new web dependency** (§7) — unavoidable; the brief names it as the fallback and no chart lib exists.
3. **Mobile ships hand-rolled widgets, not charts, in v1** (§7) — no `react-native-svg` present; a chart lib is a heavier
   add. Flagged; upgradable at Step 6 on request.
4. **`analytics:view` (flag-gated, SA-only) is superseded**, not activated (§1) — it can't serve teacher/parent
   dashboards and needs absent flag infra.
5. **At-risk excludes fee-overdue for teachers** (§6) — a deliberate narrowing below what `fee:read` would permit.

## Alternatives considered

1. **Aggregate in-service over `list*` reads, no new repo methods.** Rejected (§3) — duplicates DB aggregation, doesn't
   scale, propagates the `snapshot.ts` ceiling to school scope.
2. **Introduce `analytics:read`.** Rejected (§1) — reusing domain reads gives correct scoping for free; a single gate
   duplicates or weakens it.
3. **Snapshot/materialize dashboard numbers (nightly job / summary table).** Rejected — no scheduler infra, brief forbids
   it, compute-on-read is exact and free at single-school scale (§4 names the upgrade path if that changes).
4. **Add a mobile chart library now.** Rejected for v1 (§7) — heavier native footprint than a first cut needs; flagged
   for opt-in.
5. **Server-side CSV / a CSV library.** Rejected (§8) — two dependency-free client utils already exist; consolidate.

## Consequences

- (+) **Purely additive, read-only** — zero schema, zero new permission, zero write; every frozen M1–M13 table and
  service untouched (proven by `migrate diff` no-op at Step 2).
- (+) **Correct scoping for free** — the raw-read gate is the aggregate gate; over-exposure is structurally impossible.
- (+) **No duplicated logic** — reuses `attendanceSummary`/`gpaForEnrollment`/`computeRank`/`mapInvoice`; aggregation
  lives once, in repos.
- (+) **Thin, testable surface** — the §5 catalogue is the permission-matrix test spec; each metric is a pure function of
  scoped reads.
- (−) **School-wide panels compute live** (§4) — fine at single-school scale; cached summary is the named, deferred
  upgrade.
- (−) **One net-new web dep (Recharts)** and **mobile charts deferred to hand-rolled widgets** (§7) — both flagged.

## STOP — Step 1 boundary — ✅ APPROVED 2026-07-12

All six decisions approved as designed: **(a)** no new permission — domain-read reuse + `analytics:view` superseded;
**(b)** aggregate SQL in read-only repo methods, derivation in services; **(c)** the §5 catalogue + gates; **(d)** at-risk
= attendance < 75% OR GPA < 4, fee-overdue admin-only; **(e)** Recharts web + hand-rolled mobile widgets; **(f)** one
shared client CSV util, no PDF.

## Implementation notes (Steps 2–9, folded back)

- **3 read-only repo aggregates** (Prisma `aggregate`/`groupBy`, no raw SQL): `invoice.aggregateForSchool`,
  `enrollment.countByYear`/`listByYear`, `attendanceRecord.statusCounts`. Everything else reuses existing `list*` reads.
- **Business `services/analytics/`** — `studentSummary`/`examTrend`/`attendanceTrend` (student), `teacherSummary`/
  `classPerformance` (teacher), `schoolSummary`/`feeCollection`/`topPerformers`/`atRiskStudents` (admin), `dashboard`
  (role composite, self-authorizing). Reuses `attendanceSummary`/`gpaForEnrollment`/`mapInvoice`; scope via `people/scope`.
- **Zero schema change proven** — `schema.prisma` untouched; `migrate diff` is a no-op.
- **Thin `analytics` router** (10 query procedures) mounted at `analytics`; inputs `studentIdInput` (reused) +
  `sectionIdInput`/`feeCollectionInput`/`topPerformersInput`.
- **v1 simplifications accepted at each STOP** (deviations §list below, all flagged + approved): exam trend from
  published report-card GPA snapshots (not raw mark rollup); no "subject averages" / per-exam distribution; class
  performance = mean GPA + attendance (not distribution); attendance "heatmap" = monthly % series; admin school-wide
  **attendance-trend / exam-distribution time series not built** (no series aggregate — attendance is a KPI); admin charts
  = fee-collection bar + invoices-by-status pie; student-growth chart omitted (raw year-id labels); teacher pending-work /
  today's-timetable via quick links; status pie uses the validated light-mode hexes in both themes; the two legacy
  `downloadCsv` copies left in place (consolidation would touch frozen M9/M12 UI).
- **Gate green** — lint/typecheck 14/14, business 435 (incl. 3 analytics math tests), api 366 (incl. 7 analytics
  transport tests), web 9 (incl. CSV `toCsv` test), web build 38/38, mobile typecheck. **Recharts** is the one net-new
  web dependency.
