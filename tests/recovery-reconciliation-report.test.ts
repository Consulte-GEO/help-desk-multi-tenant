import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pending,sending,delivered} from './helpers/recovery-fixture.ts';
import {AT,u} from './helpers/release-fixtures.ts';
import {requestHash} from '../src/domain/canonical.ts';
const url=new URL('../src/domain/recovery-reconciliation-report.ts',import.meta.url);
async function summarize(...args:unknown[]){assert.ok(existsSync(url),'recovery report module must exist');const mod=await import(url.href);assert.equal(typeof mod.summarizeRecoveryReconciliation,'function');return mod.summarizeRecoveryReconciliation(...args);}
test('HD045 report preserves confirmation, revocation and privacy without mutating inputs',async()=>{
 const backup=[pending()],current=[delivered()],restored=[{kind:'principal',id:u(500),revision:4},{kind:'session',id:u(501),revision:2},{kind:'resource_binding',id:u(502),revision:2},{kind:'download_receipt',id:u(503),revision:2},{kind:'object',id:u(504),revision:2}],marks=[{kind:'principal',id:u(500),revision:1,action:'erase'},{kind:'resource_binding',id:u(502),revision:1,action:'revoke'}];
 const inputs=[backup,current,restored,marks],before=JSON.stringify(inputs),r=await summarize(...inputs,AT);
 assert.deepEqual(Object.keys(r),['schemaVersion','inputContract','at','sources','delivery','access','sourceAuthorityVerified','productionApproved','restorePerformed','resumeWorkers','mutations']);
 assert.equal(r.schemaVersion,1);assert.equal(r.inputContract,'c15-recovery-v1');assert.equal(r.at,'2026-10-10T18:00:00.000Z');
 assert.equal(r.delivery.total,1);assert.equal(r.delivery.states.delivered,1);assert.equal(r.delivery.dispatchable,0);assert.equal(r.access.actions.do_not_restore,1);assert.equal(r.access.actions.keep_revoked,1);assert.equal(r.access.actions.invalidate,2);assert.equal(r.access.actions.quarantine,1);
 assert.deepEqual(r.sources.deliveryBackup,{count:1,canonicalJsonSha256:requestHash(backup)});assert.equal(r.sourceAuthorityVerified,false);assert.equal(r.productionApproved,false);assert.equal(r.restorePerformed,false);assert.equal(r.resumeWorkers,false);assert.equal(r.mutations,0);
 assert.equal(JSON.stringify(inputs),before);assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.delivery.states));assert.ok(Object.isFrozen(r.sources.deliveryBackup));
 for(const marker of [u(101),u(500),'CG-10001','synthetic-provider-1','synthetic-mail'])assert.equal(JSON.stringify(r).includes(marker),false);
});
for(const [label,value,state] of [['pending',pending(),'suppressed'],['sending',sending(),'unknown']] as const)test('HD045 report never dispatches restored '+label,async()=>{const r=await summarize([value],[],[],[],AT);assert.equal(r.delivery.states[state],1);assert.equal(r.delivery.attention,1);assert.equal(r.delivery.dispatchable,0);assert.equal(Object.values(r.delivery.states).reduce((a:any,b:any)=>a+b,0),1);});
test('HD045 report empty inputs remain nonauthoritative and time is explicit',async()=>{const r=await summarize([],[],[],[],AT);assert.equal(r.delivery.total,0);assert.equal(r.access.total,0);assert.equal(r.sourceAuthorityVerified,false);assert.deepEqual(r,await summarize([],[],[],[],'2026-10-10T18:00:00.000Z'));});
test('HD045 report includes current-only records and revalidation counts',async()=>{const r=await summarize([],[delivered()],[{kind:'principal',id:u(500),revision:1}],[],AT);assert.equal(r.delivery.states.delivered,1);assert.equal(r.access.actions.require_revalidation,1);});
for(const [name,args] of [
 ['delivery shape',[{},[],[],[],AT]],['native export',[[{provider_message_id:'private@example.invalid'}],[],[],[],AT]],
 ['conflict',[[delivered()],[pending()],[],[],AT]],['duplicate',[[pending(),pending()],[],[],[],AT]],
 ['access shape',[[],[],[{kind:'principal',id:u(500),revision:1,secret:'PRIVATE'}],[],AT]],
 ['tombstone shape',[[],[],[],[{kind:'principal',id:u(500),revision:1,action:'activate'}],AT]],
 ['limit',[[],[],Array.from({length:1001},(_,n)=>({kind:'principal',id:u(n+600),revision:1})),[],AT]],
 ['clock',[[],[],[],[],'2026-02-30T18:00:00.000Z']],['old clock',[[delivered()],[],[],[],'2026-10-10T16:00:00.000Z']]
] as const)test('HD045 report refuses entire invalid '+name,async()=>{await assert.rejects(summarize(...args));});
