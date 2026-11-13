# Admin-only reservation archive — approval required

## Deployment state

Migration `supabase/migrations/202611130001_reservation_archive.sql` is **applied once in Staging, pending final Production approval**. It must not be applied automatically or rerun in Staging. Production has not received this migration. Existing customer booking schedules, booking-enabled switches, Auth users, staff memberships, slots and capacity functions remain unchanged.

The strict SQL was verified in Staging with both real linked outlet-staff identities under controlled authenticated-role claims. All synthetic fixture changes were rolled back, preserving original records and disabled Staging switches. A fresh protected Production backup also passed archive integrity checks, isolated PostgreSQL 17 application/Auth recovery and the same archive/capacity/audit regression. Unit tests additionally use isolated PGlite with the full V1/V2 SQL, including btree_gist and the exclusion constraint. These checks do not certify full Supabase-platform recovery or replace real signed-JWT/browser API acceptance tests. Revalidate backup freshness and Production guards immediately before any separately approved Production application.

Staging-tested SQL SHA-256: `84bfb9b76a2d896a4c9a70d60ec0a90c4d3cd1df5906ef81cd7935e34abeb3c4`.

The application fails closed when the new capability RPC is unavailable: normal reservations still load and Delete stays hidden. The feature is not operational on an unmigrated database. Review existing deployment automation before publishing this branch.

## Objects and permissions

- New private `booking_private.reservation_archives`: reservation FK/primary key, Admin Auth FK, timestamp, terminal-status snapshot. RLS enabled, postgres owner, all direct privileges revoked from PUBLIC/anon/authenticated/service_role, including TRUNCATE. No new policy exposes the table.
- Two new postgres-owned SECURITY DEFINER RPCs with empty search paths: `staff_archive_capability_v2()` and `staff_archive_reservation_v2(uuid,bigint,text)`. EXECUTE only for authenticated. Each verifies active database membership; the mutation requires Admin regardless of browser visibility or API checks. Service-role JWTs cannot invoke either RPC.
- Replace `staff_reservations()` to exclude archived IDs while preserving outlet isolation and notification metadata.
- Replace `booking_status_v2(text)` to deny archived reservations, including after any later token regeneration; archive also revokes the existing token. Its service-role-only EXECUTE remains unchanged.
- Existing reservation, audit and token tables keep their current grants. In particular, the pre-existing server-only service_role SELECT/DELETE on reservations is not broadened. Archive is not a general personal-data erasure operation.

## Behaviour and integrity

Delete is in the existing reservation details panel, uses existing button styles, and is translated in English, Chinese and Malay. Confirmation identifies the booking reference. API payload requires UUID, positive row version and reference; server checks the Admin capability using the caller's JWT before invoking the mutation. Database independently repeats Admin authorization.

Allowed stored statuses: Completed, Cancelled, Rejected, Expired and No-show only. Every stored Pending or Confirmed record is rejected, including Pending whose deadline has passed; legacy Declined and Seated are also rejected. The list returns archive_eligible separately from its display-only Expired status so the updated UI hides Delete on such Pending records. This strict candidate differs from commit 851f72dfde7539ca517c82b8d5ce890ec3b62892 and requires review before Production. Cancel active reservations first.

Archive acquires the shared outlet lock and reservation row lock in the existing order. Version/reference checks reject stale requests; duplicates are rejected without extra audit events. It stores the archive and audit event, with the same Admin ID and timestamp, atomically with token revocation. An audit failure rolls back the entire operation.

Original status, row version, scheduled interval, guests and released_at remain untouched. Capacity and timeline functions deliberately continue to include any retained two-hour commitments, even though archived rows disappear from the normal reservation list. No other reservation is changed. Historical audit entries remain available through the existing authorized audit RPC by booking ID; there is no archive browser or restore UI in this change.

## Approval and verification procedure

1. Verify project/TLS, backup/restore and existing V2 baseline; no automatic migration retry.
2. Review and apply this single transactional migration only after approval, as postgres. It deliberately fails if already installed.
3. Verify both new RPC owners, search_path and exact EXECUTE matrix; private table RLS and absence of direct table privileges. Expected application inventory increases by one table and two functions.
4. Verify Auth/staff, schedules, booking switches and legacy slots are unchanged. Do not change booking switches for this feature.
5. In a controlled synthetic Staging window, verify Admin archive, staff denial at both outlets, cancellation of confirmation, stale request rejection, preserved capacity and historical audit, and invalidated customer link. Do not use real customer records.
6. Only then authorize the matching application release. Physical mobile/native confirmation behaviour remains a manual browser check.

## Rollback / emergency containment

Prefer rolling back the application only; keep the additive archive table, audit history and archive-aware list/status RPCs so archived data does not silently reappear. To disable further archives, an owner can review a narrowly scoped `REVOKE EXECUTE ON FUNCTION public.staff_archive_reservation_v2(uuid,bigint,text) FROM authenticated;` in a transaction, followed by effective-grant verification. Do not execute this automatically.

Do not drop the archive table, remove audit events, restore pre-archive list/status functions or un-revoke links as an automatic rollback. Reversing an archive or restoring a backup requires a separate reviewed operation, preserves original capacity commitments, and must account for reservations created since the backup. Never restore over a live database blindly; verify an isolated application/Auth restore first. Full Supabase-platform disaster recovery remains uncertified.
