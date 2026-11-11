// Local, interactive only. Never run with shell tracing, terminal recording, or CI.
import env from '@next/env';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export function hiddenPrompt(label,input=process.stdin,output=process.stdout){
 if(!input.isTTY||typeof input.setRawMode!=='function')throw Error('Interactive terminal required');
 return new Promise((resolvePrompt,reject)=>{
 let value='';const wasRaw=Boolean(input.isRaw);let done=false;
 function finish(error){if(done)return;done=true;input.off('data',read);input.off('error',onError);input.off('end',onEnd);input.off('close',onEnd);try{input.setRawMode(wasRaw)}catch{error=Error('Terminal mode restoration failed')}input.pause();output.write('\n');if(error)reject(error);else resolvePrompt(value);}
 function onError(){finish(Error('Terminal input error'))}
 function onEnd(){finish(Error('Terminal input closed'))}
 function read(chunk){for(const char of String(chunk)){if(char==='\u0003'){finish(Error('Cancelled'));return}if(char==='\r'||char==='\n'){finish();return}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;}}
 // Attach handlers before resuming: never lose input during prompt transitions.
 input.on('data',read);input.once('error',onError);input.once('end',onEnd);input.once('close',onEnd);
 try{input.setEncoding('utf8');input.setRawMode(true);output.write(`${label} (hidden): `);input.resume()}catch{finish(Error('Terminal raw mode unavailable'))}
 });
}
let stage='startup';
export function safeFailure(error,currentStage=stage){
 const name=error?.name;
 const category=name==='TimeoutError'||name==='AbortError'?'timeout':error?.message==='Cancelled'?'cancelled':String(error?.message).startsWith('Terminal')||error?.message==='Interactive terminal required'?'terminal':error?.message==='fetch failed'?'network':({
 'Membership record missing or ambiguous':'membership-record','Write test assertion failed':'write-assertion','Fixture UUID preflight failed':'fixture-collision-or-permission','Fixture initial status invalid':'fixture-status','Duplicate test identity':'duplicate-test-account','Membership inspection unavailable':'membership-read-permission','Cross-outlet write security stop':'possible-unauthorized-write','Missing environment configuration':'configuration','Local HTTP SITE_URL required':'configuration',
 'Authentication failed; stopping':'authentication','Local staff API login failed; stopping':'local-api-login',
 'Account role mismatch; stopping':'account-role','Authenticated identity mismatch':'identity-mismatch','Staff RPC denied':'staff-rpc-denied','Staff RPC request failed':'staff-rpc-http','Staff RPC response invalid':'staff-rpc-response','Fixture table access denied':'fixture-table-permission','Fixture table request failed':'fixture-table-http','Fixture table response invalid':'fixture-table-response','No available future test slot at an outlet':'availability',
 'Synthetic fixture creation failed':'fixture-creation','Fixture identity verification failed':'fixture-identity',
 'Invalid test date':'input','List baseline failed':'list-baseline'
 })[error?.message]||'unexpected';
 return `FAIL stage=${currentStage}; category=${category}. No credentials or response bodies logged.`;
}
export function isFixture(row,id,marker,outlet){return row?.id===id&&row.customer_name==='AUTHORIZATION TEST — SYNTHETIC'&&row.special_requests===marker&&row.outlet_id===outlet;}
export function validateStaffAccess(result){
 if(!result.ok)throw Error(result.status===401||result.status===403?'Staff RPC denied':'Staff RPC request failed');
 if(!Array.isArray(result.data))throw Error('Staff RPC response invalid');
}
export function validateTablePreflight(result){
 if(!result.ok)throw Error(result.status===401||result.status===403?'Fixture table access denied':'Fixture table request failed');
 if(!Array.isArray(result.data))throw Error('Fixture table response invalid');
}
export function membershipMatches(member,outlet){return member?.active===true&&member.role===(outlet?'outlet_staff':'admin')&&(outlet?member.outlet_id===outlet:member.outlet_id===null);}
export function safeResult(result){const known=['Forbidden','Invalid transition','Booking changed; refresh'];const category=known.includes(result.data?.message)?result.data.message:result.ok?'accepted':'other-error';return `HTTP=${result.status}; category=${category}`;}
export function unchangedFixture(before,after){return JSON.stringify(before)===JSON.stringify(after);}
export function sameVisibility(a,b){
 const signature=rows=>rows.map(row=>`${row.id}:${row.outlet_id}`).sort();
 return JSON.stringify(signature(a))===JSON.stringify(signature(b));
}
async function main(){
 const allowWrites=process.argv.includes('--allow-write-tests');
 if(allowWrites&&process.argv.includes('--read-only'))throw Error('Conflicting modes');
 env.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
 const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const base=process.env.SITE_URL||'http://localhost:3000';const target=new URL(base);
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.protocol!=='http:')throw Error('Local HTTP SITE_URL required');
 if(!url||!anon||(allowWrites&&!service))throw Error('Missing environment configuration');
 const marker=`AUTHZ-TEST-${randomUUID()}`;if(allowWrites)console.log('Synthetic recovery marker:',marker);const fixtures=[];let failures=0;const sessions=[];
 console.log('LIVE AUTHORIZATION TEST · synthetic fixtures only · no credential output');
 console.log(allowWrites?'WRITE MODE: synthetic fixtures only.':'READ-ONLY MODE: no bookings will be created or modified.');
 if(await hiddenPrompt('Type RUN to permit synthetic fixture creation and cleanup')!=='RUN')return;
 function check(ok,label){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok){failures++;if(allowWrites)throw Error('Write test assertion failed');}}
 async function request(path,key,token,body){const r=await fetch(`${url}${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});let data;try{data=await r.json()}catch{}return {ok:r.ok,status:r.status,data};}
 const rpc=(token,name,body)=>request(`/rest/v1/rpc/${name}`,anon,token,body);
 async function app(cookie,body){const r=await fetch(`${base}/api/staff`,{method:body?'POST':'GET',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});let data;try{data=await r.json()}catch{}return {ok:r.ok,status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function fixture(row){const r=await request(`/rest/v1/reservations?id=eq.${row.id}&select=*`,service,service);if(!r.ok||!isFixture(r.data?.[0],row.id,marker,row.outlet))throw Error('Fixture identity verification failed');return r.data[0];}
 try{
 stage='fixture table preflight';if(allowWrites)validateTablePreflight(await request('/rest/v1/reservations?select=id&limit=0',service,service));
 for(const role of ['Admin','SS2 Staff','Sunway 163 Staff']){
 stage=`${role}: email prompt`;const email=(await hiddenPrompt(`${role} email`)).trim();stage=`${role}: password prompt`;let password=await hiddenPrompt(`${role} password`);stage=`${role}: Supabase authentication`;
 const login=await request('/auth/v1/token?grant_type=password',anon,anon,{email,password});
 if(!login.ok||!login.data?.access_token)throw Error('Authentication failed; stopping');
 stage=`${role}: local API login`;const ui=await app('',{action:'login',email,password});password='';
 if(!ui.ok||!ui.cookie)throw Error('Local staff API login failed; stopping');
 const token=login.data.access_token;const uid=login.data.user.id;
 stage=`${role}: authenticated identity verification`;
 const identity=await request('/auth/v1/user',anon,token);
 const cookieToken=ui.cookie.slice(ui.cookie.indexOf('=')+1);
 const cookieIdentity=await request('/auth/v1/user',anon,decodeURIComponent(cookieToken));
 if(!identity.ok||!cookieIdentity.ok||!uid||identity.data?.id!==uid||cookieIdentity.data?.id!==uid)throw Error('Authenticated identity mismatch');
 stage=`${role}: staff RPC verification`;
 const access=await rpc(token,'staff_reservations',{});
 validateStaffAccess(access);
 const outlet=role==='SS2 Staff'?'bibichik-ss2':role==='Sunway 163 Staff'?'bibichik-sunway-163':null;
 // Expected account labels are operator assertions; verify observable visibility separately.
 if(sessions.some(session=>session.uid===uid))throw Error('Duplicate test identity');
 console.log(`${role}: role/outlet mapping supplied by operator; not independently read from staff_members.`);
 sessions.push({role,outlet,uid,token,cookie:ui.cookie});check(true,`${role}: same authenticated user in API/RPC and active staff RPC accepted`);

 }
 if(!allowWrites){
 const adminLists={};let inconclusive=0;
 function uncertain(label){inconclusive++;console.log(`INCONCLUSIVE ${label}`)}
 for(const session of sessions){
 stage=`${session.role}: read-only lists`;
 const observed={};
 for(const channel of ['API','RPC']){
 const result=channel==='API'?await app(session.cookie):await rpc(session.token,'staff_reservations',{});
 console.log(`${session.role}: ${channel} list ${safeResult(result)}`);
 validateStaffAccess(result);observed[channel]=result.data;
 check(result.data.every(row=>['bibichik-ss2','bibichik-sunway-163'].includes(row.outlet_id)),`${session.role}: ${channel} known outlet identifiers`);
 if(!session.outlet){adminLists[channel]=result.data;for(const outlet of ['bibichik-ss2','bibichik-sunway-163']){if(result.data.some(row=>row.outlet_id===outlet))check(true,`Admin: ${channel} can read ${outlet}`);else uncertain(`Admin: ${channel} ${outlet} visibility (no returned rows for that outlet)`);}}
 else{
 check(result.data.every(row=>row.outlet_id===session.outlet),`${session.role}: ${channel} returned no opposite-outlet rows`);
 const oppositeBaseline=adminLists[channel]?.filter(row=>row.outlet_id!==session.outlet)??[];if(!oppositeBaseline.length)uncertain(`${session.role}: ${channel} cross-outlet exclusion lacks opposite-outlet baseline data`);else check(oppositeBaseline.every(row=>!result.data.some(item=>item.id===row.id)),`${session.role}: ${channel} known opposite-outlet records inaccessible`);
 const expected=adminLists[channel]?.filter(row=>row.outlet_id===session.outlet)??[];
 if(!expected.length)uncertain(`${session.role}: ${channel} own-outlet visibility lacks baseline data`);else check(expected.every(row=>result.data.some(item=>item.id===row.id)),`${session.role}: ${channel} own-outlet rows visible against Admin baseline`);
 }
 }
 check(sameVisibility(observed.API,observed.RPC),`${session.role}: API/RPC reservation visibility matches (snapshot comparison)`);
 }
 const unauth=await app('');check(unauth.status===401,'Unauthenticated API list rejected');
 const anonymous=await rpc(anon,'staff_reservations',{});check(!anonymous.ok&&[401,403].includes(anonymous.status),'Anonymous staff RPC rejected');
 console.log(`RESULT: ${failures?'FAIL':inconclusive?'INCONCLUSIVE':'PASS'} (${failures} failed checks, ${inconclusive} inconclusive); read-only; no reservation writes. INCONCLUSIVE lines require existing rows to verify visibility.`);process.exitCode=failures?1:0;return;
 }
 stage='test date prompt';const date=await hiddenPrompt('Future test service date YYYY-MM-DD (both outlets need capacity)');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid test date');
 for(const outlet of ['bibichik-ss2','bibichik-sunway-163']){
 stage=`${outlet}: availability`;const available=await request('/rest/v1/rpc/reservation_availability',service,service,{outlet,day:date,party:1});const slot=available.data?.[0];if(!available.ok||!slot?.id)throw Error('No available future test slot at an outlet');
 const id=randomUUID();const entry={id,outlet};const collision=await request(`/rest/v1/reservations?id=eq.${id}&select=id`,service,service);if(!collision.ok||!Array.isArray(collision.data)||collision.data.length)throw Error('Fixture UUID preflight failed');fixtures.push(entry);
 const payload={id,slotId:slot.id,outletId:outlet,date,guests:1,name:'AUTHORIZATION TEST — SYNTHETIC',phone:'0123456789',email:'authorization-test@example.invalid',requests:marker,consent:true};
 stage=`${outlet}: fixture creation`;const created=await rpc(sessions[0].token,'staff_manual_reservation',{payload,source:'Phone'});if(!created.ok)throw Error('Synthetic fixture creation failed');if((await fixture(entry)).status!=='Pending')throw Error('Fixture initial status invalid');
 }
 for(const s of sessions){
 stage=`${s.role}: authorization checks`;const a=await app(s.cookie);const r=await rpc(s.token,'staff_reservations',{});
 for(const [label,result] of [['API',a],['RPC',r]]){
 check(result.ok&&Array.isArray(result.data),`${s.role}: ${label} list accepted`);
 if(!result.ok||!Array.isArray(result.data))throw Error('List baseline failed');
 check(!s.outlet||result.data.every(x=>x.outlet_id===s.outlet),`${s.role}: ${label} list outlet isolation`);
 for(const f of fixtures)check(result.data.some(x=>x.id===f.id)===(s.outlet===null||s.outlet===f.outlet),`${s.role}: ${label} synthetic fixture visibility ${f.outlet}`);
 }
 if(s.outlet){const opposite=fixtures.find(f=>f.outlet!==s.outlet);for(const channel of ['RPC','API']){
 const before=await fixture(opposite);if(before.status!=='Pending')throw Error('Fixture initial status invalid');const result=channel==='RPC'?await rpc(s.token,'staff_set_status',{booking_id:opposite.id,next_status:'Confirmed',expected_status:before.status}):await app(s.cookie,{action:'status',id:opposite.id,status:'Confirmed',expected:before.status});
 const after=await fixture(opposite);console.log(`${s.role}: ${channel} opposite mutation ${safeResult(result)}; statusChanged=${after.status!==before.status}`);check(!result.ok&&(channel==='API'?result.status===400:result.data?.message==='Forbidden')&&unchangedFixture(before,after),`${s.role}: ${channel} opposite-outlet mutation denied and unchanged`);if(result.ok||!unchangedFixture(before,after))throw Error('Cross-outlet write security stop');
 }
 // Direct table query must be denied or return no rows, even with an explicit opposite ID.
 const direct=await request(`/rest/v1/reservations?id=eq.${opposite.id}&select=id`,anon,s.token);
 check((!direct.ok&&[401,403].includes(direct.status))||(direct.ok&&Array.isArray(direct.data)&&direct.data.length===0),`${s.role}: direct table opposite-outlet read blocked`);
 }
 }
 // Positive controls run only after every denial check succeeds.
 for(const f of [...fixtures]){
 const assigned=sessions.find(session=>session.outlet===f.outlet);
 for(const [session,channel,next] of [[sessions[0],'RPC','Confirmed'],[assigned,'API','Seated'],[assigned,'RPC','Completed']]){
 const before=await fixture(f);const result=channel==='RPC'?await rpc(session.token,'staff_set_status',{booking_id:f.id,next_status:next,expected_status:before.status}):await app(session.cookie,{action:'status',id:f.id,status:next,expected:before.status});
 console.log(`${session.role}: ${channel} positive control ${safeResult(result)}`);check(result.ok&&(await fixture(f)).status===next,`${session.role}: ${channel} ${next} at ${f.outlet} persisted`);
 }
 }
 const unauth=await app('');check(unauth.status===401,'Unauthenticated API list rejected');
 const anonymous=await rpc(anon,'staff_reservations',{});check(!anonymous.ok&&[401,403].includes(anonymous.status),'Anonymous staff RPC rejected');
 }finally{
 for(const f of fixtures){try{const existing=await request(`/rest/v1/reservations?id=eq.${f.id}&select=*`,service,service);if(existing.ok&&existing.data?.length===0)continue;await fixture(f);const deleted=await fetch(`${url}/rest/v1/reservations?id=eq.${f.id}&outlet_id=eq.${encodeURIComponent(f.outlet)}&special_requests=eq.${encodeURIComponent(marker)}&customer_name=eq.${encodeURIComponent('AUTHORIZATION TEST — SYNTHETIC')}`,{method:'DELETE',headers:{apikey:service,Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(15000)});const remaining=await request(`/rest/v1/reservations?id=eq.${f.id}&select=id`,service,service);check(deleted.ok&&remaining.ok&&remaining.data?.length===0,`Synthetic cleanup ${f.outlet}`);}catch{failures++;console.log('FAIL cleanup; use private SQL editor to remove only rows with exact special_requests marker:',marker);}}
 for(const s of sessions){try{await request('/auth/v1/logout?scope=local',anon,s.token,{})}catch{/* Short-lived tokens stay only in memory. */}}
 }
 console.log(`RESULT: ${failures?'FAIL':'PASS'} (${failures} failed checks)`);process.exitCode=failures?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().catch(error=>{console.error(safeFailure(error));process.exitCode=1;});}
