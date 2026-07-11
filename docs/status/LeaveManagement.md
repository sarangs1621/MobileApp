# Status — Student Leave Management

- **Status:** Workflow implemented in M4 (frozen); M12 adds parent notification on decision — awaiting M12 approval.
- **Current milestone:** M12 (Student Discipline & Leave Management) — leave **notification** integration only.
- **Completion:** 100% of the M12 leave scope (notify-on-decide). The workflow itself was 100% in M4.
- **Spec / decision:** `docs/architecture/ADR-011-attendance-data-ownership.md` (workflow) ·
  `docs/architecture/ADR-020-discipline-and-leave.md` (M12 wrap) · `docs/milestones/M12.md` ·
  `docs/features/leave-management.md`
- **Model (frozen M4):** `LeaveRequest` (schoolId, enrollmentId, parentId, fromDate/toDate `@db.Date`, reason, status,
  decidedByStaffId?, decidedAt?; CHECK fromDate ≤ toDate; all FKs Restrict). Enum `LeaveStatus` (PENDING/APPROVED/
  REJECTED/CANCELLED). Keyed to Enrollment, never Student (ADR-011).
- **Workflow (frozen M4):** applyLeave (parent) · cancelLeave (parent, own PENDING) · decideLeave (`leave:decide` —
  admin/class-teacher) · listPendingLeaves (admin queue) · listLeaveByEnrollment (history). Approval writes **no**
  attendance — it only biases the marking default (ADR-011 §7).
- **M12 change:** the `leave.decide` router procedure is **repointed** `decideLeave → decideLeaveAndNotify` (canonical
  ADR-018 `*AndNotify` composer). It calls the **byte-identical frozen `decideLeave`** and, post-commit best-effort,
  notifies the requesting parent with `Notification(type=LEAVE, actionUrl=/attendance/leave)`. Only the router line
  changed; `leave.service.ts` and existing callers/tests untouched.
- **Surface:** business (frozen leave.service + M12 `emitLeaveDecided`/`decideLeaveAndNotify`) · `leave.*` router
  (frozen; `decide` delegates to the composer) · mobile `/attendance/leave` (parent apply + history; LEAVE deep-link) ·
  web `/attendance/leave` (admin approve/reject — now auto-notifies). Permissions `leave:apply/decide/read` — **frozen M4**.
- **Tests:** `emitLeaveDecided` unit-tested (M12 — LEAVE notification to the parent). M4 workflow covered by its frozen
  suite; `leave.decide` transport gates covered by attendance API tests. The `decideLeaveAndNotify` delegation is
  typecheck-covered (existing decide tests are pre-repo transport gates — codebase posture).
- **Frozen?** The M4 workflow stays frozen; M12 adds only the notification wrap (permission-only, additive).
- **Known limitations:** no leave attachment (deferred — overlaps out-of-scope medical documents; future `LeaveAttachment`
  table, no ALTER); no reviewer remark (deferred — ALTER-forbidden; decision already in AuditLog); no explicit "excused"
  attendance write (leave biases the marking default only); brief field-name divergences kept as M4 canonical (a second
  LeaveRequest/LeaveStatus is impossible + forbidden).
