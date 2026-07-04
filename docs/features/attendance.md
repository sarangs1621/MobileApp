# Feature — Attendance (not yet implemented)

Spec: Dev PRD v1.3 §8.4. Status: `docs/status/Attendance.md`.

Key rules (when built): bulk "mark all present → flip absentees"; statuses Present/Absent/Half-day/Leave/Holiday; upsert on `[enrollmentId, date, period]` (`period 0` = whole-day sentinel); dates `@db.Date` (IST); auto daily/monthly/term %; absence push via scheduled job. Confirm daily vs period-wise + the leave×period invariant (REVIEW_FINDINGS B2).
