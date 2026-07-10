# Status — Academic Structure

- **Status:** Implemented (M2 Steps 1–10 complete) — awaiting milestone approval
- **Current milestone:** M2 (Academic Foundation)
- **Completion:** 100% of M2 scope
- **Dependencies:** Authentication (frozen), M1.5 live Supabase (migrations applied)
- **Frozen?** No (freezes on M2 approval)
- **Known issues:** teacher referenced by user id in assignment forms (no people
  directory until M3); web lists paginate client-side over bounded full lists.
- **Next work:** M3 — people records (Student/Guardian/Staff), enrollment,
  teacher picker, year-scoped assignments if needed. (The class-teacher concept
  shipped in **M6.5** as the dedicated `ClassTeacherAssignment` model — NOT a
  `TeacherAssignment` flag; see `docs/status/ClassTeacher.md`, ADR-015.)
- **Spec:** M2 kickoff brief · `docs/features/academic-structure.md` · `docs/milestones/M2.md`.
