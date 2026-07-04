# Session Workflow (context-minimal)

Every session follows exactly this sequence. Do not deviate.

```
 1. Read .claude/START_HERE.md          (the router — tells you what else to load)
 2. Read docs/project_memory.md         (milestone, step, frozen modules, blockers, next task)
 3. Read .claude/current_milestone.md   (scope / out-of-scope / deliverables / stop conditions)
 4. Read .claude/project_rules.md       (architecture + dependency + coding rules — condensed)
 5. Read ONLY the relevant feature summary (docs/features/* + docs/status/* for the feature in play)
 6. Read ONLY the required ADRs         (locate them via docs/architecture_index.md)
 7. Inspect ONLY the files affected by the current task + immediate dependencies
 8. Implement ONLY the requested step
 9. Validate: pnpm typecheck · lint · test · db:validate · build   (Node 24 on PATH)
10. Update docs/project_memory.md (+ the relevant status/milestone file)
11. Stop and wait for approval
```

## Repository search policy (strict)

Never search the entire repository first. Search in this order, stopping at the first hit:

1. The current feature's folder (app route / package module being worked on)
2. The shared package the feature uses (`packages/*` it imports from)
3. The direct dependency of that package
4. Repository-wide search **only if** steps 1–3 fail

## Frozen module policy (strict)

Frozen modules (listed in `docs/project_memory.md`) are **read-only**. Never inspect or open them unless:

- explicitly requested by the user, or
- fixing a critical bug, or
- fixing a security issue, or
- modifying a dependency that directly affects that module.

Do **not** reread frozen modules just because a new session started — assume approved modules remain correct until explicitly changed. Any change to a frozen module must note the reason in its `docs/status/<Module>.md`.

## Token optimization rules

- Do not reread unchanged documentation within or across sessions.
- Do not reread frozen modules.
- Do not reread completed milestone prompts/docs.
- Do not reread the full PRD — open only the specific section a task needs.
- Do not run repository-wide searches (see search policy above).
- Reuse existing architectural decisions (`.claude/project_rules.md` condenses them; `docs/architecture_index.md` locates the full ADR).
- Assume approved modules remain correct until explicitly changed.

Goal: minimum context, unchanged implementation quality.

## Freeze protocol

When a module/milestone is completed and approved:
1. Mark it **FROZEN** in `docs/project_memory.md` and its `docs/status/<Module>.md`.
2. Treat it as read-only thereafter (see frozen module policy above).
3. Any later change requires: critical bug **or** security issue **or** explicit user approval → note the reason in the status file.

## Environment

Node 24 LTS via nvm: `export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"`. pnpm 9. Web build/typecheck use `SKIP_ENV_VALIDATION=true` (real env only at runtime).
