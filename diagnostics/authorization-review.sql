-- READ ONLY. Review in the private Supabase SQL Editor. No grants or changes.
select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer, p.proconfig,
 pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('staff_reservations','staff_set_status','staff_manual_reservation');
-- Check each TEST account privately. Replace the placeholder locally, never share email.
-- This only returns linkage booleans and role/outlet labels, not identities.
select count(*) as matched_users,
 count(m.user_id) as linked_members,
 coalesce(bool_and(m.active),false) as active,
 array_agg(distinct m.role) as roles,
 array_agg(distinct m.outlet_id) as outlets
from auth.users u left join public.staff_members m on m.user_id=u.id
where u.email='REPLACE_WITH_TEST_ACCOUNT_EMAIL_LOCALLY';
