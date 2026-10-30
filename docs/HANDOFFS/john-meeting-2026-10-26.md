# T1 quotation hardening — local handoff

Scope: T1 only (S1–S3, S4 stale callback, S17). Local source changes only; no remote/live DB/service/dependency action.

## Implemented
- POST and PUT continue accepting `taxPercent`, but destructure it before sending the remaining fields to Prisma. New totals explicitly use zero tax; discounts are applied once to stored line subtotal and quotation totals.
- Folio allocation floor is 945. Creation performs max-number lookup and insert in one Prisma interactive transaction protected by `SELECT 1 ... WHERE pg_advisory_xact_lock(...) IS NULL`; this returns a non-void scalar while acquiring the xact lock. Existing greater folios are preserved; existing rows are never renumbered.
- Both generators avoid the “IVA histórico” wording and show a tax amount only when a stored tax value exists. Owner explicitly requested deletion of the four existing live quotations; parent completed that separate operation with backup, preserving all orders. No historical amount was repriced in this source change.
- `QuotationForm.handleSelectProduct` now depends on current `addItem`, preventing stale suggested-discount capture after a client selection change.

## Evidence / validation
- Parent observed isolated deployed HTTP RED: valid POST returned500 (`PrismaClientValidationError`, unknown `taxPercent`), count stayed4. Owner then directed deletion of those four current quotations; parent reports the operation was backed up and orders remained unchanged. No historical PG17/source history was changed.
- Focused controller tests now directly invoke registered POST/PUT handlers with Prisma spies. First RED found PUT notes-only update was sending `{tax:0,total:existing.subtotal}`; test asserts 119/100/19 amounts are preserved by omitting all monetary update fields. A separate parent runtime RED found Prisma P2010 when queryRaw selected void; SQL now returns a scalar while acquiring the transaction lock.
- Required combined focused tests and builds/typecheck results are in the final implementation handoff. No deterministic UI/browser proof was run; callback dependency fix is code-inspection only.
- Parent must run actual isolated-stage HTTP GREEN, concurrency, conversion, and browser probes before deploy. No deployed behavior is claimed.

## Suggested isolated stage probes
1. Authenticated POST, valid clientId, one item `{productId, qty:1, unitPrice:100, discount:31}`, `taxPercent:0`; expect 201, tax0, subtotal/total69, one persisted quotation and item subtotal69.
2. Repeat POST including accepted `taxPercent` field; confirm Prisma receives no such model field and no phantom duplicate is created on failure.
3. Authenticated PUT of a staged editable quotation with taxPercent and a discounted item; expect success, tax0 and discounted values once; then verify duplicate/convert paths retain existing behavior.
4. Concurrently issue multiple isolated POSTs; expect unique folios, all >=945 and five-digit display padding, with existing higher folios untouched.
5. Render a new zero-tax quotation and a legacy stored-tax fixture through HTML and PDF; check labels and amounts are separately presented, without silently modifying stored totals.
6. Browser: select an IM client, then change selection to another discount category before adding a normal product; verify new line receives the currently displayed suggestion. Repeat for kit if practical.

## Not included
T3 category editing/discount feature, broader meeting requirements, live writes, schema/migration, generated assets, and deploy.
