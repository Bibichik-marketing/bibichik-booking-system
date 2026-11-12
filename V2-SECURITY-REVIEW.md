# V2 corrective pre-production review

## Changes
- Submission lead is >=1800 seconds at database decision time for Online and Phone. 29:59.999 is rejected. Ordinary confirmation is before arrival minus 30 minutes; first morning and second morning approval remain before arrival+16 minutes and +1 minute respectively. Independent hold expiry still wins.
- A Confirmed reservation that has started cannot be rescheduled or resized. The existing record/120-minute commitment stays intact; a separate future booking is a separate commitment. Non-capacity Admin contact operations do not revalidate a past arrival as though it were a new booking.
- Checkbox-only link regeneration is rejected by both API and legacy RPC. Staff must record a manual original-phone callback or original-WhatsApp-reply attestation, with a private case UUID. The DB issues a 10-minute receipt bound to booking, actor, row version and immutable recovery-phone hash. Regeneration checks and consumes the receipt atomically and audits method/reference/limited assurance without raw token or phone. The API prepares manual WhatsApp delivery only to the returned registered number. Legacy revoke remains available. Changed contacts fail closed pending a separately reviewed Admin recovery procedure.

## Assurance limits
A staff attestation does NOT prove customer possession or identity. The application cannot verify an offline callback or the substance of a WhatsApp exchange. An authorised dishonest staff member could submit a false attestation. Restaurant policy must define the independent identity questions/evidence and supervision; the case UUID must refer to a genuine private operational record, not be invented to get past the form. Never put the answers, phone, messages or secrets in the audit reference. No automated WhatsApp/SMS/OTP provider has been introduced. Do not describe the flow as verified identity or verified delivery.

## Restore rehearsal
`npm run test:v2:concurrency` now creates a local V1 fixture, dumps it with pg_dump, restores a separate database with pg_restore, applies V2 there, and verifies preservation of 3 staff/Auth associations, 4 disabled slots, legacy data, table grants/default ACL, RLS, update trigger and original exclusion constraint. It executes the new boundary/rescheduling/recovery regressions and eight independent request connections. Both V2 outlets are asserted disabled before any isolated test-only enablement. This is real PostgreSQL backup/restore of synthetic data, NOT a backup or restore of the actual Supabase project. The Auth fixture models dependencies and auth.uid but not the complete GoTrue service or production schema drift.

PostgreSQL tools must match the local server major version (18). On this test machine they are under /opt/homebrew/Cellar/libpq/18.6_2/bin; elsewhere set PG_TEST_TOOLS_DIR to your approved matching tool directory. No test reads .env or contacts Supabase. Keep CI from uploading database dumps or credential-bearing crash artifacts; local temporary data is removed in finally.

## Remaining release gates
- Compare against an owner-approved real schema/ACL snapshot and restore an encrypted, supported Supabase backup in isolation; verify real Auth login and staff IDs. Do not claim the synthetic restore meets that gate.
- Verify API recovery UI end-to-end with synthetic accounts and the restaurant's documented original-phone process.
- Add shared rate limiting before multi-instance hosting; current process-local controls are not distributed.
- No migration was executed remotely. If an older V2 draft has already been applied anywhere, do not rerun this installation migration: prepare a separate additive corrective migration and reviewed rollback.

## Safe rollback/restore
Before any remote change: pause new bookings, retain current application release and exact database function/grant definitions, and make an encrypted supported backup covering application and supported Auth data/configuration. Verify restore in a different project/cluster before changing the original. Record hashes, row counts, staff identity/linkage, disabled slots, RLS/grants and trigger/constraint checks without recording PII in reports. Keep both booking switches disabled during acceptance.

If an installation migration fails, let its transaction roll back; investigate before retry. After successful V2 writes, do not restore V1 mutation RPCs or drop V2 columns/tables to roll back application code: this could bypass commitments or destroy links/audit. Stop writes, preserve evidence, reconcile any commitments and prefer a forward fix. A point-in-time/logical restore can lose subsequent writes; obtain owner approval and reconcile them first. Never delete/recreate staff or Auth accounts as a repair strategy. No permissions, main merge, remote data or live publication were changed in this review.
