-- REVIEW REQUIRED. Separate additive migration; NOT applied to any hosted database.
-- Pending approvals and original V2 functions are unchanged. Reconfirmation is a fresh
-- immediate Staff approval subject to current Phone arrival rules (including exact
-- 30-minute lead), current operating rules, closures, pauses and overlapping capacity.
-- Never revive archived bookings or extend/reactivate private status tokens.
begin;
do $$ begin if current_user<>'postgres' then raise exception 'Migration requires postgres';end if;end $$;
create function public.staff_reconfirm_rejected_v2(booking_id uuid,expected_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;outlet text;actor uuid;decision timestamptz;current_rules bigint;
begin
 if booking_id is null or expected_version is null or expected_version<1 then
  raise exception using errcode='PBC03',message='Booking changed; refresh';
 end if;
 select outlet_id into outlet from public.reservations where id=booking_id;
 actor:=booking_private.staff(outlet);
 -- Same outlet -> row lock order and advisory key as creation, transition and settings.
 perform booking_private.lock_outlet(outlet);
 select * into r from public.reservations where id=booking_id for update;
 actor:=booking_private.staff(outlet);
 decision:=pg_catalog.clock_timestamp();
 if r.id is null or r.outlet_id is distinct from outlet or r.status is distinct from 'Rejected' or r.row_version<>expected_version then
  raise exception using errcode='PBC03',message='Booking changed; refresh';
 end if;
 if not r.v2 or exists(select 1 from booking_private.reservation_archives where reservation_id=r.id)
 or r.scheduled_start_at is distinct from ((r.reservation_date+r.reservation_time) at time zone 'Asia/Kuala_Lumpur')
 or r.scheduled_end_at is distinct from r.scheduled_start_at+interval '120 minutes' then
  raise exception using errcode='PBC02',message='Reconfirmation unavailable';
 end if;
 begin
  perform booking_private.validate_arrival(outlet,r.scheduled_start_at,decision,'Phone');
 exception when raise_exception then
  -- Fixed error category only. Never return customer records or arbitrary SQL messages.
  raise exception using errcode='PBC02',message='Reconfirmation unavailable';
 end;
 if not booking_private.capacity(outlet,r.scheduled_start_at,r.guests,decision,r.id) then
  raise exception using errcode='PBC01',message='Capacity exceeded';
 end if;
 select rules_version into current_rules from booking_private.outlets where id=outlet;
 -- Rejection released capacity. Remove that release only after every locked check passes.
 update public.reservations set status='Confirmed',released_at=null,confirmed_by=actor,
 row_version=row_version+1,rules_version=current_rules where id=r.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,at,details)
 values(r.id,outlet,'Reconfirmed',actor,decision,pg_catalog.jsonb_build_object(
  'previous','Rejected','next','Confirmed','operation','staff_status_correction',
  'previousVersion',r.row_version,'rulesVersion',current_rules));
 -- Existing status tokens, revocation, expiry, archive history and guest identity stay unchanged.
end $$;
alter function public.staff_reconfirm_rejected_v2(uuid,bigint) owner to postgres;
revoke all on function public.staff_reconfirm_rejected_v2(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.staff_reconfirm_rejected_v2(uuid,bigint) to authenticated;
commit;
