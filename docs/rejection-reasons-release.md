# Rejection reasons — separate migration approval required

No remote SQL or deployment is authorized by this document. The required reason is implemented behind the server-only `STAFF_REJECTION_REASONS_ENABLED` flag, which defaults to blank/false. With the flag off, existing Reject/Cancel/reconfirmation and legacy WhatsApp behavior remain compatible with the current database; no new RPC is required or called. A supplied reason is never silently discarded: a reason-bearing request while disabled is rejected. Do not enable the flag until the separate migration has been reviewed, installed and verified. No automatic GoDaddy publication or Supabase migration command was added.

## Minimal SQL change

Review `supabase/migrations/202611260001_rejection_reasons.sql` independently. It uses existing `booking_private.events.details.reason`; no table/column/index or historical-data rewrite is needed. It guards the reviewed original `booking_private.transition(uuid,text,text,boolean)` owner, SECURITY DEFINER, empty search_path and normalized body fingerprint, then changes only its Rejected/Declined path to reject reasonless legacy requests. Other transitions retain their original code. It adds three postgres-owned SECURITY DEFINER functions with empty search paths and authenticated-only EXECUTE:

- `staff_reject_reservation_v2(uuid,bigint,text)`: validate visible nonblank reason (up to 500 characters), active outlet Staff/Admin, current Pending status/version/deadline and archive/legacy restrictions. Acquire the same outlet row lock and booking row lock as the existing status workflow. Save Rejected status, original release policy and one audit event atomically, recording exact reason, actor and server timestamp. Audit failure rolls everything back.
- `staff_rejection_history_v2(uuid)`: authorize the booking outlet and return only rejection events, exact reasons, timestamps and actor IDs. Staff may read this scoped rejection audit for their outlet; the broader Admin-only Audit API remains Admin-only.
- `staff_rejection_reason_capability_v2()`: active-membership capability check used only when the server flag is enabled.

PUBLIC, anon and service_role have no EXECUTE on the new RPCs. No core/private table grants or RLS policies change. The existing Production-installed `staff_reconfirm_rejected_v2` is untouched and must not be rerun. Reconfirmation retains rejection events and reasons. Customer status responses and status tokens are unchanged; the Full Name proposal is not included.

## Customer-visible text and privacy

Valid text is stored verbatim, including leading/trailing spaces and line breaks; validation never trims or translates the saved reason. The web input/API cap is 500 UTF-16 code units, while the database enforces 500 Unicode characters. Normal Staff UI text is English/Chinese/Malay. Reasons are never translated, even if they equal a status label. Reject explicitly warns that the reason will be shared with the customer; staff must not type internal notes or identities into this customer-visible field.

The server builds WhatsApp from the successfully saved RPC response, never an unsaved draft or internal audit JSON. Only outlet, booking reference/date/time and exact reason enter the rejection message; audit actor/timestamp/private metadata are excluded. The chat uses the original registered customer phone and remains manual Send only. Popup blocking retains a manual fallback. Rejected details load the saved rejection history again; enabled reason mode disables WhatsApp for historical records without a saved reason instead of inventing one. Successful reconfirmation uses the existing confirmation message.

## Controlled rollout after separate approval

1. Keep the feature flag blank/false. Existing Production remains unchanged during review. This code can be reviewed without an unapplied-migration runtime dependency; do not activate the new workflow yet.
2. Recheck exact Production destination/TLS and migration checksum/dependencies, obtain a fresh verified backup and isolated recovery evidence, then request explicit approval of this separate SQL. Do not rerun V2, archive or reconfirmation migrations.
3. After approval only, apply the exact reason migration once transactionally as the approved owner. Verify ownership, paths, grants, Staff associations, row/data/settings preservation and scoped access. There is a short fail-closed rollout interval: old clients cannot reject without a reason once SQL is installed.
4. After SQL verification, separately authorize setting `STAFF_REJECTION_REASONS_ENABLED=true` for the intended environment and publishing application code. Refresh Staff tabs so the capability check activates the textarea. A stale/misconfigured client cannot bypass database validation or silently lose a reason.
5. Perform controlled synthetic non-Production acceptance for Reject/retry/double-click, reason-based WhatsApp, history, Cancel and capacity-checked reconfirmation. Physical iPhone/Android/WhatsApp URL handling still needs manual verification; no messages send automatically.

## Fail-closed rollback for review

Do not delete events, clear saved reasons or restore an old backup over newer reservations. If the new write path must be suspended after deployment, a separately approved owner may revoke authenticated EXECUTE on `public.staff_reject_reservation_v2(uuid,bigint,text)` and disable the feature flag. Leave the reasonless-rejection guard and history data intact: rejection is temporarily unavailable; Cancel and existing reconfirmation continue. Do not restore a weaker reasonless RPC as a workaround. Further rollback requires review of the original helper snapshot, and must preserve all new audit rows.

## Local verification

Tests cover gate-off compatibility, missing migration, blank/Unicode-whitespace reasons, exact message encoding, unauthorized outlets/inactive users, stale/expired records, atomic audit failure, preserved tokens/guest fields, historical missing reasons and exact history after reconfirmation. The restored native PostgreSQL test additionally races two rejection submissions: one update and audit win, then capacity-checked reconfirmation retains that exact reason. These are local/synthetic tests, not live Production write tests or certification of full Supabase-platform disaster recovery.
