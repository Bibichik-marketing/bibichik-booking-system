# Customer guest counts — separate migration approval required

Customer WhatsApp contacts and all larger-than-10 contact notices are removed. Staff WhatsApp flows are unchanged. Once enabled, the selector offers 1–15 and a distinct `15+` value. The latter requires an exact integer 16–35 (SS2) or 16–40 (Sunway). No value is rounded or silently mapped to 15. Invalid counts cannot fetch slots or continue. Exact count is used in availability, payload, summary and database commitments. Availability can be lower than the nominal quota because of overlapping bookings or capacity adjustments.

## Production dependency and rollout

The reviewed original V1/V2 SQL and last verified Production baseline contain `public.reservations.reservations_guests_check` limiting guests to 10 and `booking_private.capacity` requiring party between 1 and 10. This release performs no fresh remote Production query. A current owner preflight is still required before SQL approval. Legacy `reservation_slots.max_guests` stays unchanged: disabled compatibility slots and old slots are preserved, and V2 availability/create wrappers use the shared overlap capacity helper instead of that legacy field.

Independent review migration: `supabase/migrations/202611270001_large_party_booking.sql`. It guards postgres ownership, exact previous capacity body/search_path and exact previous guest constraint. It changes only the guest constraint and capacity helper; legacy rows still have a 10-person constraint. V2 rows have an outlet-specific physical ceiling of 35/40; the shared helper additionally enforces actual quota and every 120-minute overlapping commitment/capacity-adjustment segment. Existing create/edit/reconfirm functions retain the same outlet transaction row lock and invoke this helper. No API grants, RLS, schedules, booking switches, tokens or historical rows change. No old migrations are edited. A short table lock is necessary; the migration has a five-second lock timeout and must stop on failure without automatic retry.

`CUSTOMER_LARGE_PARTIES_ENABLED` is server-only and defaults blank/false. Until explicitly activated, customer UI retains the compatible smaller selector and APIs reject counts above the existing limit. Demo may show the new selection without storing bookings. Never enable the flag, or publish a larger-party-dependent frontend, before the separate database migration is approved, backed up, rehearsed and verified. No environment values were changed.

1. Review current Production definitions/constraints/ACLs read-only against this migration, and check it is absent.
2. Obtain a fresh protected PG17 backup, verify integrity and rehearse application/Auth restoration plus this migration in isolation. Full platform disaster recovery remains uncertified.
3. Request separate approval of exact SQL/checksum. Apply once transactionally only after approval, preserving live outlets and existing data.
4. Verify data/settings/grants and capacity, then deploy matching app with flag still off.
5. Separately authorize `CUSTOMER_LARGE_PARTIES_ENABLED=true` for the intended environment; restart as needed and check customer availability read-only. Do not create real test reservations.
6. Perform synthetic acceptance outside Production and physical iPhone/Android date/number input checks. Staff manual creation keeps its existing smaller UI; Staff can edit an existing larger party downwards up to its current count, with full database validation.

## Safe rollback

Disable the new server flag and deploy the prior compatible UI if necessary, without changing booking switches or deleting bookings. Keep the expanded capacity helper/constraint while any larger reservations exist, so Staff can still confirm or manage them. Do not restore a stale backup over new customer bookings. Reinstating old constraints/helper requires a separate read-only inventory proving no incompatible reservations or future workflows, plus reviewed SQL and backup; do not automatically shrink or delete groups.
