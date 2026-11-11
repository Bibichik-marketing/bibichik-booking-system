# Standalone BiBiChik reservations

This application is independently deployable. Root redirects to /en/reserve; five customer locales are retained. /staff provides a staff login and outlet-scoped reservation management. No legacy review or feedback routes are included. Nothing changes on bibichik.com.

## Test setup and deployment
1. Create a separate Supabase test project. Run supabase/reservations.sql followed by supabase/staff.sql in its SQL editor. Neither script has been executed by this implementation. Both are first-run migrations, not repeatable scripts.
2. Configure server environment variables SUPABASE_URL, SUPABASE_ANON_KEY (legacy anon JWT key), SUPABASE_SERVICE_ROLE_KEY (legacy service-role JWT key) and SITE_URL. SITE_URL must be the exact temporary deployment HTTPS origin, without a trailing slash. No NEXT_PUBLIC variables are needed. Never put the service-role key in client code. No SMTP configuration is required.
3. In Supabase Auth, disable public sign-ups and create staff users through the administrator console. Insert their auth.users UUID into public.staff_members with role 'admin' (both outlets), or 'outlet_staff' with outlet_id 'bibichik-ss2' / 'bibichik-sunway-163'. Do not grant staff direct table write access. Deactivate a staff_members row to revoke dashboard access immediately.
4. Add verified non-overlapping reservation_slots, with explicit +08 times and enabled=true. The exclusion constraint rejects overlapping enabled intervals per outlet. Adjacent intervals are allowed. Do not grant direct writes to untrusted users. Do not change slot outlet/times/capacity after taking bookings without a controlled reconciliation.
5. Deploy THIS repository as a NEW hosting project with Node >=22.13, npm install, npm run build, npm start (or the host's Next.js preset). Use a provider-generated temporary hostname. Add the environment variables only to this new project. Do not attach bibichik.com or change its existing hosting project. After the hostname is assigned, update SITE_URL and redeploy the new test application.
6. Later, after testing and explicit authorization, attach booking.bibichik.com and update SITE_URL. Main website navigation and DNS are separate future work.

## Implemented behavior and limits
Staff passwords are exchanged with Supabase only on the server. The short-lived access token stays in an HTTP-only, same-site cookie; production cookies require HTTPS. Tokens expire after at most one hour and staff sign in again; no refresh token is stored. No self-service signup/password recovery UI is provided. Booking data is retrieved via caller-JWT RPCs that check active staff membership on every request; customer RPC access remains service-role-only. Outlet filters in the browser are convenience filters, not the authorization boundary.

Dashboard updates use five-second polling, not Supabase Realtime subscriptions. Manual phone/walk-in entries reuse the customer validation and atomic slot-capacity logic and start Pending; staff then approve or seat them using valid status transitions. Manual entries require a configured future slot and Malaysian mobile number, so anonymous walk-ins or already-started services are not supported yet. No emails/SMS are sent on status changes. The list currently returns all authorised history; add server pagination/date query bounds for large datasets. Staff screens are English; customer screens retain all five locales.

Pending reservations consume capacity indefinitely until declined/cancelled. No restoration of terminal bookings is exposed, avoiding capacity reactivation bypass. Enabled overlapping slots at the same outlet are prohibited by the database. Booking intervals are whole services; staggered arrivals sharing tables need a richer resource model. Admin role has cross-outlet visibility and management, but staff provisioning/schedule configuration remain private SQL-console operations. Process-local rate limits need an external shared limiter for multi-instance production.

## Required end-to-end gate (not yet completed)
- Test five customer locales, date boundaries in Malaysia, keyboard/mobile usability, Pending receipt and duplicate retries.
- With capacity two, race two parties of two; exactly one should persist. Retry the winner's idempotency key; only one row must exist.
- Verify overlapping enabled slots fail, adjacent services pass, and disabled slots are never bookable.
- Test outlet A staff against outlet B IDs and manual payloads directly through RPC and HTTP: no cross-outlet data or writes. Admin sees both. anon/non-staff cannot execute staff RPCs. anon/authenticated cannot call customer RPCs or read booking tables.
- Verify approval/rejection, stale status conflicts, phone/walk-in creation, refresh polling, logout, expiration and staff deactivation.
- Review Supabase grants/advisors and deployment cookie/CSRF behavior. Confirm service-role keys are absent from browser bundles/network responses. Set retention, backups, monitoring and gateway rate limits before live use.

This is implemented application code awaiting Supabase setup and isolated end-to-end verification; it is not claimed operational.


## Standalone separation verification
This folder was selectively copied from working booking files, including untracked files, without the source Git directory or hosting links. Legacy review/feedback/SMTP code and related dependencies are excluded. Only a blank .env.example is included. npm install completed; TypeScript, ESLint, three reservation validation tests, and production build passed. The built route manifest contains only booking/staff routes and the root redirect. A source credential-pattern scan found no matches, and runtime source contains no links to the existing website. This scan is heuristic and does not replace reviewing files before any future commit. Supabase migrations and database workflows have not been executed or tested end-to-end.
