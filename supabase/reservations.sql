-- First-run migration; apply atomically with a trusted owner in Supabase SQL editor.
-- SECURITY DEFINER RPCs intentionally mediate access to RLS-protected tables.
begin;
create table public.reservation_slots (
 id uuid primary key default pg_catalog.gen_random_uuid(), outlet_id text not null check(outlet_id in ('bibichik-ss2','bibichik-sunway-163')),
 starts_at timestamptz not null, ends_at timestamptz not null, period text not null check(period in ('Lunch','Dinner')),
 capacity integer not null check(capacity>0), max_guests integer not null default 10 check(max_guests between 1 and 10),
 enabled boolean not null default false, check(ends_at>starts_at), unique(outlet_id,starts_at)
);
create table public.reservations (
 id uuid primary key, reference text unique not null default ('BBC-'||pg_catalog.upper(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''))),
 slot_id uuid not null references public.reservation_slots, outlet_id text not null,
 customer_name text not null, phone text not null, email text, reservation_date date not null,reservation_time time not null,
 guests integer not null check(guests between 1 and 10), special_requests text,
 status text not null default 'Pending' check(status in ('Pending','Confirmed','Seated','Completed','Cancelled','Declined','No-show')),
 created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(), request_payload jsonb not null
);
alter table public.reservation_slots enable row level security;
alter table public.reservations enable row level security;
revoke all on public.reservation_slots,public.reservations from public,anon,authenticated;
create function public.reservation_availability(outlet text, day text, party integer) returns jsonb language sql security definer set search_path = '' as $$
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',s.id,'time',(s.starts_at at time zone 'Asia/Kuala_Lumpur')::time,'period',s.period) order by s.starts_at),'[]') from public.reservation_slots s
 where s.outlet_id=outlet and (s.starts_at at time zone 'Asia/Kuala_Lumpur')::date=day::date and s.enabled and s.starts_at>pg_catalog.now() and party between 1 and s.max_guests
 and s.capacity >= party+coalesce((select pg_catalog.sum(r.guests) from public.reservations r where r.slot_id=s.id and r.status in ('Pending','Confirmed','Seated','Completed')),0);
$$;
create function public.request_reservation(payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.reservation_slots%rowtype; r public.reservations%rowtype; used integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(payload->>'id',0));
 select * into r from public.reservations where id=(payload->>'id')::uuid;
 if found then
  if r.request_payload<>payload then raise exception 'Conflicting request'; end if;
  return pg_catalog.jsonb_build_object('reference',r.reference,'status',r.status);
 end if;
 select * into s from public.reservation_slots where id=(payload->>'slotId')::uuid for update;
 if not found or not s.enabled or s.starts_at<=pg_catalog.now() or s.outlet_id<>payload->>'outletId' or (s.starts_at at time zone 'Asia/Kuala_Lumpur')::date<>(payload->>'date')::date or (payload->>'guests')::integer not between 1 and s.max_guests then raise exception 'Unavailable'; end if;
 select coalesce(pg_catalog.sum(guests),0) into used from public.reservations where slot_id=s.id and status in ('Pending','Confirmed','Seated','Completed');
 if used+(payload->>'guests')::integer>s.capacity then raise exception 'Full'; end if;
 insert into public.reservations(id,slot_id,outlet_id,customer_name,phone,email,reservation_date,reservation_time,guests,special_requests,request_payload)
 values((payload->>'id')::uuid,s.id,s.outlet_id,payload->>'name',payload->>'phone',nullif(payload->>'email',''),(s.starts_at at time zone 'Asia/Kuala_Lumpur')::date,(s.starts_at at time zone 'Asia/Kuala_Lumpur')::time,(payload->>'guests')::integer,payload->>'requests',payload) returning * into r;
 return pg_catalog.jsonb_build_object('reference',r.reference,'status',r.status);
end $$;
create function public.reservation_updated() returns trigger language plpgsql security invoker set search_path = '' as $$ begin new.updated_at=pg_catalog.now(); return new; end $$;
create trigger reservation_updated before update on public.reservations for each row execute function public.reservation_updated();
revoke all on function public.reservation_availability(text,text,integer), public.request_reservation(jsonb) from public,anon,authenticated;
grant execute on function public.reservation_availability(text,text,integer), public.request_reservation(jsonb) to service_role;

-- Trigger execution does not require exposing this function as an RPC.
revoke all on function public.reservation_updated() from public,anon,authenticated;
commit;
