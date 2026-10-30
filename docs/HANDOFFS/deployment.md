# Deployment handoff — RackNerd MARAL replacement

MARAL OS is published at **https://os.industriasmaral.com**. Deployment verification passed; this is not a claim that every operational workflow is production-ready.

## Running deployment

| Component | Current state |
|---|---|
| Application | `maral-current-app-20261025`, image `maral-os-current:8749a17-safe-bd29f8b1`, healthy |
| Source artifact | SHA256 `bd29f8b1f240cb166f99c3aa907e922eaa7c9a6e46b3543427ae77a4b95a77b0` |
| Database | New isolated PostgreSQL18 `maral-current-db-20261025`; no published DB port |
| Persistent storage | `/opt/maral-os-20261025/pgdata` and `/opt/maral-os-20261025/uploads` |
| Proxy | Dedicated `/etc/easypanel/traefik/config/maral-os-current.yaml`; generated `main.yaml` unchanged |
| DNS/TLS | Scoped A record to RackNerd, TTL300; trusted certificate; HTTP redirects to HTTPS |
| Old MARAL applications | Only `maral_os_backend` and `maral_os_frontend` scaled to0, not deleted |
| Preserved systems | Old PostgreSQL17, n8n, EasyPanel, evolution services, Jarvis and all unrelated service specs/replicas unchanged |
| Railway | Owner-authorized pause: application and PostgreSQL have zero active deployments; service configuration/volumes retained, not continuously synchronized |

Runtime starts only `node dist/index.js`; no automatic schema mutation. App runs as1000:1000, read-only root filesystem, dropped capabilities, no-new-privileges, writable uploads/tmp only,512MiB/one CPU ceiling, host binding127.0.0.1:3002. Existing credentials/company configuration were retained with target-specific connection/origin settings; secrets are not documented here.

## Observed verification

- Safe-startup tests4/4, backend build, frontend typecheck and diff check passed; independent source verifier repeated these. First remote build OOM134 at768MiB; same-source correction at1536MiB/one CPU completed exit0. No local Docker used.
- Railway dump restored transactionally to NEW storage. All40tables/55rows and sequences matched the dump. Fresh live Railway comparison before app start also matched every table's count and sorted-row hash; compare dictionaries, not locale-dependent list order.
- Restored live schema versus Prisma: empty migration. No schema push, destructive migration or seed applied.
- Independent runtime verifier `mvoqg1af-1-wtey`: public HTTPS/health/assets/HTTP redirect/CORS passed; unauthenticated `/api/clients` and `/api/uploads/nonexistent.jpg`401. `/uploads/campaigns` remains intentionally public.
- Ephemeral in-memory JWT authenticated read-only GETs: `/api/auth/me`200; clients2, products2, quotations4, orders1, all200. No password/cédula login was attempted. Afterwards, all40tables/55rows still matched the fresh source snapshot exactly.
- Fresh isolated Edge browser:390x844 and1280x900 login selection views rendered four user cards; no horizontal overflow or uncaught JS exceptions; trusted secure context. No card clicks or business mutations. All published cards require cédula; no live card-only bypass was found.
- All11 old Swarm specs initially matched their baseline. After stopping only the two old apps, all nine unrelated service specs/replicas remained unchanged. Scale normalized old app image references; local image IDs were verified identical to original encrypted captures. Old PG17 remains1/1; new app/PG18 healthy; final public health remainedok.
- Hostinger before/after snapshots prove all unrelated DNS groups unchanged. Parent proxy checks confirm generated `main.yaml` byte hash unchanged.

## Protection and recovery evidence

- Protected Windows backups: `C:/Users/<user>/MaralBackups/racknerd-20261025-161445` and `C:/Users/<user>/MaralBackups/railway-20261025-165806`. Service configuration uses CurrentUser DPAPI and restricted ACLs; recovery depends on this Windows profile.
- Railway custom dump109364B SHA256 `6bb856573c6c2a5bf9901b15e941416bb154dd7292f9169f9836f11940433f88`; uploaded source and database artifacts hash-verified. Captured Railway and old VPS uploads contained zero regular files.
- Server evidence: `build2.exit`, `fresh-source-compare.json`, `pre-app-services.json`, `maral-proxy-manifest.json`, `cutover-verification.json` in `/opt/maral-os-20261025`. Browser evidence: protected `edge-browser-readonly.json` beside the Railway backup.
- Do not switch back blindly: the old VPS database is NOT the Railway dataset. Railway and the target can diverge after new writes. Any rollback must first preserve new target writes and obtain owner authorization; no lossless full rollback/RPO/RTO has been proved.

## Still pending / not claimed

1. `STARTUP_SEED_ENABLED=false` and `BACKGROUND_JOBS_ENABLED=false` remain intentional. Railway deployments are now stopped, but enabling target jobs and validating inbound/outbound integration URLs still need an explicit transition plan; no external messages were sent during checks.
2. Owner cédula login and full client→quotation→order→credit/payment→preparation→dispatch/PDF/upload workflows; browser-authenticated/mobile business and HTTP/DB concurrency tests remain unproved.
3. Formal Prisma migration baseline/history, off-device backup/retention and full recovery/RPO/RTO runbook remain incomplete. Empty schema diff is not a migration-baseline solution.
4. Native review START failed `checkout-index`, lineage_created=false. Final inspect also reported `managed_assets_outdated`; no sync/profile rewrite was attempted outside deployment scope. Explicit committed-range ASSESS remained unassessable (untracked-declaration error) and required the independent high-risk verification performed above. No native approved receipt exists.
5. Build dependency audit reported22 vulnerabilities (1low,8moderate,12high,1critical); no forced dependency updates performed. Audit and remediation remain separate readiness work.
6. Source still contains a conditional card-only auth branch for users without cédula; no current published card enters it. Do not expose future users without reviewing that policy.
7. Both migrated Railway services were paused on the owner's next explicit request; control-plane status confirms no active deployments and unchanged volume IDs. Fresh pre-stop backup is protected at `C:/Users/<user>/MaralBackups/railway-pause-20261026T112417Z`, PG18 TOC and source hashes verified. The CLI wrapper timed out, but a fresh status reconciled the outcome without replay. Retained storage/subscription/past usage may still be billed. Old Railway URLs are offline until redeploy; delete/cancel, new push/PR and enabling target automations remain separate decisions. No unrelated repository changes should be staged.

## October26 meeting: completed access and quotation cleanup

- Current verified LIVE: **903 clients /330 products /5 orders /0 quotations /6 users**. No new image/restart/schema change for these two configuration/data units; quotation code fixes are local and still require staged verification/deployment.
- Owner explicitly granted Ivan all-module access. His existing active account is now GERENTE via the existing manager endpoint, credentials and all other users unchanged. Normal registered-credential login200, manager users/core10GET200, negative401/403; independent T2 PASSall40tables/53FKzeroorphans. Sign out/in required for a new role token; page refresh alone does not upgrade an old LOGISTICA token. ADR: `docs/DECISIONS/2026-10-26-ivan-full-module-access.md`.
- Owner then explicitly said: "Borra esas 4 cotizaciones". Only frozen numbers1–4 and4owned items deleted,0kits; all5orders retained with exact amounts/otherfields except one necessary quote-link detachment and timestamp. All master/stock/invoice/user/auth/otherrows exact,4DELETEaudit events. Independent T10 PASSall40tables/frozenidentitymatch/freshbaseline/dumprestore/53FKzeroorphans and publicHTTPSquotes0/orders5/mastercounts200.
- Before each live mutation: fresh protected backup, actual isolated restoration, staged operation/invariant proof; no replay. Server evidence `/opt/maral-meeting-20261026/t2-20261027T034518Z` and `/opt/maral-meeting-20261026/delete-four-20261027T110653Z`. Three encrypted CurrentUser-DPAPI source checkpoints at `C:/Users/<user>/MaralBackups/john-meeting-20261026`, hash/decrypt round trips and owner/SYSTEM ACLs verified.
- Remaining meeting work is tracked in `odd/tasks/john-meeting-2026-10-26.md`; do not claim quotation saving/newfolio/UI/shipping/import/retentions are already published. Source fixes have five focused tests/builds green but actual new-image HTTP/concurrency/browser proof is still pending. Logo remains pending owner asset; no WhatsApp/AI/jobs activation.

## Completed master-data recovery — 2026-10-26

- Live database and public authenticated API now **903 clients /330 products**, representing all approved old901/328 identities plus retained current extras. Only900Client/328Product/3Tag/9ClientTag rows added; no existing fields, IDs, stocks, transactions or auth rows changed.
- Fresh frozen backup/restore and single guarded transaction; app restarted normally. Independent comparison of all40tables proved original5orders/4quotations/6users and every other prior row preserved;53validatedFKs/zeroorphans, all source masters represented, read-only rerun0adds and Prisma reads all903/330. Public HTTPS/auth/me/client/product/order/quotation GETs200.
- SourcePG17 remains untouched. Old historical5orders/8quotations and7oldusers are preserved separately, NOT mixed into the current transaction graph/authentication. Newly recovered stock is an opening source balance, not verified physical stock or invented movement history.
- Server evidence: `/opt/maral-master-recovery-20261026/live-20261026T193137Z`; encrypted source/target/config/uploads and fresh before/after snapshots at `C:/Users/<user>/MaralBackups/master-recovery-20261026T192123Z`, owner/SYSTEM-only, DPAPI/hash roundtrips verified. See `docs/MARAL_MASTER_DATA_RECOVERY.md` and `odd/tasks/maral-master-data-recovery.md`.
- No real cédula login/full business acceptance test, no native review receipt, no new recovery commit/push. Existing app image/config/seed-job suppression and unrelated services unchanged; broader MVP checks remain pending.

## John operating guide

- Delivery: `docs/USER_GUIDES/MARAL_OS_Guia_John.pdf` (6 Letter pages,92241 bytes); source `docs/USER_GUIDES/MARAL_OS_John.md`; reproduce with `python scripts/generate_john_guide.py` (existing ReportLab environment, `--help` for paths).
- Final SHA256 `ff1d5f8129714bfbd9f600f3da6739e128f3f1a005fe3304e6517a3829e02bff`; independent PDF/source/regeneration/render checks passed after one bounded correction. Parent also inspected contact sheets and reran generator help. Closing scope page has extra whitespace only.
- Guide explicitly requires manual product-payment evidence before contado dispatch (no dedicated cash guard), distinguishes Pago flete, avoids duplicate automatic OPs, and keeps Merlin/DIAN/manual workflow boundaries. No actual cédula/business acceptance test claimed.
- Railway pause/guide evidence: `odd/tasks/railway-pause-john-guide.md`. Native review remains unavailable; independent high-risk checks are not a native receipt. Retained storage/subscription/past usage may still bill ([Railway pricing FAQ](https://docs.railway.com/pricing/faqs)); deleting data or canceling a workspace plan remains unapproved.

Implementation/startup details: `docs/DEPLOYMENT_RACKNERD.md`. Feature evidence: `odd/tasks/racknerd-maral-replacement.md`. Broader MVP blockers: `odd/tasks/operational-mvp-readiness.md`.
