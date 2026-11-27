-- REVIEW ONLY: apply separately after backup, restore rehearsal and explicit approval.
-- No historical rows, outlet settings, ACLs or legacy slots are updated.
begin;
set local lock_timeout='5s';
do $$ begin
 if current_user<>'postgres' then raise exception 'Migration requires postgres';end if;
 if not exists(select 1 from pg_catalog.pg_proc where oid='booking_private.capacity(text,timestamptz,integer,timestamptz,uuid)'::regprocedure and pg_catalog.pg_get_userbyid(proowner)='postgres' and not prosecdef and proconfig @> array['search_path=""'] and md5(btrim(regexp_replace(prosrc,'[[:space:]]+',' ','g')))='6a740cd6af859ec2a0ed5d86b25a0db5') then raise exception 'Unreviewed capacity dependency';end if;
 if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.reservations'::regclass and conname='reservations_guests_check' and pg_catalog.pg_get_constraintdef(oid)='CHECK (((guests >= 1) AND (guests <= 10)))') then raise exception 'Unreviewed guest constraint';end if;
end $$;
alter table public.reservations drop constraint reservations_guests_check;
alter table public.reservations add constraint reservations_guests_check check(guests between 1 and case when not v2 then 10 when outlet_id='bibichik-ss2' then 35 when outlet_id='bibichik-sunway-163' then 40 else 0 end);
create or replace function booking_private.capacity(outlet text,arrival timestamptz,party integer,decision timestamptz,exclude_id uuid default null) returns boolean language sql stable set search_path='' as $$
 with commitments as (
 select r.scheduled_start_at s,least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at)) e,r.guests g
 from public.reservations r where r.v2 and r.outlet_id=outlet and r.id is distinct from exclude_id
 and (r.status in ('Confirmed','Completed','No-show','Cancelled') or (r.status='Pending' and r.pending_expires_at>decision))
 and r.scheduled_start_at<arrival+interval '120 minutes' and r.scheduled_end_at>arrival and least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at))>arrival
 ),points as (select arrival p union select greatest(s,arrival) from commitments union select e from commitments where e<arrival+interval '120 minutes' union select starts_at from booking_private.quota_periods where outlet_id=outlet and starts_at>arrival and starts_at<arrival+interval '120 minutes' union select ends_at from booking_private.quota_periods where outlet_id=outlet and ends_at>arrival and ends_at<arrival+interval '120 minutes')
 select party between 1 and coalesce((select quota from booking_private.outlets where id=outlet),0) and not exists(select 1 from points where p>=arrival and p<arrival+interval '120 minutes' and party+coalesce((select sum(g) from commitments where s<=p and e>p),0)>least((select quota from booking_private.outlets where id=outlet),coalesce((select min(quota) from booking_private.quota_periods where outlet_id=outlet and starts_at<=p and ends_at>p),2147483647)))
$$;
commit;
