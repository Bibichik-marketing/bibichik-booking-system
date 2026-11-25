# Customer and Staff UX/session update — release review

## Scope and safety

This change is backward-compatible application code plus a **review-only** SQL proposal. No Production/Staging connection, Auth setting change, migration, booking switch change, schedule/capacity change or GoDaddy publication is part of this work. Aburii is outside scope and untouched. Original V1, V2 and archive migration files are unchanged.

## Full Name

The customer/manual form has exactly one required Full Name input using the existing `name` payload, `customer_name` storage, Staff views and WhatsApp confirmation. Existing schema validation, phone/email/consent and booking workflow remain. The optional legacy `firstName` API field remains compatible; the new form derives a short privacy-compatible display name without asking for another input. Unicode is preserved, and the derived value respects the existing 60 UTF-16-unit limit without splitting characters. Names are never saved to browser storage.

The private status page currently exposes `firstName` only. At the user's request, `supabase/proposals/customer_status_full_name.sql` proposes adding `fullName` to the existing response while preserving the old field, expiry, revocation, archive filtering and service-role-only EXECUTE. **It was not executed, including in tests, and is intentionally outside migrations/.** The UI supports both responses and keeps the legacy display-name fallback until separate privacy/SQL approval. Showing Full Name on private links therefore remains pending that approval; no schema change is required for the booking form itself.

## Roles and daily workflow

The authenticated profile endpoint uses the existing active-membership capability RPC; outlet staff scopes are independently verified through existing authorized read-only timeline RPCs, including when there are no bookings. No new database grant/RPC is required. Profile data is not supplied by the browser or inferred from customer rows.

Regular staff navigation contains Overview, Today's Reservations and Pending Approvals. Manual entry is restricted in the UI to authorized outlets. Admin-only settings, timeline navigation, telephone changes, archive and audit controls are absent for regular staff. The audit API additionally requires the existing Admin capability, while underlying database/outlet permissions remain unchanged. Existing manual original-phone recovery permissions are preserved in an optional disclosure. Date/time/party edits and status actions remain available within existing server/database rules. Polling responses from an older login/logout epoch cannot restore signed-out UI.

Reservation tools are collapsed initially; empty detail paragraphs are omitted. Phone navigation wraps into a compact grid, and calendar/table scrolling stays inside its existing container. Existing colors, fonts and component styles are retained.

## Stay signed in

The checkbox defaults on. Supabase Auth password and refresh endpoints are called only from the server; every protected request validates the user through `/auth/v1/user`, and every booking RPC retains its own active-membership/outlet authorization.

- Checked: host-only HttpOnly, Secure-in-Production, SameSite=Strict cookies. The refresh credential is AES-256-GCM encrypted with a contextual key derived server-side from the existing service-role secret. No new environment variable is needed; no token/password is placed in JSON, localStorage or sessionStorage.
- Persistent sessions have an absolute application limit of **30 days**, not renewed by refresh. Unchecked sessions use cookies without Max-Age/Expires and an application limit of **12 hours**. Supabase's own expiry/revocation settings can end either earlier.
- Refresh rotates access/refresh credentials server-side. Concurrent in-process rotations are coalesced; cross-instance handling also relies on Supabase's refresh reuse protections. Auth outages retain credentials for retry; revoked/invalid/exhausted sessions clear cookies and return to sign-in.
- Manual sign-out revokes the current Supabase session (`scope=local`) and clears both cookies. Local cookies are still cleared if Auth is unavailable; remote revocation cannot be guaranteed during an outage.
- Existing access-cookie-only sessions remain supported until their original expiry; persistence requires the next sign-in. Rotating the server encryption secret invalidates saved encrypted sessions and requires sign-in again.
- Browser privacy settings and session-restore features can remove persistent cookies or restore session-only cookies. Full physical browser restart/close behavior must be checked on the target devices; no client can guarantee that session cookies disappear when an OS restores a browser session.

Reference: [Supabase server-side session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [refresh/reuse and session limits](https://supabase.com/docs/guides/auth/sessions), [local sign-out](https://supabase.com/docs/guides/auth/signout).

## Validation and remaining acceptance

Automated tests cover secure cookie policy, encrypted/tampered credentials, absolute expiry, restart-style access-cookie absence, refresh/revocation/outage behavior, current-user verification, concurrent refresh, local logout, Admin vs staff profiles/audit API, single-name payloads, all language labels, old/new status-response rendering, and isolated database storage/idempotency/capacity/outlet compatibility.

Browser tests use an isolated local copy with fictional Auth and booking endpoints, no environment files, and outbound-network blocking. They exercise actual application forms, HTTP cookies and APIs, rather than contacting Production. Admin and both outlet roles, refresh/logout, three Staff languages, five Customer languages and 320/375/390/430/768/1024/1440 layouts passed. Physical iPhone Safari/Android browser testing and a real Supabase-authenticated Staging acceptance pass remain before Live publication. The Full Name SQL proposal requires separate review and must not be run automatically.
