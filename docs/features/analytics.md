# Analytics & Reporting (M14, ADR-022)

Read-only, computed-on-demand analytics over frozen M1–M13 — role dashboards, charts, and CSV export. No schema, no new
permission, no stored/scheduled/cached aggregates.

## Model

- **Authorization = the domain read it aggregates.** Each metric authorizes with its existing domain permission + scope
  (`attendance:read`/`marks:read`/`fee:read`/`report_card:read`/`behaviour:read`/`student:read`). School-wide panels are
  admin-only. No `analytics:read`; the legacy flag-gated `analytics:view` is superseded.
- **Layering (ADR-002/003).** Aggregate SQL (`aggregate`/`groupBy`) lives in **read-only repository methods**; business
  services derive the metrics (%, GPA, trend, at-risk) and **reuse** `attendanceSummary`, `gpaForEnrollment`, `mapInvoice`
  — no duplicated aggregation, no Prisma/SQL in services. Routers are thin.
- **Compute-on-read.** Every number is live; single-school scale is cheap over indexed, tenant-scoped rows. Upgrade path
  if a school-wide panel slows: a cached/materialized summary behind the same service method (deferred).

## Surface

| Procedure (`analytics.*`) | Role | Returns |
|---|---|---|
| `studentSummary({studentId})` | parent/admin | attendance %, GPA, homework completion, dues+overdue, behaviour counts |
| `attendanceTrend({studentId})` | parent/admin | monthly attendance % series |
| `examTrend({studentId})` | parent/admin | published report-card GPA/CGPA series |
| `teacherSummary()` | teacher | per-section attendance % + referral count |
| `classPerformance({sectionId})` | teacher/admin | section mean GPA + attendance % |
| `schoolSummary()` | admin | headcount, attendance %, collection today, fee totals, student growth |
| `feeCollection({academicYearId?})` | admin | billed/collected/outstanding + monthly collected series |
| `topPerformers({limit?})` / `atRiskStudents()` | admin | GPA leaderboard / at-risk (attendance < 75% OR GPA < 4) |
| `dashboard()` | any | role composite — only the panels the caller is entitled to (self-authorizing) |

## UI

- **Web** (`/(app)/dashboard`): role KPIs + Recharts (area/line/bar/pie, responsive + theme-aware) + per-panel CSV
  export + quick links. Charts use one theme hue for single series and a validated categorical palette for the fee-status
  pie (legend so identity is never colour-alone).
- **Mobile** (`(app)/index.tsx`): an "At a glance" overview (parent per-child cards / teacher section bars / admin KPIs)
  + recent announcements, hand-rolled with `StatTile`/`PercentBar` (no chart lib in v1).
- **CSV**: one shared client-side `downloadCsv` (RFC-4180, CRLF); no PDF, no server round-trip.

## Not built (v1)

Subject averages · per-exam distribution · true daily heatmap · school-wide attendance-trend/exam-distribution series ·
student-growth chart (raw year-id labels) · mobile charts · AI/prediction · PDF. See ADR-022 §deviations.
