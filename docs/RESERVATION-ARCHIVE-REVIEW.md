# Admin-only reservation archive — approval required

## Deployment state

Migration `supabase/migrations/202611130001_reservation_archive.sql` is a **separate pending migration**. It must not be applied automatically. No remote database is modified by the implementation or tests. Existing customer booking schedules, booking-enabled switches, Auth users, staff memberships, slots and capacity functions are unchanged.

Approve and rehearse the migration against an isolated restored database and then Staging before a separately authorized Production application. Take and verify a fresh backup before remote changes. Current unit database tests use isolated PGlite with a minimal Supabase Auth fixture and the full V1/V2 SQL, including btree_gist and the exclusion constraint; they do not certify full Supabase Auth/platform recovery.

The application fails closed when the new capability RPC is unavailable: normal reservations still load and Delete stays hidden. The feature is not operational on an unmigrated database. Review existing deployment automation before publishing this branch.

## Objects and permissions

- New private `booking_private.reservation_archives`: reservation FK/primary key, Admin Auth FK, timestamp, terminal-status snapshot. RLS enabled, postgres owner, all direct privileges revoked from PUBLIC/anon/authenticated/service_role, including TRUNCATE. No new policy exposes the table.
- Two new postgres-owned SECURITY DEFINER RPCs with empty search paths: `staff_archive_capability_v2()` and `staff_archive_reservation_v2(uuid,bigint,text)`. EXECUTE only for authenticated. Each verifies active database membership; the mutation requires Admin regardless of browser visibility or API checks. Service-role JWTs cannot invoke either RPC.
- Replace `staff_reservations()` to exclude archived IDs while preserving outlet isolation and notification metadata.
- Replace `booking_status_v2(text)` to deny archived reservations, including after any later token regeneration; archive also revokes the existing token. Its service-role-only EXECUTE remains unchanged.
- Existing reservation, audit and token tables keep their current grants. In particular, the pre-existing server-only service_role SELECT/DELETE on reservations is not broadened. Archive is not a general personal-data erasure operation.

## Behaviour and integrity

Delete is in the existing reservation details panel, uses existing button styles, and is translated in English, Chinese and Malay. Confirmation identifies the booking reference. API payload requires UUID, positive row version and reference; server checks the Admin capability using the caller's JWT before invoking the mutation. Database independently repeats Admin authorization.

Allowed: Completed, Cancelled, Rejected (and legacy Declined), Expired, No-show. A V2 Pending record whose fixed expiry has already passed is treated as Expired, consistently with existing list behaviour, without rewriting status. Active Pending, Confirmed and unreconciled Seated records are rejected. Cancel active reservations first.

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
