# Status — Attendance

- **Status:** Not started
- **Current milestone:** later (after People) — attendance + push + absence job
- **Completion:** 0%
- **Dependencies:** Authentication (frozen), People (Students/Enrollment), Notifications
- **Frozen?** No
- **Known issues:** period-wise vs daily leave invariant to confirm (REVIEW_FINDINGS B2); `Attendance.period @default(0)` sentinel; `@db.Date`.
- **Next work:** its milestone — bulk mark (upsert on `[enrollmentId, date, period]`), auto %, absence push.
- **Spec:** Dev PRD v1.3 §8.4.
