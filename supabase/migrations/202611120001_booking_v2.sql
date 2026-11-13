-- Apply only after verified backup/isolated restore. Existing slots stay unchanged.
begin;
do $$ begin if current_user<>'postgres' then raise exception 'Migration must run as reviewed postgres owner';end if;end $$;
create schema if not exists booking_private authorization postgres;
revoke all on schema booking_private from public,anon,authenticated,service_role;
create table booking_private.outlets(
 id text primary key check(id in ('bibichik-ss2','bibichik-sunway-163')),
 quota integer not null check(quota between 1 and case when id='bibichik-ss2' then 35 else 40 end), review_start time not null,
 booking_enabled boolean not null default false, paused boolean not null default false,
 check(review_start<'22:00'::time)
);
insert into booking_private.outlets(id,quota,review_start) values('bibichik-ss2',35,'11:00'),('bibichik-sunway-163',40,'10:30');
alter table booking_private.outlets add column first_arrival time not null default '10:30';
alter table booking_private.outlets add column last_lunch time not null default '14:30';
alter table booking_private.outlets add column dinner_start time not null default '17:00';
alter table booking_private.outlets add column last_dinner time not null default '20:00';
alter table booking_private.outlets add column operating_days integer[] not null default array[1,2,3,4,5,6,7];
alter table booking_private.outlets add column rules_version bigint not null default 1;
alter table booking_private.outlets add constraint valid_rule_windows check(first_arrival<=last_lunch and last_lunch+interval '120 minutes'<=dinner_start and dinner_start<=last_dinner and last_dinner<=time '20:00' and operating_days<@array[1,2,3,4,5,6,7] and cardinality(operating_days)>0);
update booking_private.outlets set first_arrival='11:00',last_lunch='13:00',dinner_start='17:30',operating_days=array[1,3,4,5,6,7] where id='bibichik-ss2';
create table booking_private.quota_periods(id uuid primary key default gen_random_uuid(),outlet_id text not null references booking_private.outlets,starts_at timestamptz not null,ends_at timestamptz not null,quota integer not null check(quota>0),check(ends_at>starts_at));
create table booking_private.closures(
 id uuid primary key default pg_catalog.gen_random_uuid(),outlet_id text not null references booking_private.outlets,
 starts_at timestamptz not null,ends_at timestamptz not null,active boolean not null default true,
 check(ends_at>starts_at)
);
alter table public.reservations add column scheduled_start_at timestamptz;
alter table public.reservations add column scheduled_end_at timestamptz;
alter table public.reservations add column pending_expires_at timestamptz;
alter table public.reservations add column confirmation_before timestamptz;
alter table public.reservations add column customer_first_name text;
alter table public.reservations add column recovery_phone_hash text;
alter table public.reservations add column released_at timestamptz;
alter table public.reservations add column created_by uuid;
alter table public.reservations add column confirmed_by uuid;
alter table public.reservations add column row_version bigint not null default 1;
alter table public.reservations add column needs_attention boolean not null default false;
alter table public.reservations add column rules_version bigint;
alter table public.reservations add column v2 boolean not null default false;
-- Preserve legacy status/source and data. Only explicit V2 operations use the new rules.
alter table public.reservations drop constraint reservations_status_check;
alter table public.reservations add constraint reservations_status_check check(status in ('Pending','Confirmed','Rejected','Cancelled','Expired','No-show','Completed','Declined','Seated'));
alter table public.reservations add constraint v2_interval check(not v2 or (scheduled_start_at is not null and scheduled_end_at=scheduled_start_at+interval '120 minutes'));
create index reservations_v2_outlet_time on public.reservations(outlet_id,scheduled_start_at,scheduled_end_at) where v2;
create index reservations_pending_expiry on public.reservations(pending_expires_at) where status='Pending';
create table booking_private.events(
 id bigint generated always as identity primary key,reservation_id uuid references public.reservations,
 outlet_id text not null,event text not null,actor uuid,at timestamptz not null default pg_catalog.clock_timestamp(),details jsonb not null default '{}'
);
create table booking_private.status_tokens(
 reservation_id uuid primary key references public.reservations,token_hash text unique not null,
 expires_at timestamptz not null,revoked_at timestamptz
);
create index events_reservation_at on booking_private.events(reservation_id,at);
-- Empty search paths and explicit ACLs; no reliance on Default ACL.
create function booking_private.staff(outlet text,admin_only boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.staff_members%rowtype;
begin
 select * into m from public.staff_members where user_id=auth.uid() and active;
 if not found or (admin_only and m.role<>'admin') or (m.role<>'admin' and m.outlet_id is distinct from outlet) then raise exception 'Forbidden';end if;
 return m.user_id;
end $$;
create function booking_private.lock_outlet(outlet text) returns void language plpgsql set search_path='' as $$ begin
 perform 1 from booking_private.outlets where id=outlet for update;
 if not found then raise exception 'Invalid outlet';end if;
end $$;
create function booking_private.open_day(outlet text,day date) returns boolean language sql stable set search_path='' as $$
 select coalesce((select extract(isodow from day)::integer=any(operating_days) from booking_private.outlets where id=outlet),false)
$$;
-- Advance a clock using actual review windows; closure intervals are subtracted exactly.
create function booking_private.review_until(outlet text,from_at timestamptz,minutes integer) returns timestamptz language plpgsql stable set search_path='' as $$
declare cursor_at timestamptz:=from_at;day date;ws timestamptz;we timestamptz;cut_at timestamptz;remaining interval:=pg_catalog.make_interval(mins=>minutes);c record;i integer;
begin
 for i in 1..400 loop
 day:=(cursor_at at time zone 'Asia/Kuala_Lumpur')::date;
 ws:=(day+(select review_start from booking_private.outlets where id=outlet)) at time zone 'Asia/Kuala_Lumpur';
 we:=(day+time '22:00') at time zone 'Asia/Kuala_Lumpur';
 cursor_at:=greatest(cursor_at,ws);
 if booking_private.open_day(outlet,day) and cursor_at<we then
 for c in select starts_at,ends_at from booking_private.closures where outlet_id=outlet and active and ends_at>cursor_at and starts_at<we order by starts_at loop
 cut_at:=least(c.starts_at,we);
 if cut_at>cursor_at then if cut_at-cursor_at>=remaining then return cursor_at+remaining;end if;remaining:=remaining-(cut_at-cursor_at);end if;
 cursor_at:=greatest(cursor_at,c.ends_at);
 end loop;
 if cursor_at<we then if we-cursor_at>=remaining then return cursor_at+remaining;end if;remaining:=remaining-(we-cursor_at);end if;
 end if;
 cursor_at:=((day+1)+time '00:00') at time zone 'Asia/Kuala_Lumpur';
 end loop;
 raise exception 'Review calendar unavailable';
end $$;
create function booking_private.validate_arrival(outlet text,arrival timestamptz,decision timestamptz,channel text) returns timestamptz language plpgsql stable set search_path='' as $$
declare d date:=(arrival at time zone 'Asia/Kuala_Lumpur')::date;t time:=(arrival at time zone 'Asia/Kuala_Lumpur')::time;first_time time;cutoff timestamptz;o booking_private.outlets%rowtype;
begin
 select * into o from booking_private.outlets where id=outlet;first_time:=o.first_arrival;
 if exists(select 1 from public.reservations where outlet_id=outlet and not v2 and status in ('Pending','Confirmed','Seated')) then raise exception 'Legacy reconciliation required';end if;
 if not o.booking_enabled or o.paused or not booking_private.open_day(outlet,d) or d>(decision at time zone 'Asia/Kuala_Lumpur')::date+30 or arrival<=decision
 or extract(second from t)<>0 or mod(extract(minute from t)::integer,30)<>0 then raise exception 'Unbookable arrival';end if;
 if not ((t>=first_time and t<=o.last_lunch) or (t>=o.dinner_start and t<=o.last_dinner)) then raise exception 'Outside service';end if;
 if exists(select 1 from booking_private.closures where outlet_id=outlet and active and starts_at<arrival+interval '120 minutes' and ends_at>arrival) then raise exception 'Special closure';end if;
 if arrival-decision<interval '30 minutes' then raise exception 'Submission lead time';end if;
 if channel='Phone' then return (case when t=first_time then arrival+interval '16 minutes' when t=first_time+interval '30 minutes' then arrival+interval '1 minute' else arrival-interval '30 minutes' end);end if;
 if t=first_time then
 -- Submission lead time is exact, independently of approval grace.
 if decision>arrival-interval '30 minutes' then raise exception 'Submission closed';end if;
 cutoff:=arrival+interval '16 minutes';
 elsif t=first_time+interval '30 minutes' then
 if decision>arrival-interval '30 minutes' then raise exception 'Submission closed';end if;
 cutoff:=arrival+interval '1 minute';
 else cutoff:=arrival-interval '30 minutes';
 if booking_private.review_until(outlet,decision,60)>cutoff then raise exception 'Insufficient review time';end if;
 end if;
 return cutoff;
end $$;
create function booking_private.capacity(outlet text,arrival timestamptz,party integer,decision timestamptz,exclude_id uuid default null) returns boolean language sql stable set search_path='' as $$
 with commitments as (
 select r.scheduled_start_at s,least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at)) e,r.guests g
 from public.reservations r where r.v2 and r.outlet_id=outlet and r.id is distinct from exclude_id
 and (r.status in ('Confirmed','Completed','No-show','Cancelled') or (r.status='Pending' and r.pending_expires_at>decision))
 and r.scheduled_start_at<arrival+interval '120 minutes' and r.scheduled_end_at>arrival and least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at))>arrival
 ),points as (select arrival p union select greatest(s,arrival) from commitments union select e from commitments where e<arrival+interval '120 minutes' union select starts_at from booking_private.quota_periods where outlet_id=outlet and starts_at>arrival and starts_at<arrival+interval '120 minutes' union select ends_at from booking_private.quota_periods where outlet_id=outlet and ends_at>arrival and ends_at<arrival+interval '120 minutes')
 select party between 1 and 10 and not exists(select 1 from points where p>=arrival and p<arrival+interval '120 minutes' and party+coalesce((select sum(g) from commitments where s<=p and e>p),0)>least((select quota from booking_private.outlets where id=outlet),coalesce((select min(quota) from booking_private.quota_periods where outlet_id=outlet and starts_at<=p and ends_at>p),2147483647)))
$$;
create function booking_private.expire(outlet text,decision timestamptz) returns void language plpgsql set search_path='' as $$
declare r record;
begin
 for r in update public.reservations set status='Expired',released_at=decision,row_version=row_version+1 where v2 and outlet_id=outlet and status='Pending' and pending_expires_at<=decision returning id loop
 insert into booking_private.events(reservation_id,outlet_id,event) values(r.id,outlet,'Expired');end loop;
end $$;
create function booking_private.create_booking(payload jsonb,channel text,confirm_now boolean,token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare outlet text:=payload->>'outletId';arrival timestamptz;r public.reservations%rowtype;decision timestamptz;cutoff timestamptz;actor uuid;slot uuid;expiry timestamptz;
begin
 if channel='Phone' then actor:=booking_private.staff(outlet);elsif channel<>'Online' then raise exception 'Invalid channel';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(payload->>'id',0));
 perform booking_private.lock_outlet(outlet);decision:=pg_catalog.clock_timestamp();
 select * into r from public.reservations where id=(payload->>'id')::uuid;
 if found then if r.request_payload<>payload then raise exception 'Conflicting retry';end if;return pg_catalog.jsonb_build_object('reference',r.reference,'status',r.status,'replayed',true);end if;
 if length(coalesce(payload->>'name','')) not between 2 and 100 or length(coalesce(payload->>'requests',''))>1000 or coalesce(payload->>'phone','') !~ '^(\+?60|0)1[0-9]{8,9}$' or coalesce((payload->>'consent')::boolean,false)=false then raise exception 'Invalid fields';end if;
 arrival:=((payload->>'date')::date+(payload->>'time')::time) at time zone 'Asia/Kuala_Lumpur';
 cutoff:=booking_private.validate_arrival(outlet,arrival,decision,channel);
 if not booking_private.capacity(outlet,arrival,(payload->>'guests')::integer,decision) then raise exception 'Capacity exceeded';end if;
 perform booking_private.expire(outlet,decision);
 -- Compatibility slot is DISABLED: V1 availability never exposes new overlapping arrivals.
 select id into slot from public.reservation_slots where outlet_id=outlet and starts_at=arrival;
 if slot is null then insert into public.reservation_slots(outlet_id,starts_at,ends_at,period,capacity,enabled) values(outlet,arrival,arrival+interval '120 minutes',case when (arrival at time zone 'Asia/Kuala_Lumpur')::time<time '16:30' then 'Lunch' else 'Dinner' end,1,false) returning id into slot;end if;
 expiry:=least(booking_private.review_until(outlet,decision,120),cutoff);
 if not confirm_now and expiry<=decision then raise exception 'No Pending review time remains; explicit immediate phone confirmation required';end if;
 insert into public.reservations(id,slot_id,outlet_id,customer_name,customer_first_name,phone,email,reservation_date,reservation_time,guests,special_requests,status,request_payload,scheduled_start_at,scheduled_end_at,pending_expires_at,confirmation_before,created_by,confirmed_by,source,v2)
 values((payload->>'id')::uuid,slot,outlet,payload->>'name',nullif(payload->>'firstName',''),payload->>'phone',nullif(payload->>'email',''),(payload->>'date')::date,(payload->>'time')::time,(payload->>'guests')::integer,payload->>'requests',case when channel='Phone' and confirm_now then 'Confirmed' else 'Pending' end,payload,arrival,arrival+interval '120 minutes',expiry,cutoff,actor,case when confirm_now then actor end,channel,true) returning * into r;
 update public.reservations set recovery_phone_hash=encode(sha256(convert_to(r.phone,'UTF8')),'hex'),rules_version=(select rules_version from booking_private.outlets where id=outlet) where id=r.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,details) values(r.id,outlet,r.status,actor,jsonb_build_object('rulesVersion',(select rules_version from booking_private.outlets where id=outlet)));
 if token_hash is not null then
 if token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash';end if;
 insert into booking_private.status_tokens values(r.id,token_hash,((r.reservation_date+1)+time '00:00') at time zone 'Asia/Kuala_Lumpur',null);end if;
 return pg_catalog.jsonb_build_object('reference',r.reference,'status',r.status,'id',r.id,'pendingExpiresAt',r.pending_expires_at);
end $$;
create function public.booking_create_v2(payload jsonb,token_hash text) returns jsonb language sql security definer set search_path='' as $$ select booking_private.create_booking(payload,'Online',false,token_hash) $$;
create function public.staff_phone_v2(payload jsonb,confirm_now boolean default false) returns jsonb language sql security definer set search_path='' as $$ select booking_private.create_booking(payload,'Phone',confirm_now,null) $$;
create or replace function public.request_reservation(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb:=payload;s public.reservation_slots%rowtype;
begin
 if not p?'time' then select * into s from public.reservation_slots where id=(p->>'slotId')::uuid;if not found or s.outlet_id<>p->>'outletId' then raise exception 'Invalid slot';end if;p:=p||pg_catalog.jsonb_build_object('time',(s.starts_at at time zone 'Asia/Kuala_Lumpur')::time);end if;
 return booking_private.create_booking(p,'Online',false,null);
end $$;
create or replace function public.staff_manual_reservation(payload jsonb,source text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb:=payload;s public.reservation_slots%rowtype;
begin if source<>'Phone' then raise exception 'Only phone bookings supported';end if;if not p?'time' then select * into s from public.reservation_slots where id=(p->>'slotId')::uuid;if not found or s.outlet_id<>p->>'outletId' then raise exception 'Invalid slot';end if;p:=p||jsonb_build_object('time',(s.starts_at at time zone 'Asia/Kuala_Lumpur')::time);end if;return public.staff_phone_v2(p,false);end $$;
create function booking_private.availability(outlet text,day text,party integer,channel text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';t timestamp;arrival timestamptz;decision timestamptz:=pg_catalog.clock_timestamp();cutoff timestamptz;
begin
 for t in select generate_series(day::date+time '10:30',day::date+time '20:00',interval '30 minutes') loop
 arrival:=t at time zone 'Asia/Kuala_Lumpur';
 begin cutoff:=booking_private.validate_arrival(outlet,arrival,decision,channel);exception when raise_exception then continue;end;
 if booking_private.capacity(outlet,arrival,party,decision) then result:=result||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',to_char(t,'HH24:MI'),'time',to_char(t,'HH24:MI'),'period',case when t::time<time '16:30' then 'Lunch' else 'Dinner' end));end if;
 end loop;return result;
end $$;
create or replace function public.reservation_availability(outlet text,day text,party integer) returns jsonb language sql security definer set search_path='' as $$ select booking_private.availability(outlet,day,party,'Online') $$;
create function public.staff_availability_v2(outlet text,day text,party integer) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform booking_private.staff(outlet);return booking_private.availability(outlet,day,party,'Phone');end $$;
create function public.staff_timeline_v2(outlet text,day text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;decision timestamptz:=clock_timestamp();
begin perform booking_private.staff(outlet);
 select jsonb_agg(jsonb_build_object('time',to_char(t,'HH24:MI'),'reservedPax',coalesce((select sum(r.guests) from public.reservations r where r.v2 and r.outlet_id=outlet and r.scheduled_start_at<=t at time zone 'Asia/Kuala_Lumpur' and least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at))>t at time zone 'Asia/Kuala_Lumpur' and (r.status in ('Confirmed','Completed','Cancelled','No-show') or(r.status='Pending' and r.pending_expires_at>decision))),0),'quota',least((select quota from booking_private.outlets where id=outlet),coalesce((select min(quota) from booking_private.quota_periods where outlet_id=outlet and starts_at<=t at time zone 'Asia/Kuala_Lumpur' and ends_at>t at time zone 'Asia/Kuala_Lumpur'),2147483647))) order by t) into result from generate_series(day::date+time '10:30',day::date+time '22:00',interval '30 minutes') t;
 return result;
end $$;
revoke all on function public.staff_availability_v2(text,text,integer),public.staff_timeline_v2(text,text) from public,anon,authenticated,service_role;
grant execute on function public.staff_availability_v2(text,text,integer),public.staff_timeline_v2(text,text) to authenticated;
create or replace function public.staff_reservations() returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.staff_members%rowtype;result jsonb;
begin
 select * into m from public.staff_members where user_id=auth.uid() and active;if not found then raise exception 'Forbidden';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'created_at',r.created_at,'source',r.source,'outlet_id',r.outlet_id,'customer_name',r.customer_name,'phone',r.phone,'email',r.email,'reservation_date',r.reservation_date,'reservation_time',r.reservation_time,'guests',r.guests,'special_requests',r.special_requests,'status',case when r.v2 and r.status='Pending' and r.pending_expires_at<=clock_timestamp() then 'Expired' else r.status end,'pending_expires_at',r.pending_expires_at,'needs_attention',r.needs_attention,'row_version',r.row_version) order by r.reservation_date desc,r.reservation_time),'[]') into result from public.reservations r where m.role='admin' or r.outlet_id=m.outlet_id;
 return result;
end $$;
create function booking_private.transition(booking_id uuid,next_status text,expected_status text,verified_no_show boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;outlet text;actor uuid;decision timestamptz;n text:=case when next_status='Declined' then 'Rejected' else next_status end;
begin
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
create or replace function public.staff_set_status(booking_id uuid,next_status text,expected_status text) returns void language sql security definer set search_path='' as $$ select booking_private.transition(booking_id,next_status,expected_status,false) $$;
create function public.staff_status_v2(booking_id uuid,next_status text,expected_status text,verified_no_show boolean default false) returns void language sql security definer set search_path='' as $$ select booking_private.transition(booking_id,next_status,expected_status,verified_no_show) $$;
revoke all on function public.staff_status_v2(uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.staff_status_v2(uuid,text,text,boolean) to authenticated;
create function public.booking_status_v2(token_hash text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('firstName',r.customer_first_name,'reference',r.reference,'outlet',r.outlet_id,'date',r.reservation_date,'time',r.reservation_time,'guests',r.guests,'status',case when r.status='Pending' and r.pending_expires_at<=clock_timestamp() then 'Expired' else r.status end)
 from booking_private.status_tokens t join public.reservations r on r.id=t.reservation_id
 where t.token_hash=booking_status_v2.token_hash and t.revoked_at is null and t.expires_at>clock_timestamp()
$$;
create table booking_private.link_verifications(
 id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.reservations,
 actor uuid not null,phone_hash text not null,booking_version bigint not null,
 method text not null check(method in ('original_phone_callback','original_whatsapp_reply')),
 evidence_ref uuid not null,created_at timestamptz not null,expires_at timestamptz not null,consumed_at timestamptz
);
-- This is an attributed manual attestation, NOT proof of phone possession.
create function public.staff_record_link_verification_v2(booking_id uuid,expected_version bigint,method text,evidence_ref uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;actor uuid;verification uuid;decision timestamptz;
begin
 select * into r from public.reservations where id=booking_id;actor:=booking_private.staff(r.outlet_id);perform booking_private.lock_outlet(r.outlet_id);
 select * into r from public.reservations where id=booking_id for update;decision:=clock_timestamp();
 if not r.v2 or r.row_version<>expected_version or r.recovery_phone_hash is distinct from encode(sha256(convert_to(r.phone,'UTF8')),'hex') then raise exception 'Recovery contact requires Admin reconciliation';end if;
 if method is null or method not in ('original_phone_callback','original_whatsapp_reply') or evidence_ref is null then raise exception 'Original phone workflow required';end if;
 insert into booking_private.link_verifications(reservation_id,actor,phone_hash,booking_version,method,evidence_ref,created_at,expires_at) values(r.id,actor,r.recovery_phone_hash,r.row_version,method,evidence_ref,decision,decision+interval '10 minutes') returning id into verification;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,details) values(r.id,r.outlet_id,'Recovery manually attested',actor,jsonb_build_object('verificationId',verification,'method',method,'evidenceRef',evidence_ref,'assurance','staff_attestation_not_possession_proof'));
 return verification;
end $$;
create function public.staff_regenerate_link_v2(booking_id uuid,verification_id uuid,token_hash text) returns text language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;v booking_private.link_verifications%rowtype;actor uuid;decision timestamptz;
begin
 select * into r from public.reservations where id=booking_id;actor:=booking_private.staff(r.outlet_id);perform booking_private.lock_outlet(r.outlet_id);
 select * into r from public.reservations where id=booking_id for update;decision:=clock_timestamp();
 select * into v from booking_private.link_verifications where id=verification_id for update;
 if not found or v.reservation_id<>r.id or v.actor<>actor or v.consumed_at is not null or v.expires_at<=decision or v.booking_version<>r.row_version or v.phone_hash is distinct from r.recovery_phone_hash or v.phone_hash is distinct from encode(sha256(convert_to(r.phone,'UTF8')),'hex') then raise exception 'Original phone verification required';end if;
 if r.phone !~ '^(0|\+?60)(11[0-9]{8}|1[02-9][0-9]{7})$' then raise exception 'Registered mobile requires Admin reconciliation';end if;
 if token_hash is null or token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash';end if;
 if ((r.reservation_date+1)+time '00:00') at time zone 'Asia/Kuala_Lumpur'<=decision then raise exception 'Reservation link date expired';end if;
 insert into booking_private.status_tokens values(r.id,token_hash,((r.reservation_date+1)+time '00:00') at time zone 'Asia/Kuala_Lumpur',null) on conflict(reservation_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked_at=null;
 update booking_private.link_verifications set consumed_at=decision where id=v.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,details) values(r.id,r.outlet_id,'Link regenerated',actor,jsonb_build_object('verificationId',v.id,'delivery','manual_original_registered_whatsapp','assurance','staff_attestation_not_possession_proof'));
 return r.phone;
end $$;
-- Legacy 3-argument endpoint can revoke, never regenerate or bypass verification.
create function public.staff_link_v2(booking_id uuid,operation text,token_hash text default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;actor uuid;
begin
 if operation is distinct from 'revoke' then raise exception 'Original phone workflow required';end if;
 select * into r from public.reservations where id=booking_id;actor:=booking_private.staff(r.outlet_id);perform booking_private.lock_outlet(r.outlet_id);
 update booking_private.status_tokens set revoked_at=clock_timestamp() where reservation_id=r.id;
 insert into booking_private.events(reservation_id,outlet_id,event,actor) values(r.id,r.outlet_id,'Link revoked',actor);
end $$;
alter table booking_private.link_verifications enable row level security;
revoke all on function public.staff_record_link_verification_v2(uuid,bigint,text,uuid),public.staff_regenerate_link_v2(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.staff_record_link_verification_v2(uuid,bigint,text,uuid),public.staff_regenerate_link_v2(uuid,uuid,text) to authenticated;
create function public.staff_settings_v2(outlet text,changes jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;peak integer;
begin
 actor:=booking_private.staff(outlet,changes is not null);perform booking_private.lock_outlet(outlet);
 if changes is not null then
 if changes?'quota' then
 if (changes->>'quota')::integer < 1 or (changes->>'quota')::integer > (case when outlet='bibichik-ss2' then 35 else 40 end) then raise exception 'Invalid quota';end if;
 if changes?'quotaStart' and ((changes->>'quotaStart')::timestamptz<clock_timestamp() or not changes?'quotaEnd' or (changes->>'quotaEnd')::timestamptz<=(changes->>'quotaStart')::timestamptz) then raise exception 'Invalid quota period';end if;
 select coalesce(max((select coalesce(sum(r.guests),0) from public.reservations r where r.v2 and r.outlet_id=outlet and r.scheduled_start_at<=p and least(r.scheduled_end_at,coalesce(r.released_at,r.scheduled_end_at))>p and (r.status in ('Confirmed','Completed','Cancelled','No-show') or (r.status='Pending' and r.pending_expires_at>clock_timestamp())))),0) into peak from (
 select greatest(scheduled_start_at,coalesce((changes->>'quotaStart')::timestamptz,statement_timestamp())) p from public.reservations where v2 and outlet_id=outlet and scheduled_end_at>coalesce((changes->>'quotaStart')::timestamptz,statement_timestamp()) and scheduled_start_at<coalesce((changes->>'quotaEnd')::timestamptz,'infinity'::timestamptz)
 union select coalesce((changes->>'quotaStart')::timestamptz,statement_timestamp())) points;
 if (changes->>'quota')::integer<peak then raise exception 'Quota below existing commitments';end if;
 if changes?'quotaStart' then insert into booking_private.quota_periods(outlet_id,starts_at,ends_at,quota) values(outlet,(changes->>'quotaStart')::timestamptz,(changes->>'quotaEnd')::timestamptz,(changes->>'quota')::integer);
 else update booking_private.outlets set quota=(changes->>'quota')::integer where id=outlet;end if;
 end if;
 if changes?'reviewStart' or changes?'operatingDays' or changes?'firstArrival' or changes?'lastLunch' or changes?'dinnerStart' or changes?'lastDinner' then
 update booking_private.outlets set review_start=coalesce((changes->>'reviewStart')::time,review_start),first_arrival=coalesce((changes->>'firstArrival')::time,first_arrival),last_lunch=coalesce((changes->>'lastLunch')::time,last_lunch),dinner_start=coalesce((changes->>'dinnerStart')::time,dinner_start),last_dinner=coalesce((changes->>'lastDinner')::time,last_dinner),operating_days=case when changes?'operatingDays' then array(select jsonb_array_elements_text(changes->'operatingDays')::integer) else operating_days end,rules_version=rules_version+1 where id=outlet;
 end if;
 if changes?'paused' then update booking_private.outlets set paused=(changes->>'paused')::boolean where id=outlet;end if;
 -- Enabling is a separate owner-approved launch action; not exposed in settings.
 if changes?'closureStart' then
 insert into booking_private.closures(outlet_id,starts_at,ends_at) values(outlet,(changes->>'closureStart')::timestamptz,(changes->>'closureEnd')::timestamptz);
 update public.reservations set needs_attention=true where outlet_id=outlet and v2 and scheduled_start_at<(changes->>'closureEnd')::timestamptz and scheduled_end_at>(changes->>'closureStart')::timestamptz and status in ('Pending','Confirmed');end if;
 if changes?'reopen' then update booking_private.closures set active=false where id=(changes->>'reopen')::uuid and outlet_id=outlet;end if;
 insert into booking_private.events(outlet_id,event,actor,details) values(outlet,'Settings changed',actor,changes);
 end if;
 return (select to_jsonb(o)||jsonb_build_object('quotaPeriods',coalesce((select jsonb_agg(to_jsonb(q)) from booking_private.quota_periods q where q.outlet_id=outlet),'[]'),'closures',coalesce((select jsonb_agg(to_jsonb(c)) from booking_private.closures c where c.outlet_id=outlet),'[]')) from booking_private.outlets o where o.id=outlet);
end $$;
create function public.staff_audit_v2(booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare outlet text;
begin select outlet_id into outlet from public.reservations where id=booking_id;perform booking_private.staff(outlet);return (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from booking_private.events e where reservation_id=booking_id);end $$;
create function public.staff_edit_v2(booking_id uuid,expected_version bigint,changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype;actor uuid;decision timestamptz;arrival timestamptz;party integer;cutoff timestamptz;
begin
 select * into r from public.reservations where id=booking_id;
 actor:=booking_private.staff(r.outlet_id,changes?'phone');perform booking_private.lock_outlet(r.outlet_id);decision:=clock_timestamp();
 select * into r from public.reservations where id=booking_id for update;
 if not r.v2 or r.row_version<>expected_version or r.status not in ('Pending','Confirmed') or (r.status='Pending' and r.pending_expires_at<=decision) then raise exception 'Stale or terminal reservation';end if;
 if r.status='Confirmed' and decision>=r.scheduled_start_at and (changes?'date' or changes?'time' or changes?'guests') then raise exception 'Started commitment cannot be rescheduled or resized; create a separate booking';end if;
 if changes?'outletId' then raise exception 'Outlet transfer not supported';end if;
 arrival:=case when changes?'date' or changes?'time' then (coalesce(changes->>'date',r.reservation_date::text)::date+coalesce(changes->>'time',r.reservation_time::text)::time) at time zone 'Asia/Kuala_Lumpur' else r.scheduled_start_at end;
 party:=coalesce((changes->>'guests')::integer,r.guests);
 if changes?'date' or changes?'time' or changes?'guests' then
 cutoff:=booking_private.validate_arrival(r.outlet_id,arrival,decision,case when r.status='Confirmed' then 'Phone' else r.source end);
 else cutoff:=r.confirmation_before;end if;
 if not booking_private.capacity(r.outlet_id,arrival,party,decision,r.id) then raise exception 'Capacity exceeded';end if;
 if changes?'phone' and changes->>'phone' !~ '^(\+?60|0)1[0-9]{8,9}$' then raise exception 'Invalid phone';end if;
 update public.reservations set scheduled_start_at=arrival,scheduled_end_at=arrival+interval '120 minutes',reservation_date=(arrival at time zone 'Asia/Kuala_Lumpur')::date,reservation_time=(arrival at time zone 'Asia/Kuala_Lumpur')::time,guests=party,phone=coalesce(changes->>'phone',phone),confirmation_before=case when r.status='Pending' then least(r.confirmation_before,cutoff) else confirmation_before end,pending_expires_at=case when r.status='Pending' then least(r.pending_expires_at,cutoff) else pending_expires_at end,row_version=row_version+1 where id=r.id;
 update booking_private.status_tokens set expires_at=(((arrival at time zone 'Asia/Kuala_Lumpur')::date+1)+time '00:00') at time zone 'Asia/Kuala_Lumpur' where reservation_id=r.id and revoked_at is null and expires_at>decision;
 insert into booking_private.events(reservation_id,outlet_id,event,actor,details) values(r.id,r.outlet_id,'Edited',actor,jsonb_build_object('previousStart',r.scheduled_start_at,'previousGuests',r.guests,'contactChanged',changes?'phone'));
end $$;
create function public.booking_expire_v2() returns void language plpgsql security definer set search_path='' as $$
declare o record;
begin for o in select id from booking_private.outlets order by id loop perform booking_private.lock_outlet(o.id);perform booking_private.expire(o.id,clock_timestamp());end loop;end $$;
revoke all on function public.staff_edit_v2(uuid,bigint,jsonb),public.booking_expire_v2() from public,anon,authenticated,service_role;
grant execute on function public.staff_edit_v2(uuid,bigint,jsonb) to authenticated;
grant execute on function public.booking_expire_v2() to service_role;
create function public.booking_health_v2() returns boolean language sql security definer set search_path='' as $$ select count(*)=2 from booking_private.outlets $$;
revoke all on function public.booking_health_v2() from public,anon,authenticated,service_role;
grant execute on function public.booking_health_v2() to service_role;
-- Default ACL hardening for every object, including sequences and future-creator grants.
alter table booking_private.outlets enable row level security;
alter table booking_private.quota_periods enable row level security;
alter table booking_private.closures enable row level security;
alter table booking_private.events enable row level security;
alter table booking_private.status_tokens enable row level security;
revoke all on all tables in schema booking_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema booking_private from public,anon,authenticated,service_role;
revoke all on all functions in schema booking_private from public,anon,authenticated,service_role;
revoke all on function public.booking_create_v2(jsonb,text),public.booking_status_v2(text),public.staff_phone_v2(jsonb,boolean),public.staff_link_v2(uuid,text,text),public.staff_settings_v2(text,jsonb),public.staff_audit_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.booking_create_v2(jsonb,text),public.booking_status_v2(text) to service_role;
grant execute on function public.staff_phone_v2(jsonb,boolean),public.staff_link_v2(uuid,text,text),public.staff_settings_v2(text,jsonb),public.staff_audit_v2(uuid) to authenticated;
-- Existing wrapper grants remain as previously audited. No old slot is enabled.
commit;
