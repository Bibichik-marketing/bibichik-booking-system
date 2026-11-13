-- REVIEW REQUIRED. Local tests only; do not apply automatically to any remote project.
-- Soft archive is deliberately absent from capacity/timeline calculations: commitments remain intact.
begin;
do $$ begin if current_user<>'postgres' then raise exception 'Migration requires postgres';end if;end $$;
create table booking_private.reservation_archives(
 reservation_id uuid primary key references public.reservations(id) on delete restrict,
 archived_by uuid not null references auth.users(id) on delete restrict,
 archived_at timestamptz not null,
 status_at_archive text not null check(status_at_archive in ('Completed','Cancelled','Rejected','Declined','Expired','No-show'))
);
alter table booking_private.reservation_archives owner to postgres;
alter table booking_private.reservation_archives enable row level security;
revoke all on table booking_private.reservation_archives from public,anon,authenticated,service_role;

create function public.staff_archive_capability_v2() returns boolean language plpgsql security definer set search_path='' as $$
declare m public.staff_members%rowtype;
begin
 select * into m from public.staff_members where user_id=auth.uid() and active;
 if not found then raise exception 'Forbidden';end if;
 return m.role='admin';
end $$;

create function public.staff_archive_reservation_v2(booking_id uuid,expected_version bigint,expected_reference text) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;actor uuid;outlet text;decision timestamptz;effective_status text;
begin
 -- Verify the caller before looking up any reservation, then follow the shared outlet -> row lock order.
 if expected_version is null or expected_version<1 or expected_reference is null then raise exception 'Invalid archive request';end if;
 actor:=booking_private.staff(null,true);
 select outlet_id into outlet from public.reservations where id=booking_id;
 if not found then raise exception 'Reservation not found';end if;
 perform booking_private.lock_outlet(outlet);
 select * into r from public.reservations where id=booking_id for update;
 if not found then raise exception 'Reservation not found';end if;
 actor:=booking_private.staff(null,true);
 decision:=pg_catalog.clock_timestamp();
 if r.row_version<>expected_version or r.reference is distinct from expected_reference then raise exception 'Booking changed; refresh';end if;
 if exists(select 1 from booking_private.reservation_archives where reservation_id=booking_id) then raise exception 'Already archived';end if;
 effective_status:=case when r.v2 and r.status='Pending' and r.pending_expires_at<=decision then 'Expired' else r.status end;
 if effective_status not in ('Completed','Cancelled','Rejected','Declined','Expired','No-show') then raise exception 'Cancel active reservations before deleting';end if;
 insert into booking_private.reservation_archives(reservation_id,archived_by,archived_at,status_at_archive) values(r.id,actor,decision,effective_status);
 -- No change to status, released_at, scheduled times, guests or row_version: capacity is identical.
 update booking_private.status_tokens set revoked_at=coalesce(revoked_at,decision) where reservation_id=r.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,at,details)
 values(r.id,r.outlet_id,'Archived',actor,decision,jsonb_build_object('status',effective_status,'operation','soft_delete'));
end $$;

create or replace function public.staff_reservations() returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.staff_members%rowtype;result jsonb;
begin
 select * into m from public.staff_members where user_id=auth.uid() and active;if not found then raise exception 'Forbidden';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'created_at',r.created_at,'source',r.source,'outlet_id',r.outlet_id,'customer_name',r.customer_name,'phone',r.phone,'email',r.email,'reservation_date',r.reservation_date,'reservation_time',r.reservation_time,'guests',r.guests,'special_requests',r.special_requests,'status',case when r.v2 and r.status='Pending' and r.pending_expires_at<=clock_timestamp() then 'Expired' else r.status end,'pending_expires_at',r.pending_expires_at,'needs_attention',r.needs_attention,'row_version',r.row_version) order by r.reservation_date desc,r.reservation_time),'[]') into result from public.reservations r where (m.role='admin' or r.outlet_id=m.outlet_id) and not exists(select 1 from booking_private.reservation_archives a where a.reservation_id=r.id);
 return result;
end $$;

create or replace function public.booking_status_v2(token_hash text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('firstName',r.customer_first_name,'reference',r.reference,'outlet',r.outlet_id,'date',r.reservation_date,'time',r.reservation_time,'guests',r.guests,'status',case when r.status='Pending' and r.pending_expires_at<=clock_timestamp() then 'Expired' else r.status end)
 from booking_private.status_tokens t join public.reservations r on r.id=t.reservation_id
 where not exists(select 1 from booking_private.reservation_archives a where a.reservation_id=r.id) and t.token_hash=booking_status_v2.token_hash and t.revoked_at is null and t.expires_at>clock_timestamp()
$$;

alter function public.staff_archive_capability_v2() owner to postgres;
alter function public.staff_archive_reservation_v2(uuid,bigint,text) owner to postgres;
revoke all on function public.staff_archive_capability_v2(),public.staff_archive_reservation_v2(uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.staff_archive_capability_v2(),public.staff_archive_reservation_v2(uuid,bigint,text) to authenticated;
-- Reassert existing RPC permissions explicitly; no reliance on creator Default ACLs.
revoke all on function public.staff_reservations(),public.booking_status_v2(text) from public,anon,authenticated,service_role;
grant execute on function public.staff_reservations() to authenticated;
grant execute on function public.booking_status_v2(text) to service_role;
commit;
