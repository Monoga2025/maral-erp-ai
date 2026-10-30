# RackNerd app-only startup and isolated database safety

Current deployment: **https://os.industriasmaral.com** is live on RackNerd after the owner's explicit deployment authorization. See `docs/HANDOFFS/deployment.md` for verified runtime/data evidence, preserved services, rollback boundaries and remaining readiness checks. The preparation guidance below does not itself authorize further remote changes.

## Scope and data boundary

Deploy only the current MARAL frontend/backend. **The authoritative working database is now the merged current PostgreSQL18 `maral_os`, not the old tiny Railway snapshot.** Approved additive recovery yielded903clients330products while preserving all current records. The owner's later explicit cleanup deleted only four old current quotations; current verified counts are903clients330products5orders0quotations6users. Ivan's existing account was explicitly granted GERENTE without changing credentials or other users.

Never restore the historical Railway2/2 dataset or the old full PostgreSQL17 database over current business writes. Preserve old PostgreSQL17/history, uploads/backups, n8n and every unrelated service. Railway compute is separately paused by explicit authorization; retained volumes/configuration must remain. See `docs/MARAL_MASTER_DATA_RECOVERY.md`, `odd/tasks/john-meeting-2026-10-26.md` and the deployment handoff. New code/schema changes need fresh scoped staging/backup proof; startup still must not mutate schema or seed data.

Do not perform deployment, credential, DNS, or Git operations from this source-preparation work. Before validation, establish that the restored isolated database's schema is compatible with this application. This artifact intentionally does not push, migrate, or otherwise mutate schema.

## Runtime behavior

Both Dockerfiles start only `node dist/index.js`; container startup does not invoke Prisma schema mutation. In the backend, startup seeding and background workers retain their prior default behavior, but can be independently disabled:

- `STARTUP_SEED_ENABLED=false`: skips `ensureSeedData` and `seedDripSequences`.
- `BACKGROUND_JOBS_ENABLED=false`: skips campaign sender, drip worker, best-time, forbidden-pattern, and weekly-report jobs.

Only the exact string `false` disables an action; unset controls preserve current behavior. For isolated database validation, set both controls to `false` in the replacement backend environment. HTTP routes and health endpoint still start. Imports of these worker modules do not start workers themselves; they start only through the guarded calls in `backend/src/index.ts`.

## Validation boundary

Build and focused policy tests do not prove compatibility with the Railway snapshot. Validate against a restorable, isolated copy with both startup controls disabled, then perform authorized HTTP/browser checks and explicit schema compatibility review before cutover. Do not connect this validation image to the old VPS database. No automatic schema apply or seed is part of safe startup.
