import test from 'node:test';
import assert from 'node:assert/strict';
import {isFixture} from '../scripts/test-live-authorization.mjs';
test('cleanup fixture guard rejects wrong identity, marker, name or outlet',()=>{
 const row={id:'test-id',customer_name:'AUTHORIZATION TEST — SYNTHETIC',special_requests:'run-marker',outlet_id:'bibichik-ss2'};
 assert.equal(isFixture(row,'test-id','run-marker','bibichik-ss2'),true);
 for(const patch of [{id:'other'},{customer_name:'Actual guest'},{special_requests:'other-run'},{outlet_id:'bibichik-sunway-163'}])assert.equal(isFixture({...row,...patch},'test-id','run-marker','bibichik-ss2'),false);
 assert.equal(isFixture(undefined,'test-id','run-marker','bibichik-ss2'),false);
});
import {hiddenPrompt,safeFailure} from '../scripts/test-live-authorization.mjs';
import {PassThrough} from 'node:stream';
test('repeated hidden prompts restore terminal and never echo dummy credentials',async()=>{
 const input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value};let output='';const sink={write:s=>{output+=s}};
 for(const dummy of ['RUN','dummy@example.invalid','dummy-password']){const promise=hiddenPrompt('Test',input,sink);input.write(dummy+'\r');assert.equal(await promise,dummy);assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);assert.ok(!output.includes(dummy));}
});
test('hidden prompts reject closed input and restore mode',async()=>{const input=new PassThrough();input.isTTY=true;input.setRawMode=v=>{input.isRaw=v};const p=hiddenPrompt('Test',input,{write(){}});input.emit('end');await assert.rejects(p,/Terminal input closed/);assert.equal(input.isRaw,false)});
test('safe diagnostics never include untrusted exception content',()=>{assert.equal(safeFailure(Error('SECRET-LIKE-UNTRUSTED-CONTENT'),'Admin: email prompt'),'FAIL stage=Admin: email prompt; category=unexpected. No credentials or response bodies logged.')});
import {validateStaffAccess,validateTablePreflight} from '../scripts/test-live-authorization.mjs';
test('RPC and fixture access distinguish permission denial from invalid responses',()=>{assert.doesNotThrow(()=>validateStaffAccess({ok:true,data:[]}));assert.throws(()=>validateStaffAccess({ok:false,status:403}),/Staff RPC denied/);assert.throws(()=>validateStaffAccess({ok:true,data:{}}),/Staff RPC response invalid/);assert.throws(()=>validateTablePreflight({ok:false,status:403}),/Fixture table access denied/);assert.doesNotThrow(()=>validateTablePreflight({ok:true,data:[]}));assert.equal(safeFailure(Error('Fixture table access denied'),'fixture table preflight').includes('category=fixture-table-permission'),true)});
import {membershipMatches,safeResult} from '../scripts/test-live-authorization.mjs';
test('test accounts must match exact active role and outlet',()=>{assert.equal(membershipMatches({role:'admin',outlet_id:null,active:true},null),true);assert.equal(membershipMatches({role:'outlet_staff',outlet_id:'bibichik-sunway-163',active:true},'bibichik-ss2'),false);assert.equal(membershipMatches({role:'admin',outlet_id:null,active:true},'bibichik-ss2'),false);assert.equal(membershipMatches({role:'outlet_staff',outlet_id:'bibichik-ss2',active:false},'bibichik-ss2'),false)});
test('RPC diagnostics allowlist categories and omit unknown server messages',()=>{assert.equal(safeResult({status:400,data:{message:'private information'}}),'HTTP=400; category=other-error')});
import {sameVisibility} from '../scripts/test-live-authorization.mjs';
test('API/RPC visibility comparison detects missing or wrong-outlet rows without comparing personal data',()=>{const a=[{id:'a',outlet_id:'bibichik-ss2'},{id:'b',outlet_id:'bibichik-sunway-163'}];assert.equal(sameVisibility(a,[...a].reverse()),true);assert.equal(sameVisibility(a,a.slice(0,1)),false);assert.equal(sameVisibility(a,[a[0],{...a[1],outlet_id:'bibichik-ss2'}]),false)});
import {unchangedFixture} from '../scripts/test-live-authorization.mjs';
test('denied write verification detects status and other persisted changes',()=>{const row={id:'synthetic',status:'Pending',updated_at:'before'};assert.equal(unchangedFixture(row,{...row}),true);assert.equal(unchangedFixture(row,{...row,status:'Confirmed'}),false);assert.equal(unchangedFixture(row,{...row,updated_at:'after'}),false)});
