# Backup & Recovery Runbook (M17 / ADR-025 §8)

Operational runbooks for backup, restore, and disaster recovery. **M17 builds no
backup service** — it operationalizes the Supabase platform (PITR) + `pg_dump` +
scripted storage sync. Everything here is a manual/scheduled operator procedure.

**Prerequisites:** `psql`/`pg_dump`/`pg_restore` (Postgres 16 client), `curl`, a
populated `.env` (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE`, `NEXT_PUBLIC_SUPABASE_URL`),
and Supabase project access. `<PROJECT_REF>` = the Supabase project ref.

> **Connection note:** for `pg_dump`/`pg_restore` use the **direct** (session-mode)
> connection string, **not** the transaction pooler (port 6543). The direct URL is
> `postgresql://postgres:<PW>@db.<PROJECT_REF>.supabase.co:5432/postgres`.

---

## 1. Postgres backup

Two independent layers — use both.

### 1a. Point-in-Time Recovery (primary, Supabase Pro)
PITR continuously ships WAL, so you can restore to any second in the retention
window. It is the first line of defense and requires **no cron**.
- Enable: Dashboard → Database → Backups → **Point in Time Recovery** (Pro plan;
  402 on free tier — enable when upgraded, tracked in `RUNBOOK_SUPABASE_SETUP.md §6`).
- Verify it is on before go-live.

### 1b. Logical `pg_dump` (portable, off-platform)
A portable snapshot you own, independent of Supabase. Run on a schedule (cron/CI).

```bash
# Custom-format dump of the application schema (public). Excludes Supabase-managed
# auth/storage schemas — those are restored by re-provisioning, not this dump.
pg_dump "$DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  --schema=public \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"
```
- Store dumps encrypted, off Supabase (e.g. S3/GCS with lifecycle retention).
- Test dumps are restorable (see §2) — an untested backup is not a backup.

---

## 2. Restore

### 2a. From PITR
Dashboard → Database → Backups → **Restore** → pick the timestamp. Supabase
provisions a restored database. **This is destructive to current state** — confirm
you are restoring the right project.

### 2b. From a `pg_dump`
Restore into a **fresh/empty** target database (never over live data blindly):
```bash
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$TARGET_DATABASE_URL" backup-YYYYMMDD-HHMMSS.dump
```
Then reconcile Prisma migration state and re-verify:
```bash
pnpm --filter @repo/db exec dotenv -e ../../.env -- prisma migrate deploy   # ensure schema head matches the code
curl -fsS http://<host>:3000/api/ready       # DB + storage reachable → 200
```

---

## 3. Storage backup

Five **private** buckets hold user files: `student-documents`, `homework-files`,
`announcement-attachments`, `documents`, `branding` (source of truth:
`STORAGE_BUCKETS`, `packages/constants/src/index.ts`). Supabase replicates storage,
but for a portable, off-platform copy, sync each bucket on a schedule.

```bash
# Requires the Supabase CLI, authenticated to the project.
supabase link --project-ref <PROJECT_REF>
for b in student-documents homework-files announcement-attachments documents branding; do
  supabase storage cp --recursive "ss:///$b" "./storage-backup/$b"
done
```
- Files are opaque blobs; their DB metadata (paths in `Document.storagePath`,
  `HomeworkAttachment`, etc.) is captured by the §1 Postgres backup. **Restore
  both together** — orphaned rows or orphaned blobs otherwise.
- Buckets stay **private**; never make them public to ease backup (ADR-004).

---

## 4. Migration rollback

**Prisma has no down migrations** — do not hand-write reverse SQL against live data.
The two supported paths, in order of preference:

1. **Forward corrective migration (preferred).** Write a NEW migration that undoes
   the change additively (drop the column/table the bad migration added, etc.),
   commit it, `migrate:deploy`. This keeps migration history linear and auditable.
2. **Restore (last resort, for data corruption).** Restore the database from PITR
   (§2a) or a `pg_dump` (§2b) taken *before* the migration, then redeploy the
   matching code revision.

> Every M-series migration was proven **additive** by `prisma migrate diff` before
> apply, so a structural rollback is almost always a forward `DROP` migration, not a
> data restore. Never edit an already-applied migration file.

---

## 5. Secret rotation

> **Known blocker (M1.5):** the service-role key, DB password, and seed admin
> password were shared during setup and **must be rotated before real data** — this
> is that procedure.

| Secret | Rotate at | After rotating |
|---|---|---|
| `SUPABASE_SERVICE_ROLE` | Dashboard → Project Settings → API → roll the service_role key | update `.env` on every host, redeploy |
| DB password (`DATABASE_URL`) | Dashboard → Database → reset database password | update `DATABASE_URL` everywhere (app + CI + backup jobs), redeploy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → API → roll anon key (rare) | update web+mobile env, rebuild/redeploy clients |
| Seed super-admin password | via Supabase Admin API / reset flow | one-time; not stored in app env |

- Rotate one secret at a time, redeploy, confirm `/api/ready` is green before the next.
- The service-role key is **server-only** (no `NEXT_PUBLIC_` prefix) — never in a
  client bundle. Grep the repo after rotation to confirm no leak.

---

## 6. Disaster recovery (full project loss)

Recovery order for a lost/corrupted Supabase project. Target: a verified, sign-in-ready
deployment (mirrors `RUNBOOK_SUPABASE_SETUP.md`).

1. **Provision a new Supabase project** (or restore the existing one via PITR §2a).
2. **Apply auth/security config** — `RUNBOOK_SUPABASE_SETUP.md §2` (signups off, OTP
   limits, password policy, redirect allowlist).
3. **Restore the database** — `pg_restore` the latest §1b dump (or use the PITR-restored
   DB directly), then `pnpm --filter @repo/db exec dotenv -e ../../.env -- prisma migrate deploy`.
4. **Re-provision the 5 private storage buckets** — `RUNBOOK_SUPABASE_SETUP.md §3b–3e` —
   then restore blobs from the §3 storage backup.
5. **Rotate all secrets** (§5) and update every host's `.env`.
6. **Redeploy** the web container — `scripts/deploy.sh`.
7. **Verify** — run the live suite and probes:
   ```bash
   pnpm --filter @repo/business run verify:auth   # all live checks must PASS
   curl -fsS http://<host>:3000/api/health   # liveness
   curl -fsS http://<host>:3000/api/ready    # DB + storage → 200
   ```

**RPO/RTO:** RPO ≈ PITR window (seconds) or last `pg_dump` (schedule-dependent).
RTO is dominated by step 4 (blob restore) — size buckets accordingly.

---

## 7. Deployment rollback

Application-only rollback (no data change). Keep the **previous image tagged** so
rollback is a re-point, not a rebuild.

```bash
# Roll the running container back to a known-good image tag.
docker compose -f docker-compose.prod.yml up -d --no-build \
  # with school-portal-web:<previous-tag> pinned in the compose/image ref
```
- If the bad release included a **migration**, a code rollback alone is unsafe —
  pair it with §4 (forward corrective migration or restore) so schema and code match.
- After rollback, confirm `/api/ready` is green and check the structured logs
  (ADR-025 §3) for the error that triggered it.
