-- REVIEW ONLY. Do not apply remotely without separate approval and backup/preflight.
-- No new table or historical-row changes. Customer-visible reason is in events.details.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'Migration requires postgres';end if;
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid='booking_private.transition(uuid,text,text,boolean)'::regprocedure and pg_catalog.pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.proconfig @> array['search_path=""'] and md5(btrim(regexp_replace(p.prosrc,'[[:space:]]+',' ','g')))='cb837009233daa23a7e00cb48dd5613c') then raise exception 'Unreviewed transition dependency';end if;
end $$;
create or replace function booking_private.transition(booking_id uuid,next_status text,expected_status text,verified_no_show boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;outlet text;actor uuid;decision timestamptz;n text:=case when next_status='Declined' then 'Rejected' else next_status end;
begin
 if n='Rejected' then raise exception using errcode='PBR01',message='Rejection reason required';end if;
 select outlet_id into outlet from public.reservations where id=booking_id;actor:=booking_private.staff(outlet);perform booking_private.lock_outlet(outlet);decision:=clock_timestamp();
 select * into r from public.reservations where id=booking_id for update;
 if not r.v2 then raise exception 'Legacy record requires reconciliation';end if;
 if r.status='Pending' and r.pending_expires_at<=decision then raise exception 'Pending expired';end if;
 if r.status<>expected_status then raise exception 'Booking changed; refresh';end if;
 if not ((r.status='Pending' and n in ('Confirmed','Rejected','Cancelled')) or (r.status='Confirmed' and n in ('Cancelled','No-show','Completed'))) then raise exception 'Invalid transition';end if;
 if n='Confirmed' then
 if exists(select 1 from booking_private.closures where outlet_id=outlet and active and starts_at<r.scheduled_end_at and ends_at>r.scheduled_start_at) then raise exception 'Special closure';end if;
 if not booking_private.capacity(outlet,r.scheduled_start_at,r.guests,decision,r.id) then raise exception 'Capacity exceeded';end if;
 end if;
 if n='No-show' and (not verified_no_show or decision<r.scheduled_start_at+interval '15 minutes') then raise exception 'Grace period';end if;
 update public.reservations set status=n,confirmed_by=case when n='Confirmed' then actor else confirmed_by end,released_at=case when n='Rejected' or (n='Cancelled' and decision<scheduled_start_at) then decision else released_at end,row_version=row_version+1 where id=r.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,details) values(r.id,outlet,n,actor,jsonb_build_object('previous',r.status,'verifiedNoShow',verified_no_show));
end $$;
alter function booking_private.transition(uuid,text,text,boolean) owner to postgres;
revoke all on function booking_private.transition(uuid,text,text,boolean) from public,anon,authenticated,service_role;

create function public.staff_rejection_reason_capability_v2() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active) then raise exception 'Forbidden';end if;
 return true;
end $$;

create function public.staff_reject_reservation_v2(booking_id uuid,expected_version bigint,rejection_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;outlet text;actor uuid;decision timestamptz;
begin
 -- Unicode whitespace/zero-width-only strings are invalid. Preserve valid text verbatim.
 if rejection_reason is null or char_length(rejection_reason)>500 or rejection_reason !~ U&'[^\0009-\000D\0020\0085\00A0\1680\2000-\200D\2028\2029\202F\205F\3000\FEFF]' or rejection_reason ~ U&'[\0001-\0008\000B\000C\000E-\001F\007F]' then raise exception using errcode='PBR01',message='Valid rejection reason required';end if;
 if expected_version is null or expected_version<1 then raise exception using errcode='PBC03',message='Booking changed; refresh';end if;
 select outlet_id into outlet from public.reservations where id=booking_id;
 actor:=booking_private.staff(outlet);perform booking_private.lock_outlet(outlet);
 select * into r from public.reservations where id=booking_id for update;
 actor:=booking_private.staff(outlet);decision:=pg_catalog.clock_timestamp();
 if r.id is null or r.outlet_id is distinct from outlet or r.row_version<>expected_version or r.status is distinct from 'Pending' then raise exception using errcode='PBC03',message='Booking changed; refresh';end if;
 if not r.v2 or r.pending_expires_at is null or r.pending_expires_at<=decision or exists(select 1 from booking_private.reservation_archives where reservation_id=r.id) then raise exception using errcode='PBR02',message='Rejection unavailable';end if;
 update public.reservations set status='Rejected',released_at=decision,row_version=row_version+1 where id=r.id returning * into r;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,at,details)
 values(r.id,outlet,'Rejected',actor,decision,pg_catalog.jsonb_build_object('previous','Pending','reason',rejection_reason,'previousVersion',expected_version));
 -- Only customer-facing booking fields; no actor, private case references or internal metadata.
 return pg_catalog.jsonb_build_object('booking',pg_catalog.jsonb_build_object('id',r.id,'status',r.status,'reference',r.reference,'outlet_id',r.outlet_id,'reservation_date',r.reservation_date,'reservation_time',r.reservation_time,'guests',r.guests,'customer_name',r.customer_name,'phone',r.phone,'rejection_reason',rejection_reason));
end $$;

create function public.staff_rejection_history_v2(booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare outlet text;
begin
 select outlet_id into outlet from public.reservations where id=booking_id;
 perform booking_private.staff(outlet);
 if outlet is null then raise exception 'Forbidden';end if;
 return coalesce((select jsonb_agg(pg_catalog.jsonb_build_object('event',e.event,'reason',e.details->>'reason','at',e.at,'actor',e.actor) order by e.at desc,e.id desc) from booking_private.events e where e.reservation_id=booking_id and e.event='Rejected'),'[]'::jsonb);
end $$;

alter function public.staff_rejection_reason_capability_v2() owner to postgres;
alter function public.staff_reject_reservation_v2(uuid,bigint,text) owner to postgres;
alter function public.staff_rejection_history_v2(uuid) owner to postgres;
revoke all on function public.staff_rejection_reason_capability_v2(),public.staff_reject_reservation_v2(uuid,bigint,text),public.staff_rejection_history_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_rejection_reason_capability_v2(),public.staff_reject_reservation_v2(uuid,bigint,text),public.staff_rejection_history_v2(uuid) to authenticated;
commit;
