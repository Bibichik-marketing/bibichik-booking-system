# Rejection notifications and Rejected → Confirmed — release review

The application sends no WhatsApp messages. Following a committed authenticated Reject or Confirm operation, it navigates a pre-opened blank popup to the registered customer's WhatsApp link. Blocked/throwing popups retain an Open WhatsApp fallback. Failed status updates close the blank popup and do not navigate to WhatsApp. Rejected details retain a manual rejection-message link; invalid phone numbers disable that link. Messages contain the actual outlet, reference, date and time, without internal notes or status tokens. Staff controls and errors support English, Chinese and Malay; message content is English, consistent with existing confirmation messages.

## Separate database approval required

Review `supabase/migrations/202611250001_rejected_reconfirmation.sql` independently. It has NOT been applied to Production or any hosted project. It creates only `public.staff_reconfirm_rejected_v2(uuid,bigint)`. It does not replace original V2 migrations/functions, edit existing rows at installation, change table grants/RLS, schedules, quotas, booking switches, Auth accounts or the Full Name proposal.

The new function is owned by postgres, SECURITY DEFINER with empty search_path. PUBLIC, anon and service_role have no EXECUTE; authenticated has EXECUTE but must pass active staff/outlet authorization inside the function. Admin can use either outlet; Staff can use their own. It locks outlet then row, checks current stored Rejected status and row version, rejects archived or unreconciled legacy bookings, and validates the unchanged arrival/date/time interval against CURRENT booking rules. It then runs the EXISTING 120-minute overlapping capacity calculation under the SAME outlet advisory transaction lock as new bookings and settings.

Reconfirmation is a fresh immediate Staff approval using the existing Phone validation: a future valid arrival with at least 30 minutes' exact lead, valid operating day/service window/30-minute arrival, enabled/unpaused booking and no overlapping closure. It does not revive an already-started booking. Original Pending approval rules, including first/second-slot exceptions, remain unchanged. This fresh-approval path does not extend the old Pending deadline or any status token. If restored, released_at is cleared so the entire unchanged 120-minute interval consumes capacity again. Customer details, reference and scheduled interval stay unchanged. Row version and rules version update; a Reconfirmed audit entry records actor, timestamp, previous/next states and versions in the same transaction. Audit failure rolls back the status update.

Expired, revoked or archived status links remain inaccessible. Still-valid existing links show the updated status with the existing first-name fallback. No token is generated, reset or unrevoked by reconfirmation.

## Compatibility and deployment order

Rejection WhatsApp works with the existing database. Rejected reconfirmation needs the new RPC. Before it is installed, the API fails closed with an actionable unavailable message; it never falls back to a weaker RPC. The original Pending → Confirmed endpoint remains unchanged. No application deploy command runs this SQL automatically.

Before any hosted SQL: obtain explicit approval of this separate migration, verify the exact destination and current V2/archive dependencies, take and verify a fresh suitable backup, rehearse against an authorized non-Production database, compare staff/data/grants/RLS/settings snapshots, then execute the exact reviewed migration once as postgres in a fail-on-error transaction. Verify function owner/search_path/grants, denied cross-outlet requests, row/version checks, audit and capacity before enabling the new workflow in a hosted app. Do not rerun V2 or change booking availability. Current hosted Staging availability remains unconfirmed; this work makes no claims about hosted verification.

## Rollback for review only — do not run automatically

Roll back application code through the normal reviewed release process. To remove only the new capability, the approved owner can review:

```sql
begin;
revoke execute on function public.staff_reconfirm_rejected_v2(uuid,bigint) from authenticated;
drop function public.staff_reconfirm_rejected_v2(uuid,bigint);
commit;
```

This disables future reconfirmations and does not undo already successful confirmations. Never bulk-reject or delete restored bookings: those Confirmed commitments and their audits must remain intact. Do not restore a pre-migration backup over a live database that has received newer customer bookings. If data recovery is ever required, restore into an isolated database and reconcile explicitly; full Supabase-platform disaster recovery is not certified by these local tests.

## Verification

Run TypeScript, ESLint, `npm test`, production build and `npm run test:v2:concurrency`. Normal SQL tests use disposable PGlite (its fixture omits the unavailable btree_gist exclusion constraint). The native concurrency suite additionally restores a synthetic Supabase-compatible logical backup into a fresh PostgreSQL instance with real grants, RLS, triggers, Auth dependencies and the original exclusion constraint. It exercises eight competing reconfirmations and a new-booking/reconfirmation race. It never reads `.env` or connects to Supabase. These tests do not certify current hosted data/configuration, actual mobile WhatsApp handoff, browser popup permissions or message delivery; those require a controlled manual check after deployment approval. No WhatsApp message should be sent automatically.
