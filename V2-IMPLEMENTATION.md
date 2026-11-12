# V2 implementation and release gate

## Status
Local V2 code and additive migration are implemented. No remote migration, live availability enablement, deployment, Auth change or customer data change has been performed. Do not apply the migration until an encrypted backup of the actual Supabase project has been restored and verified in isolation. Local synthetic PostgreSQL tests do not prove remote backup recovery.

## Database
Apply `supabase/migrations/202611120001_booking_v2.sql` ONLY after the backup gate. It requires the reviewed postgres execution role. Preserve original reservations.sql/staff.sql as historical baseline; do not rerun them on the existing project. The migration does not delete Auth, staff, reservations or the four old slots. Both new outlet booking switches default false. Old overlap exclusion is deliberately retained: V2 compatibility slots are always disabled, so overlapping arrival records do not require enabling legacy capacity pools. V1 availability and mutation RPC signatures are replaced with V2-validated wrappers. Active legacy records block new booking admission pending reconciliation.

Sunway quota 40, SS2 35, 30-minute starts, 120-minute half-open commitments. Disabled V2 booking switches are an additional launch gate; unpausing alone never enables bookings. Approval decision time is taken after the shared outlet row lock. The SQL review clock skips SS2 Tuesdays and special closures. Expiry is effective in reads/capacity regardless of maintenance. Persisted expiry timestamps are never extended by calendar changes. Closure A blocks every Pending approval including Admin. Capacity reductions reject existing commitments. First morning cutoff, second slot cutoff and the independent hold use exclusive instants. Submission cutoff is interpreted minute-inclusively; cancellation exactly at arrival retains commitment; horizon includes Malaysia today +30 days. These boundary choices must be included in owner acceptance.

A closure never changes existing expiry, never auto-cancels and sets Needs Attention. Reopening does not clear that warning or revive an expired request. Expiry materialization is exposed as POST /api/maintenance protected by MAINTENANCE_SECRET; configure a trusted scheduler after deployment. No cron was installed. Logical expiry remains correct if the scheduler is unavailable.

Settings manage quota reductions including future periods, pause, special closure/reopening and Admin-reviewed service/review start/weekday changes. Changes are audited; reservations snapshot the rule version and preserve existing expiry. Review closes at 22:00; the 30-day horizon and 120-minute duration remain fixed approved business rules. Cross-outlet transfers/restoration of terminal records are intentionally rejected; create a new capacity-validated request instead. Editing pending requests never extends the original hold.

## Status links and privacy
Tokens use 32 random bytes, SHA-256 hashes at rest and fragment links. Verification is server-side POST; responses are no-store/noindex/no-referrer with minimal projection. Dedicated first name is optional and never inferred. A replayed submission returns the persisted reference but never a newly generated nonmatching link: lost-link recovery is staff-assisted verification and atomic regeneration. Rescheduling only updates still-valid, unrevoked token expiry. Token generation/revocation is audited without raw tokens. Staff replacement links are only for the originally registered number, after manual identity verification. Admin telephone changes require explicit verification; audit records contact change without copying the phone. Tokens are only stored in component memory.

Phone bookings use staff-only availability, same capacity and a >=30-minute lead time, with optional immediate confirmation. Physical seating confirmation is a human staff responsibility. No-show requires explicit verification and the 15-minute grace; neither attendance nor departure is inferred automatically. Completed and No-show commitments remain through scheduled end. Post-arrival cancellations retain commitment.

## Local checks
- npm run typecheck
- npm run lint
- npm test (isolated PGlite SQL tests; no remote access)
- npm run test:v2:concurrency (real temporary PostgreSQL, full V1/V2 install and 8 independent connections; uses synthetic data only)
- npm run build

PGlite tests omit the unsupported legacy btree_gist constraint only within their test setup. The separate real PostgreSQL test installs the unmodified V1 migrations including btree_gist. None of the test processes reads .env.local or connects to the remote project.

## Backup and rollback gate
No psql/pg_dump/Supabase CLI/Docker or verified remote backup was initially available. The embedded test PostgreSQL includes server binaries, not a verified production backup toolchain. Do not claim its synthetic data is a backup of Supabase. Owner must supply/authorize the supported logical backup path and isolated restore target. Back up application schema/data, definitions/grants/default ACL, and supported Auth data; separately capture Auth/platform settings securely. Encrypt backups, verify hashes, restore isolated, verify unchanged Auth IDs/Staff linkage and disabled slots. Do not place backup contents in Git. After verified backup, apply reviewed migration to a clone, repeat tests, then seek explicit production cutover check.

Rollback must pause booking writes first. Before V2 traffic, restore saved pre-migration RPC definitions while keeping additive columns/tables. After V2 traffic, do not drop V2 data or restore V1 capacity paths: reconcile commitments and prefer a forward fix. No destructive automatic down migration is supplied.

## GoDaddy Preview
No hosting session, startup logs or deployment credentials are available in this workspace; the actual Preview runtime error is not diagnosed. Build/start are production Next.js; use npm ci, npm run build, then npm start with the host-assigned PORT, a supported Node runtime and persistent Node hosting. No static export. GET /api/health is liveness, GET /api/ready verifies required configuration and the V2 database RPC without exposing details. Before migration, /api/ready deliberately returns 503. Check routing, bind port, process restart, outbound HTTPS and secure cookies on the isolated Preview hostname. SITE_URL must match its HTTPS origin. The main bibichik.com domain is not involved. Do not point readiness checks at a private page or expose exception/configuration details.

## Remaining release limitations
Remote backup/restore, migration, deployed RLS/grant verification, real-account V2 tests, browser end-to-end verification and Preview health checks are pending. Add a shared external rate limiter before multi-instance release. No claim of full operational readiness is made. No Git commit/push is authorized by this implementation task.

## Verification record
Latest checks: 29 unit/isolated SQL tests passed; TypeScript and repository ESLint passed; production webpack build passed. Final real PostgreSQL run applied both original V1 migrations unchanged plus V2, then accepted exactly one of eight simultaneous ten-person requests with a ten-person test quota. Anonymous RPC access and direct authenticated booking reads were denied. Local production HTTP smoke tests passed all five reserve/status locales, status-page privacy headers, liveness, unauthenticated staff rejection and invalid-token generic response. Secrets scan found no configured key matches in source candidates. These are local results, not remote V2 acceptance.
