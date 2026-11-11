-- Apply AFTER reservations.sql, in a test project first.
begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
-- Resolve extension operator classes during DDL only; RPC paths remain empty.
set local search_path = pg_catalog, public, extensions;
-- Reject overlapping enabled services per outlet, including different start times.
-- Adjacent intervals are allowed. All slots at an outlet share physical capacity.
alter table public.reservation_slots add constraint no_overlapping_enabled_slots
 exclude using gist (outlet_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (enabled);
create table public.staff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','outlet_staff')),
 outlet_id text check(outlet_id in ('bibichik-ss2','bibichik-sunway-163')),
 active boolean not null default true,
 check(role='admin' or outlet_id is not null)
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from public,anon,authenticated;
alter table public.reservations add column source text not null default 'Online' check(source in ('Online','Phone','Walk-in'));
create index reservations_slot_status on public.reservations(slot_id,status);
create index reservations_date_outlet on public.reservations(reservation_date,outlet_id);
create function public.staff_reservations() returns jsonb language plpgsql security definer set search_path = '' as $$
declare member public.staff_members%rowtype; result jsonb;
begin
 select * into member from public.staff_members where user_id=auth.uid() and active;
 if not found then raise exception 'Forbidden'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) - 'request_payload' order by r.reservation_date desc,r.reservation_time),'[]') into result
 from public.reservations r where member.role='admin' or r.outlet_id=member.outlet_id;
 return result;
end $$;
create function public.staff_set_status(booking_id uuid,next_status text,expected_status text) returns void language plpgsql security definer set search_path = '' as $$
declare member public.staff_members%rowtype; r public.reservations%rowtype;
begin
 select * into member from public.staff_members where user_id=auth.uid() and active;
 if not found then raise exception 'Forbidden'; end if;
 select * into r from public.reservations where id=booking_id for update;
 if not found or (member.role<>'admin' and r.outlet_id<>member.outlet_id) then raise exception 'Forbidden'; end if;
 if r.status<>expected_status then raise exception 'Booking changed; refresh'; end if;
 if not ((r.status='Pending' and next_status in ('Confirmed','Declined','Cancelled')) or (r.status='Confirmed' and next_status in ('Seated','Cancelled','No-show')) or (r.status='Seated' and next_status='Completed')) then raise exception 'Invalid transition'; end if;
 -- Only release capacity or move between capacity-consuming statuses; no reactivation.
 update public.reservations set status=next_status where id=r.id;
end $$;
create function public.staff_manual_reservation(payload jsonb,source text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare member public.staff_members%rowtype; result jsonb;
begin
 select * into member from public.staff_members where user_id=auth.uid() and active;
 if not found or (member.role<>'admin' and member.outlet_id is distinct from payload->>'outletId') then raise exception 'Forbidden'; end if;
 if source is null or source not in ('Phone','Walk-in') then raise exception 'Invalid source'; end if;
 result:=public.request_reservation(payload);
 update public.reservations r set source=staff_manual_reservation.source where r.id=(payload->>'id')::uuid;
 return result;
end $$;
revoke all on function public.staff_reservations(),public.staff_set_status(uuid,text,text),public.staff_manual_reservation(jsonb,text) from public,anon,authenticated;
grant execute on function public.staff_reservations(),public.staff_set_status(uuid,text,text),public.staff_manual_reservation(jsonb,text) to authenticated;
commit;
