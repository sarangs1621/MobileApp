# START HERE — Session Router

The **only** file to reference manually at the start of a Claude Code session.
This is a routing document, not documentation. Load exactly what it points to — nothing more.

## 1. Always load (these 3 files, nothing else)

| File | What it gives you |
|---|---|
| `docs/project_memory.md` | Current milestone/step, frozen modules, blockers, next task |
| `.claude/current_milestone.md` | Scope, out-of-scope, deliverables, stop conditions |
| `.claude/project_rules.md` | Architecture + dependency + coding rules (ADRs already condensed) |

## 2. Load only if the current task needs it

| Task touches… | Load |
|---|---|
| Authentication | `docs/features/authentication.md` + `docs/status/Authentication.md` |
| Attendance | `docs/features/attendance.md` + `docs/status/Attendance.md` |
| Students | `docs/features/students.md` + `docs/status/Students.md` |
| Homework | `docs/features/homework.md` + `docs/status/Homework.md` |
| Fees | `docs/features/fees.md` + `docs/status/Fees.md` |
| Exams / report cards | `docs/status/Exams.md` |
| Notifications | `docs/status/Notifications.md` |
| An architectural decision | `docs/architecture_index.md` → open **only** the ADRs it lists for the feature |
| Current milestone detail | `docs/milestones/<current M>.md` only |
| A specific PRD spec | That **section only** of `School_Portal_DEV_PRD.md` — never the whole file |
| Schema / migrations | `docs/DATABASE_CONVENTIONS.md` (+ `docs/DB_RELATIONSHIP_DIAGRAM.md` if relations change) |
| New API endpoints | `docs/API_CONVENTIONS.md` (+ `docs/API_INVENTORY.md` to check for existing ones) |
| New screens / UI | `docs/UI_DESIGN_SYSTEM.md`, `docs/SCREEN_INVENTORY.md`, `docs/NAVIGATION_MAP.md` — only the ones relevant |
| Roles / permissions questions | `docs/PERMISSIONS_MATRIX.md` |
| Finishing a step | `docs/DEFINITION_OF_DONE.md` |

Never load feature docs, status docs, or ADRs unrelated to the current task.

## 3. Never reread unless explicitly necessary

- The full PRD (`School_Portal_DEV_PRD.md`, `School_Portal_PRD_v2.md`) — summaries above replace it
- Completed milestone docs (`docs/milestones/*` for finished milestones)
- **Frozen module source code** (list in `docs/project_memory.md`) — read-only; open only for a critical bug, a security fix, a directly affected dependency, or explicit request
- Unrelated feature/status docs
- `docs/REVIEW_FINDINGS.md`, `docs/ANALYTICS_LOGGING_PLAN.md`, inventories/plans not tied to the task
- ADRs not listed for the current feature in `docs/architecture_index.md`

## 4. Source code

Inspect **only** files directly affected by the current task plus their immediate dependencies. Never sweep the repository. Full search + token policies: `.claude/workflow.md`.
