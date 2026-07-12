# Status — Analytics & Reporting (M14)

**State:** ✅ Steps 1–9 complete — awaiting milestone approval. **ADR-022** (Accepted). Purely additive, read-only.

## Shipped

- **DB**: 3 read-only aggregates (`invoice.aggregateForSchool`, `enrollment.countByYear`/`listByYear`,
  `attendanceRecord.statusCounts`). Zero schema change (`migrate diff` no-op).
- **Business**: `services/analytics/*` (10 fns) — reuses `attendanceSummary`/`gpaForEnrollment`/`mapInvoice`; scope via
  `people/scope`; no new permission.
- **API**: `analytics.*` (10 thin query procedures).
- **Mobile**: role-aware "At a glance" overview + recent announcements in the home screen.
- **Web**: real role dashboards (Admin/Teacher/Parent) with Recharts + CSV export.

## Verification

- Gate green: lint 14/14, typecheck 14/14, test (business 435, api 366, web 9, validation 64), web build 38/38, mobile
  typecheck.
- Tests: business 3 (at-risk classification, attendance weighting, fee bucketing), api 7 (transport permission matrix),
  web 2 (CSV `toCsv`).
- **Not runtime-verified visually** — the web dashboard + mobile screens need the app running with real Supabase
  secrets/DB (unavailable in the build environment). Types, lint, and production build are green.

## Known limitations (v1)

School-wide attendance-trend/exam-distribution series, subject averages, per-exam distribution, daily heatmap,
student-growth chart, and mobile charts are deferred (ADR-022 §deviations). Top/at-risk are O(active-year enrollments)
live — cached summary is the deferred upgrade if a school outgrows it.
