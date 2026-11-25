-- REVIEW ONLY. NOT EXECUTED. Deliberately outside migrations/ to prevent automatic application.
-- Privacy change: a valid private status link can disclose the full customer name.
-- Preserves firstName for older clients and all existing expiry/revocation/archive protections.
begin;
do $$ begin if current_user<>'postgres' then raise exception 'Reviewed postgres owner required';end if;end $$;
create or replace function public.booking_status_v2(token_hash text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('fullName',r.customer_name,'firstName',r.customer_first_name,'reference',r.reference,'outlet',r.outlet_id,'date',r.reservation_date,'time',r.reservation_time,'guests',r.guests,'status',case when r.status='Pending' and r.pending_expires_at<=clock_timestamp() then 'Expired' else r.status end)
 from booking_private.status_tokens t join public.reservations r on r.id=t.reservation_id
 where not exists(select 1 from booking_private.reservation_archives a where a.reservation_id=r.id) and t.token_hash=booking_status_v2.token_hash and t.revoked_at is null and t.expires_at>clock_timestamp()
$$;
alter function public.booking_status_v2(text) owner to postgres;
revoke all on function public.booking_status_v2(text) from public,anon,authenticated,service_role;
grant execute on function public.booking_status_v2(text) to service_role;
commit;
