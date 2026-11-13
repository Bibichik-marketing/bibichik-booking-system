import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/booking-alerts.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {createBookingAlerts}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const row=(id,patch={})=>({id,status:'Pending',source:'Online',created_at:new Date(2000).toISOString(),...patch});
test('initial snapshots and page refresh never alert',()=>{for(let i=0;i<2;i++)assert.equal(createBookingAlerts().observe([row('old')],3000),false)});
test('new online Pending alerts once, repeated polls do not',()=>{const t=createBookingAlerts();t.observe([],1000);assert.equal(t.observe([row('a')],3000),true);assert.equal(t.observe([row('a')],4000),false)});
test('old, manual, missing metadata and nonpending rows never alert',()=>{const t=createBookingAlerts();t.observe([],3000);for(const patch of [{},{created_at:undefined},{source:'Phone'},{status:'Confirmed'}])assert.equal(t.observe([row(JSON.stringify(patch),patch)],4000),false)});
test('manual and invalid rows excluded even when new; reset isolates sessions',()=>{const t=createBookingAlerts();t.observe([],1000);assert.equal(t.observe([row('p',{source:'Phone'}),row('m',{created_at:undefined}),row('c',{status:'Confirmed'})],3000),false);t.reset();assert.equal(t.observe([row('new')],4000),false)});

const handoffCompiled=ts.transpileModule(readFileSync(new URL('../lib/confirmation-handoff.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {finishConfirmationHandoff}=await import(`data:text/javascript;base64,${Buffer.from(handoffCompiled).toString('base64')}`);
test('successful confirmation navigates reserved popup and retains fallback',()=>{let opened;const popup={closed:false,close(){},location:{replace(url){opened=url}}};const url='https://wa.me/60123456789?text=test';assert.equal(finishConfirmationHandoff(popup,url),url);assert.equal(opened,url);assert.equal(finishConfirmationHandoff(null,url),url)});
test('missing phone closes placeholder and never opens WhatsApp',()=>{let closed=false;const popup={closed:false,close(){closed=true},location:{replace(){assert.fail('must not navigate')}}};assert.equal(finishConfirmationHandoff(popup,null),null);assert.ok(closed)});
test('blocked navigation preserves manual fallback',()=>{const popup={closed:false,close(){},location:{replace(){throw Error('blocked')}}};assert.equal(finishConfirmationHandoff(popup,'https://wa.me/60123456789'),'https://wa.me/60123456789')});
test('failed HTTP response is checked before confirmation handoff',()=>{const staff=readFileSync(new URL('../components/reservation/Staff.tsx',import.meta.url),'utf8');assert.ok(staff.indexOf('if(!r.ok)throw Error();const result=await r.json()')<staff.indexOf('finishConfirmationHandoff(popup,result.whatsappUrl)'));assert.ok(staff.includes('catch{popup?.close()'))});
