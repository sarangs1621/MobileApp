# Session Workflow (context-minimal)

Follow this every session to keep context (token) usage low.

```
1. Read docs/project_memory.md         (current milestone, step, frozen modules, blockers, next task)
2. Read .claude/current_milestone.md   (scope / out-of-scope / deliverables / stop conditions)
3. Read .claude/project_rules.md        (architecture + dependency + coding rules)  ← already condensed
4. Read docs/milestones/<M?>.md + docs/features/<feature>.md + docs/status/<Module>.md  (only the ones in play)
5. Inspect ONLY the files the current step affects
6. Implement the current step only
7. Validate: pnpm typecheck · lint · test · db:validate · build (Node 24 on PATH)
8. Update docs/project_memory.md (+ the relevant status/milestone file)
9. Stop and wait for approval
```

## Do
- Prefer the summaries above over re-reading `School_Portal_DEV_PRD.md`. Open the PRD only for a specific spec a task needs, and read just that section.
- Inspect files by the module you're touching; use `docs/status/*` to see what's frozen/done before opening code.
- Keep each doc short; update `project_memory.md` the moment a step completes.

## Don't
- Don't re-read the entire PRD or unrelated modules.
- Don't modify **frozen modules** (see `project_memory.md`) except for a critical bug, a security fix, or explicit user approval.
- Don't refactor completed/approved code or change architecture while implementing a step.
- Don't start the next milestone/step without approval.

## Freeze protocol
When a module/milestone is completed and approved:
1. Mark it **FROZEN** in `docs/project_memory.md` and its `docs/status/<Module>.md`.
2. Treat it as read-only thereafter.
3. Any later change to a frozen module requires: (critical bug **or** security issue **or** explicit user approval) → note the reason in the status file.

## Environment
Node 24 LTS via nvm: `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"`. pnpm 9. Web build/typecheck use `SKIP_ENV_VALIDATION=true` (real env only at runtime).
