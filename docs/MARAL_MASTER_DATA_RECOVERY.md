# MARAL Master Data Recovery — verified recovery

Completed on2026-10-26: live API/database now903 Clients and330 Products. All pre-existing5 Orders,4 Quotations,6 Users/auth records, stock and every other table were preserved. Recovered900 missing Client rows,328 Products,3 referenced Tags and9 ClientTags; one source Client identity matched an existing current record without overwriting it. The source901/328 remains intact. This is master-data recovery, not a historical order/quotation merge or whole-ERP acceptance.

## Scope and safety

The runner handles only `Client`, `Product`, `Tag`, and referenced `ClientTag` records. It is Python-standard-library-only and is intended to be uploaded and invoked by the authorized parent operator on the VPS. It contains no SSH or credential handling. It never imports users, authorization data, transactions, or historical business documents. Source reads are requested read-only. Existing target records are mapped to source identities where provable and are never updated; current product stock remains untouched. New source products retain their stock as their initial balance without creating inventory movements.

The CLI defaults to a read-only plan. `--candidate-apply --candidate-db maral_recovery_20261026 --execute` explicitly applies to the candidate database in the fixed target PostgreSQL container. `--live-allow --execute --expected-source-fingerprint <md5> --expected-target-fingerprint <md5>` explicitly gates the later live operation; never use it until parent-owned fresh backups, app pause, frozen recomputation, independent review, and candidate proof are complete.

The runner captures source master rows/schema/dependencies/fingerprint in one read-only repeatable-read capture and target master rows/schema/dependencies/full-table snapshot/fingerprint in one matching capture. It locks target tables, checks a full-table baseline digest, inserts only planned rows in one transaction, and verifies exact original-row JSONB equality, unrelated-table preservation, expected deltas, and source-identity/link coverage before commit. Connection/acknowledgement uncertainty is reported as `uncertain` and requires read-only reconciliation, never replay. A post-commit source verification problem is reported as `committed_verification_uncertain`, not as rollback. Backups/restore, app pause, candidate rehearsal, and authenticated Prisma/API verification remain parent-owned and unexecuted by this local implementation task.

## Local tests

From the repository root:

```powershell
python -B -m unittest discover -s scripts -p test_recover_maral_master_data.py -v
```

The current suite contains 19 synthetic tests. It covers unique RUT mapping without changing existing target fields, historical duplicate-key retention and reruns, RUT/Merlin conflict rejection, product ID/reference collisions and idempotence, tag/link remapping, unsafe identifier rejection, Docker container/database/read-only routing, whitelist-only insert SQL, COPY stream ordering, read-only consistent capture shape, exact full-row preservation, supported schema/enum/FK checks, zero/nonzero dependency preconditions, source coverage, and uncertain/committed result classification. Run it with the command above; all19 passed, including the native name[]/text[] catalog-guard regression.

## Operational sequence (executed and independently verified)

1. Verify the pinned SSH server key before authentication and capture fresh metadata under the protected recovery directory.
2. Make protected source and target custom-format backups; record aggregate-only backup hashes and TOC evidence. Restore the target dump into the isolated candidate database only and verify the restoration operationally.
3. Upload a reviewed runner and verify its hash before execution. Recompute the read-only plan against fresh source/target state; do not assume fixed target counts.
4. Run `python3 recover_maral_master_data.py --candidate-apply --candidate-db maral_recovery_20261026` for a fresh candidate plan; review the aggregate-only output. After target-backup restore and review, use `python3 recover_maral_master_data.py --candidate-apply --candidate-db maral_recovery_20261026 --execute` to apply the candidate transaction.
5. Independently compare candidate pre/post snapshots, auth preservation boolean, source snapshot, expected additions, FK closure, and zero-addition rerun. Run read-only Prisma aggregate counts only against the candidate using the app container's environment-derived URL path.
6. Parent owns the later app pause and fresh live backup. Recompute fresh receipts under freeze, then run exactly once: `python3 recover_maral_master_data.py --live-allow --execute --expected-source-fingerprint <fresh-source-md5> --expected-target-fingerprint <fresh-target-md5>`. Verify independently before release. No live execution was performed in T1.

## Actual evidence

- Checked deployed runner SHA256: `71c2aac56ba358aed286602bdce15a535588f15b0610a0cfb338be223fa29f3a`; source fingerprint `ab764d3a4f360e68866f1dfa41480601` unchanged. Native Python3.12.3 and actual PostgreSQL18 rehearsal succeeded; rerun plans zero additions.
- Protected server directory `/opt/maral-master-recovery-20261026` (root0700/files0600): full source/target/config/uploads backups; target dump actually restored into isolated rehearsal and baseline databases. The first candidate attempt rolled back completely on a catalog name[]/text[] mismatch; all40tables matched baseline before a targeted cast correction was applied. The corrected candidate committed and passed exact preservation/ORM checks before live use.
- Actual live freeze/backup/apply record: `live-20261026T193137Z/live-status.json`, fresh target backup and restored `maral_recovery_livebaseline_20261026`. App was briefly stopped, fresh source/target receipts recomputed, additions committed once in one transaction, exact all-prior-row preservation verified, app restarted healthy. No live replay.
- Independent final check: all40public tables compared to fresh baseline, exact prior rows/auth/stock and all non-master tables unchanged;53validatedFKs/zeroorphans. Actual public authenticated HTTPS GETs auth/me, clients903, products330, orders5, quotations4 all200. Actual read-only Prisma read all clients/products; final read-only plan zero additions.
- Off-device recovery copies: `C:/Users/<user>/MaralBackups/master-recovery-20261026T192123Z`, seven CurrentUser-DPAPI encrypted source/target/config/uploads and fresh before/after-live artifacts. Transfer hashes/decrypt round trips verified; explicit owner/SYSTEM ACLs. Final post-recovery dump194209bytes, TOC verified. DPAPI still depends on this Windows profile.
- Seeds/jobs remain false. Source old users and historical5orders/8quotations were not imported; they remain in the preserved source/full backup. New product stock is its imported opening balance, not a fabricated movement ledger or verified physical count.
- No cédula login or complete business workflow was executed. Native review remains unavailable(managed assets); independent high-risk verification passed but is not a native receipt. Source helper/tests/docs are retained locally; no new commit/push/PR was requested or performed for this recovery.

A post-commit rollback must not overwrite later business writes with an old backup. Any rollback after commit requires an owner decision and a current recovery plan.
