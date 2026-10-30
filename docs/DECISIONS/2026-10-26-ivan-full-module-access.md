# ADR: Grant Ivan the existing full-access role

Status: implemented in staging and production; independently verified.

## Context
The October26 meeting explicitly requests full access to every module for Ivan. Read-only inspection found exactly one matching active account, configured with a login credential, and roleLOGISTICA. An isolated restored-copy test authenticated with that registered credential (HTTP200) but returned403 from the manager-only users route. No credential was printed, persisted in this ADR or changed.

## Decision
Use the existing manager-authorized user-update endpoint with only `{ "role": "GERENTE" }` for the uniquely verified account. GERENTE is the existing full-access role, including user/settings administration and financial visibility; this broad access is the owner's explicit decision. Do not redefine LOGISTICA or weaken any route guard, change other accounts, reset a working credential, or introduce a special authentication bypass.

Before the live update, retain a fresh protected database backup. Verify the same exact update in the isolated restored database, including normal credential login and manager-only access. For live verification, use normal trusted HTTPS and the registered credential only in process memory. Do not print/store identifiers, passwords, JWTs, response bodies or credential-derived hashes.

## Invariants and verification
- The target is unique, active and roleLOGISTICA (or alreadyGERENTE, which must be treated as an idempotent no-op).
- Only the role and normal updatedAt metadata may change on the target; its credential/password and all other fields remain exact.
- Every other user remains unchanged. No customer, product, order, quotation, stock, invoice or other business record changes; the existing endpoint's role-change audit entry is expected.
- Existing unauthenticated401 and non-manager403 protections remain. No new general auth code is authorized by this decision.
- Obtain a fresh login after the change: middleware authorizes the role carried in a signed token, so an existing LOGISTICA token is not upgraded by refreshing a page. Tell Ivan to sign out and sign in again.
- Verify login200, returned roleGERENTE, manager-only users200 and representative read-only module routes without logging private data.

## Owner-authorized credential correction

A later explicit owner request supplies the desired login document privately. An actual read-only check found it differs from the stored value. This narrowly supersedes the prior decision to retain that field: update only cedula (and automatic updatedAt), not password, role or other users. Never put the actual document number in this ADR, tests or logs. Retain a fresh protected backup and verify normal HTTPS login with the supplied credential plus rejection of the previous one. No code deploy/restart is required. Role GERENTE and all business records must remain intact.

Completed: stage and LIVE exact-value checks, normal HTTPS login200/users200 and previous-credential401. Fresh protected backup/TOC recorded at `/opt/maral-meeting-20261026/ivan-credential-20261027T142551Z`. Independent dump-to-LIVE User comparison confirms only target cedula+updatedAt changed; password, GERENTE/active and other five users unchanged. Independent login/auth-me/users200, unauth401. No literal credential is retained here.

## Consequences
This is an account-role configuration change, not new IAM architecture or a credential migration. It grants the same capabilities as other managers and does not configure or activate WhatsApp/AI/jobs. A later reduction/revocation is a separate authorized operation; never restore an old full database over newer business writes to reverse one role change.

## Evidence
- Pre-change isolated login200, roleLOGISTICA, users403; all user fields unchanged by the read-only probe.
- Fresh backup actually restored to `maral_john_20261026_access_before` before live role change. Evidence `/opt/maral-meeting-20261026/t2-20261027T034518Z`.
- Parent normal HTTPS registered-credential login200/new GERENTE role, users/core10GET200; unauth401/old token403. Shared code and credentials untouched.
- Independent T2 PASS:40tables/freshbaseline;38business tables exact, other5users exact, only targetrole+updatedAt and one audit row changed,53FK/zeroorphans; auth/me/users/coreGET200 and negative401/403.
- Full task: `odd/tasks/john-meeting-2026-10-26.md`, T2/S15/S17. No integral ERP or native review approval claimed.
