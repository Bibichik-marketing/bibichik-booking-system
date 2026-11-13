import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
const migration='supabase/migrations/202611130001_reservation_archive.sql';
const admin='00000000-0000-4000-8000-000000000101',ss2='00000000-0000-4000-8000-000000000102',sunway='00000000-0000-4000-8000-000000000103';
const outlets=['bibichik-ss2','bibichik-sunway-163'];
async function setup(){
 const db=new PGlite({extensions:{btree_gist}});
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 for(const file of ['supabase/reservations.sql','supabase/staff.sql','supabase/migrations/202611120001_booking_v2.sql'])await db.exec(readFileSync(file,'utf8'));
 await db.exec(`insert into auth.users values('${admin}'),('${ss2}'),('${sunway}');insert into public.staff_members values('${admin}','admin',null,true),('${ss2}','outlet_staff','bibichik-ss2',true),('${sunway}','outlet_staff','bibichik-sunway-163',true);alter default privileges grant all on tables to anon,authenticated,service_role;alter default privileges grant execute on functions to anon,authenticated,service_role;`);
 await db.exec(readFileSync(migration,'utf8'));await identity(db,admin);return db;
}
async function identity(db,id){await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id??'']);}
async function seed(db,status='Completed',outlet=outlets[0],expired=false){
 const id=randomUUID();let slot=randomUUID();
 await db.query(`insert into public.reservation_slots(id,outlet_id,starts_at,ends_at,period,capacity,enabled) values($1,$2,statement_timestamp()-interval '10 minutes',statement_timestamp()+interval '110 minutes','Dinner',35,false) on conflict(outlet_id,starts_at) do nothing`,[slot,outlet]);
 slot=(await db.query('select id from public.reservation_slots where outlet_id=$1 order by starts_at limit 1',[outlet])).rows[0].id;
 await db.query(`insert into public.reservations(id,reference,slot_id,outlet_id,customer_name,phone,reservation_date,reservation_time,guests,status,request_payload,v2,scheduled_start_at,scheduled_end_at,pending_expires_at) values($1,$2,$3,$4,'Synthetic archive test','0123456789',current_date,'19:00',10,$5,'{}',true,statement_timestamp()-interval '10 minutes',statement_timestamp()+interval '110 minutes',clock_timestamp()+$6::interval)`,[id,'TEST-'+id,slot,outlet,status,expired?'-1 minute':'1 hour']);
 return {id,reference:'TEST-'+id,version:1};
}
const archive=(db,b)=>db.query('select public.staff_archive_reservation_v2($1,$2,$3)',[b.id,b.version,b.reference]);
const row=async(db,id)=>(await db.query('select to_jsonb(r) r from public.reservations r where id=$1',[id])).rows[0].r;
test('archive migration preserves disabled outlets, staff, full slot constraints and private RLS/grants despite unsafe defaults',async()=>{const db=await setup();try{
 assert.equal((await db.query('select count(*)::int n from public.staff_members where active')).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from booking_private.outlets where booking_enabled')).rows[0].n,0);
 assert.ok((await db.query(`select 1 from pg_constraint where conname='no_overlapping_enabled_slots'`)).rows.length);
 assert.equal((await db.query(`select relrowsecurity r from pg_class where oid='booking_private.reservation_archives'::regclass`)).rows[0].r,true);
 for(const role of ['anon','authenticated','service_role']){
  for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await db.query(`select has_table_privilege($1,'booking_private.reservation_archives',$2) ok`,[role,privilege])).rows[0].ok,false);
  for(const signature of ['public.staff_archive_capability_v2()','public.staff_archive_reservation_v2(uuid,bigint,text)'])assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') ok",[role,signature])).rows[0].ok,role==='authenticated');
 }
 const functions=(await db.query(`select pg_get_userbyid(proowner) owner,prosecdef,proconfig from pg_proc where proname in ('staff_archive_capability_v2','staff_archive_reservation_v2')`)).rows;
 assert.equal(functions.length,2);for(const f of functions){assert.equal(f.owner,'postgres');assert.equal(f.prosecdef,true);assert.ok(f.proconfig.includes('search_path=""'));}
}finally{await db.close()}});
test('only active Admin can archive: both staff denied at own/opposite outlets, anon/service role denied and no identity rejected',async()=>{const db=await setup();try{
 const bookings=await Promise.all(outlets.map(o=>seed(db,'Cancelled',o)));
 for(const user of [ss2,sunway]){await identity(db,user);await db.exec('set role authenticated');assert.equal((await db.query('select public.staff_archive_capability_v2() ok')).rows[0].ok,false);for(const b of bookings)await assert.rejects(archive(db,b),/Forbidden/);await db.exec('reset role');}
 await identity(db,null);await assert.rejects(archive(db,bookings[0]),/Forbidden/);
 await identity(db,admin);for(const role of ['anon','service_role']){await db.exec('set role '+role);await assert.rejects(archive(db,bookings[0]),/permission denied/);await db.exec('reset role');}
 await db.exec(`update public.staff_members set active=false where user_id='${admin}'`);await assert.rejects(archive(db,bookings[0]),/Forbidden/);await db.exec(`update public.staff_members set active=true where user_id='${admin}'`);
 await db.exec('set role authenticated');for(const b of bookings)await archive(db,b);await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from booking_private.reservation_archives')).rows[0].n,2);
}finally{await db.close()}});
test('terminal archive hides lists and customer links, preserves exact booking/capacity and records a single Admin audit',async()=>{const db=await setup();try{
 for(const status of ['Completed','Cancelled','Rejected','Expired','No-show']){
  const b=await seed(db,status);const before=await row(db,b.id);
  const capacity=async()=>(await db.query(`select booking_private.capacity('bibichik-ss2',clock_timestamp(),10,clock_timestamp()) ok`)).rows[0].ok;
  const was=await capacity();const hash=b.id.replaceAll('-','').repeat(2);
  await db.query(`insert into booking_private.status_tokens values($1,$2,clock_timestamp()+interval '1 day',null)`,[b.id,hash]);
  await db.query("insert into booking_private.events(reservation_id,outlet_id,event) values($1,'bibichik-ss2','Historical synthetic event')",[b.id]);
  await archive(db,b);assert.equal((await db.query("select count(*)::int n from booking_private.events where reservation_id=$1 and event='Historical synthetic event'",[b.id])).rows[0].n,1);assert.deepEqual(await row(db,b.id),before);assert.equal(await capacity(),was);
  assert.equal((await db.query('select public.booking_status_v2($1) v',[hash])).rows[0].v,null);
  const audit=(await db.query(`select actor,at,details from booking_private.events where reservation_id=$1 and event='Archived'`,[b.id])).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].actor,admin);assert.equal(audit[0].details.status,status);
  const a=(await db.query('select archived_by,archived_at from booking_private.reservation_archives where reservation_id=$1',[b.id])).rows[0];assert.equal(a.archived_by,admin);assert.equal(+new Date(a.archived_at),+new Date(audit[0].at));
  await assert.rejects(archive(db,b),/Already archived/);
 }
 assert.deepEqual((await db.query('select public.staff_reservations() r')).rows[0].r,[]);
 assert.equal((await db.query('select count(*)::int n from public.reservations')).rows[0].n,5);
 assert.equal((await db.query(`select booking_private.capacity('bibichik-ss2',clock_timestamp(),10,clock_timestamp()) ok`)).rows[0].ok,false,'archived retained commitments still prevent overbooking');
}finally{await db.close()}});
test('active states and stale/version/reference requests fail; stored Pending remains forbidden after expiry and cannot be hidden by a display-only Expired status',async()=>{const db=await setup();try{
 for(const status of ['Pending','Confirmed','Seated','Declined']){const b=await seed(db,status);await assert.rejects(archive(db,b),/Cancel active/);}
 const b=await seed(db,'Cancelled');await assert.rejects(archive(db,{...b,version:null}),/Invalid archive request/);await assert.rejects(archive(db,{...b,version:2}),/Booking changed/);await assert.rejects(archive(db,{...b,reference:'WRONG'}),/Booking changed/);
 const expired=await seed(db,'Pending',outlets[1],true);const before=await row(db,expired.id);await assert.rejects(archive(db,expired),/Cancel active/);assert.deepEqual(await row(db,expired.id),before);
 const displayed=(await db.query('select public.staff_reservations() r')).rows[0].r.find(r=>r.id===expired.id);assert.equal(displayed.status,'Expired');assert.equal(displayed.archive_eligible,false);
 for(const user of [ss2,sunway]){await identity(db,user);const list=(await db.query('select public.staff_reservations() r')).rows[0].r;assert.ok(list.every(r=>r.outlet_id===(user===ss2?outlets[0]:outlets[1])));if(user===sunway)assert.ok(list.some(r=>r.id===expired.id));}
}finally{await db.close()}});
test('audit failure rolls back archive and token revocation atomically',async()=>{const db=await setup();try{
 const b=await seed(db,'Completed');await db.query(`insert into booking_private.status_tokens values($1,$2,clock_timestamp()+interval '1 day',null)`,[b.id,'a'.repeat(64)]);
 await db.exec(`create function public.reject_test_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure';end $$;create trigger reject_test_audit before insert on booking_private.events for each row execute function public.reject_test_audit();`);
 await assert.rejects(archive(db,b),/Synthetic audit failure/);assert.equal((await db.query('select count(*)::int n from booking_private.reservation_archives')).rows[0].n,0);assert.equal((await db.query('select revoked_at from booking_private.status_tokens')).rows[0].revoked_at,null);
}finally{await db.close()}});
