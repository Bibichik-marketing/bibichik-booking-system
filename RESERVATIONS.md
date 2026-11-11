# Reservations

Routes: /en/reserve, /zh/reserve, /ko/reserve, /ja/reserve, /ms/reserve. This standalone application uses translations in lib/reservation-copy.ts.

## Setup
1. Create a Supabase project and execute supabase/reservations.sql once in its SQL editor.
2. Set SUPABASE_URL to the project HTTPS URL and SUPABASE_SERVICE_ROLE_KEY to its server service-role key in your deployment environment (.env.local for development). Never prefix this key with NEXT_PUBLIC_. Set SITE_URL to the deployment origin, using the temporary test application URL.
3. In the private SQL editor, create reservation_slots rows for each verified service date and outlet. Supply starts_at and ends_at with explicit +08 timezone, Lunch/Dinner period, capacity, max_guests and enabled=true. No default hours or slots are seeded.
4. Restart the application. Verify availability and submit a booking; confirm the Pending row in Supabase. Test parallel submissions against a low-capacity slot before launch.

Slots represent independent capacity pools: configure non-overlapping services for each outlet, with capacity accounting for all tables and walk-ins. ends_at defines booking duration. Closed dates/holidays have no enabled slots. Opening hours are represented by explicit slots; recurring schedules, individual table assignment and staff management UI remain future work. Do not configure overlapping slots sharing tables. Pending bookings consume capacity until staff update their status using trusted database access.

Without database configuration or enabled capacity, the page displays unavailable and cannot submit. No success is simulated. Database transactions lock each slot, enforce capacity and persist idempotency keys. Retry with the same key returns the stored reference. Public clients cannot read booking tables; only the server calls RPCs. The existing process-local rate limiter is reused; configure a trusted proxy IP header only when your proxy overwrites it, and add shared gateway rate limits for multi-instance deployments. No customer information is logged. Set an operational retention/deletion policy for customer data and backups before launch.

## Security review before first execution
The migration is wrapped in one transaction, including function privilege revocation. Both SECURITY DEFINER RPCs pin an empty search_path and qualify public table/row-type references and pg_catalog functions. The timestamp trigger remains SECURITY INVOKER with an empty search_path and no public execute grant. RLS remains enabled without public policies; PUBLIC, anon and authenticated have no table grants or booking RPC execution. Only service_role is explicitly granted booking RPC execution (owners/admins retain their inherent privileges).

API compatibility is unchanged: RPC names, argument names, JSON result keys, Pending defaults, advisory idempotency locking and row-locked capacity accounting remain unchanged. No database execution was performed during this review; validate migration syntax, grants, retries and concurrent capacity behavior in an isolated database before production use.

Remaining constraints: capacity is enforced per slot, not across overlapping intervals. Different starts_at values may overlap and independently sell the same physical seats; the unique constraint does not prevent this. Use non-overlapping services until a shared-resource or interval-aware capacity model is implemented. Trusted staff writes must follow the same slot-lock/capacity protocol, especially when reactivating cancelled bookings or moving slots. Slot edits after bookings can invalidate stored date/outlet snapshots. Pending requests do not expire automatically. Database RPC input validation relies on the server's Zod boundary for customer fields; a service-role credential bypasses that boundary and RLS and must remain private. request_payload duplicates personal information for idempotency and must follow the same retention policy as booking columns.
