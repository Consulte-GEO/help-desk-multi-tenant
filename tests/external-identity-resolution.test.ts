import test from 'node:test';
import assert from 'node:assert/strict';

const issuer='https://identity.example.invalid/Realm-A',clientId='Client-A';
const identityId='00000000-0000-4000-8000-000000000001',principalId='00000000-0000-4000-8000-000000000002';
const secondId='00000000-0000-4000-8000-000000000003';
const now='2026-10-09T12:00:00.000000Z';
const observation=()=>({issuer,subject:'0001',clientId,asOf:now,expiresAt:'2026-10-09T12:00:05.000000Z'});
const registration=()=>({principalId,principalKind:'human',revision:'1',active:true,principalActive:true,
 origin:{kind:'external',identityId,issuer,subject:'0001'}});
const error=(code:string,status?:number)=>({code,...(status===undefined?{}:{status})});
const deferred=()=>{let resolve!:(v:any)=>void,reject!:(v:unknown)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {resolve,reject,promise};};
async function factory(){
 const name='../src/application/external-identity.ts';const m=await import(name).catch((e:unknown)=>{
  if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;
 });
 assert.equal(typeof m.createExternalIdentityResolver,'function','C02 resolver is not implemented');return m.createExternalIdentityResolver as (o:any)=>any;
}
async function harness(overrides:any={}){
 const create=await factory(),calls:any[]=[],namespace={issuer,clientId};
 let tick=now,verified:any=observation(),rows:any=[registration()];
 const options={namespace,timeoutMs:2000,maxObservationAgeMicros:5_000_000n,clock:()=>tick,
  verifier:{verify:async(evidence:unknown,n:any,signal:AbortSignal)=>{calls.push({kind:'verify',evidence,namespace:n,signal});return verified;}},
  directory:{lookup:async(ref:any,signal:AbortSignal)=>{calls.push({kind:'lookup',ref,signal});return rows;}},...overrides};
 const resolver=create(options);
 return {resolver,options,calls,namespace,setTick:(t:string)=>{tick=t;},setObservation:(v:any)=>{verified=v;},setRows:(v:any)=>{rows=v;}};
}

test('C02 factory performs no IO and a successful match has no permissions or credentials',async()=>{
 const h=await harness();assert.equal(h.calls.length,0);const evidence={opaque:'synthetic-owned-flow'};
 const r=await h.resolver.resolve(evidence);
 assert.deepEqual(h.calls.map(c=>c.kind),['verify','lookup']);assert.equal(h.calls[0].evidence,evidence);
 assert.deepEqual(h.calls[1].ref,{issuer,subject:'0001'});
 assert.deepEqual(r,{kind:'external_identity_match',principalId,identityId,identityRevision:'1',
  reference:{issuer,subject:'0001'},checkedAt:now,expiresAt:observation().expiresAt});
 assert.equal(Object.isFrozen(r),true);assert.equal(Object.isFrozen(r.reference),true);
 for(const k of ['scopes','role','email','accountId','workspaceId','accessToken','supabaseUserId','authenticated'])assert.equal(Object.hasOwn(r,k),false);
});
test('C02 issuer/sub lookup does not unite two identities with the same email',async()=>{
 const a=await harness(),bIssuer=issuer+'-B',b=await harness({namespace:{issuer:bIssuer,clientId}});
 const row=registration();row.principalId=secondId;row.origin.issuer=bIssuer;
 b.setObservation({...observation(),issuer:bIssuer});b.setRows([row]);
 const email={email:'same@example.invalid'};
 const x=await a.resolver.resolve(email),y=await b.resolver.resolve(email);
 assert.notEqual(x.principalId,y.principalId);
 assert.equal(a.calls[1].ref.subject,b.calls[1].ref.subject);assert.notEqual(a.calls[1].ref.issuer,b.calls[1].ref.issuer);
 assert.equal(Object.hasOwn(a.calls[1].ref,'email'),false);
});
test('C02 pairwise subjects in the same issuer are not automatically associated',async()=>{
 const h=await harness();await h.resolver.resolve('flow-1');
 h.setObservation({...observation(),subject:'pairwise-other-client'});h.setRows([]);
 await assert.rejects(h.resolver.resolve('flow-2'),error('external_identity_not_linked',403));
 assert.equal(h.calls[3].ref.subject,'pairwise-other-client');assert.equal(h.calls.length,4);
});
test('C02 the same exact pair may be recognized for another correctly verified client without changing its key',async()=>{
 const h=await harness({namespace:{issuer,clientId:'Client-B'}});h.setObservation({...observation(),clientId:'Client-B'});
 assert.equal((await h.resolver.resolve('flow')).principalId,principalId);assert.deepEqual(h.calls[1].ref,{issuer,subject:'0001'});
});
for(const change of [{issuer:issuer+'/'},{issuer:issuer.toLowerCase()},{clientId:'OtherClient'}])test('C02 wrong verifier namespace '+JSON.stringify(change),async()=>{
 const h=await harness();h.setObservation({...observation(),...change});
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_unverified',401));assert.equal(h.calls.length,1);
});
test('C02 a refused verifier never consults or creates a registration',async()=>{
 const h=await harness();h.setObservation(null);await assert.rejects(h.resolver.resolve('flow'),error('external_identity_unverified',401));
 assert.equal(h.calls.length,1);
});
test('C02 a raw claims/metadata object cannot masquerade as the normalized verification result',async()=>{
 const h=await harness();h.setObservation({...observation(),email:'same@example.invalid',user_metadata:{role:'admin'},verified:true});
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_verifier_invalid',503));assert.equal(h.calls.length,1);
});
for(const rows of [[],[{...registration(),active:false}],[{...registration(),principalActive:false}]])test('C02 absent or revoked registration '+JSON.stringify(rows),async()=>{
 const h=await harness();h.setRows(rows);await assert.rejects(h.resolver.resolve('flow'),error('external_identity_not_linked',403));
 assert.equal(h.calls.length,2);
});
test('C02 ambiguous mappings are denied instead of selecting the first',async()=>{
 const h=await harness();h.setRows([registration(),{...registration(),principalId:secondId}]);
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_ambiguous',403));
});
for(const patch of [{issuer:issuer+'/'},{subject:'1'}])test('C02 directory must return the exact requested pair '+JSON.stringify(patch),async()=>{
 const h=await harness();h.setRows([{...registration(),origin:{...registration().origin,...patch}}]);
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_directory_invalid',503));
});
test('C02 external lookup cannot silently adopt an existing Supabase origin',async()=>{
 const h=await harness();h.setRows([{...registration(),origin:{kind:'supabase',userId:principalId}}]);
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_directory_invalid',503));
});
test('C02 namespace is copied at construction and verifier cannot mutate it',async()=>{
 const h=await harness();h.namespace.issuer='https://foreign.example.invalid';h.namespace.clientId='Changed';
 await h.resolver.resolve('flow');assert.deepEqual(h.calls[0].namespace,{issuer,clientId});assert.equal(Object.isFrozen(h.calls[0].namespace),true);
});
test('C02 observation is detached before waiting for the registry',async()=>{
 const gate=deferred(),entered=deferred();const data=observation();
 const h=await harness({directory:{lookup:async()=>{entered.resolve(null);return gate.promise;}}});h.setObservation(data);
 const running=h.resolver.resolve('flow');await entered.promise;data.subject='hijacked';gate.resolve([registration()]);
 assert.equal((await running).reference.subject,'0001');
});
test('C02 every call rechecks verifier and live registration; no cache revives a revoked user',async()=>{
 const h=await harness();await h.resolver.resolve('flow-1');h.setRows([{...registration(),active:false}]);
 await assert.rejects(h.resolver.resolve('flow-2'),error('external_identity_not_linked'));assert.equal(h.calls.length,4);
});
test('C02 returned receipt cannot be changed by later mutation of directory response',async()=>{
 const h=await harness(),rows=[registration()];h.setRows(rows);const r=await h.resolver.resolve('flow');
 rows[0]!.principalId=secondId;rows[0]!.origin.subject='x';assert.equal(r.principalId,principalId);assert.equal(r.reference.subject,'0001');
});
for(const patch of [{asOf:'2026-10-09T12:00:00.000001Z'},{asOf:'2026-10-09T11:59:54.999999Z'},
 {asOf:'2026-10-09T11:59:59.000000Z',expiresAt:now}])test('C02 out-of-window observation '+JSON.stringify(patch),async()=>{
 const h=await harness();h.setObservation({...observation(),...patch});
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_expired',401));assert.equal(h.calls.length,1);
});
test('C02 microsecond expiry during a delayed directory response is not rounded away',async()=>{
 const gate=deferred(),entered=deferred();const h=await harness({directory:{lookup:async()=>{entered.resolve(null);return gate.promise;}}});
 h.setObservation({...observation(),expiresAt:'2026-10-09T12:00:00.000001Z'});
 const running=h.resolver.resolve('flow');const rejected=assert.rejects(running,error('external_identity_expired',401));
 await entered.promise;h.setTick('2026-10-09T12:00:00.000001Z');gate.resolve([registration()]);await rejected;
});
test('C02 equivalent millisecond/microsecond instants are accepted at the inclusive age boundary',async()=>{
 const h=await harness();h.setTick('2026-10-09T12:00:05.000Z');h.setObservation({...observation(),expiresAt:'2026-10-09T12:00:06.000000Z'});
 assert.equal((await h.resolver.resolve('flow')).principalId,principalId);
});
test('C02 backwards clock between stages fails instead of renewing the identity window',async()=>{
 const ticks=[now,'2026-10-09T12:00:01.000000Z','2026-10-09T12:00:00.999999Z'];
 const h=await harness({clock:()=>ticks.shift()??now});await assert.rejects(h.resolver.resolve('flow'),error('external_identity_clock_invalid',503));
});
for(const stage of ['verifier','directory'])test('C02 private '+stage+' failure is sanitized and not retried',async()=>{
 let calls=0;const rejecting=async()=>{calls++;throw Object.assign(Error('private-secret-body'),{status:403,code:'external_identity_not_linked'});};
 const h=await harness(stage==='verifier'?{verifier:{verify:rejecting}}:{directory:{lookup:rejecting}});
 await assert.rejects(h.resolver.resolve('flow'),(e:any)=>e.code==='external_identity_'+stage+'_unavailable'&&!e.message.includes('private'));assert.equal(calls,1);
});
test('C02 throwing clock is sanitized before any verifier or registry IO',async()=>{
 const h=await harness({clock:()=>{throw Error('private-clock');}});
 await assert.rejects(h.resolver.resolve('flow'),(e:any)=>e.code==='external_identity_clock_invalid'&&!e.message.includes('private'));
 assert.equal(h.calls.length,0);
});
test('C02 a pre-cancelled request performs no verification',async()=>{
 const h=await harness(),controller=new AbortController();controller.abort('private');
 await assert.rejects(h.resolver.resolve('flow',{signal:controller.signal}),error('external_identity_cancelled',409));assert.equal(h.calls.length,0);
});
test('C02 cancellation while verifying prevents a late result from reaching the registry',async()=>{
 const entered=deferred(),gate=deferred(),controller=new AbortController();let read=0,signal:AbortSignal|undefined;
 const h=await harness({verifier:{verify:async(_e:unknown,_n:unknown,s:AbortSignal)=>{signal=s;entered.resolve(null);return gate.promise;}},directory:{lookup:async()=>{read++;return [registration()];}}});
 const running=h.resolver.resolve('flow',{signal:controller.signal});const reject=assert.rejects(running,error('external_identity_cancelled',409));
 await entered.promise;controller.abort('private-reason');await reject;gate.resolve(observation());await new Promise(r=>setImmediate(r));
 assert.equal(signal!.aborted,true);assert.equal(read,0);
});
test('C02 cancellation during registry lookup never returns the stale match',async()=>{
 const entered=deferred(),gate=deferred(),controller=new AbortController();
 const h=await harness({directory:{lookup:async()=>{entered.resolve(null);return gate.promise;}}});
 const reject=assert.rejects(h.resolver.resolve('flow',{signal:controller.signal}),error('external_identity_cancelled',409));
 await entered.promise;controller.abort();await reject;gate.resolve([registration()]);
});
test('C02 one bounded deadline covers the verifier and aborts its signal without retries',async()=>{
 let calls=0,signal:AbortSignal|undefined;
 const h=await harness({timeoutMs:10,verifier:{verify:async(_e:unknown,_n:unknown,s:AbortSignal)=>{signal=s;calls++;return new Promise(()=>{});}}});
 await assert.rejects(h.resolver.resolve('flow'),error('external_identity_timeout',503));assert.equal(calls,1);assert.equal(signal!.aborted,true);
});
test('C02 a verifier that rejects late after cancellation is observed without unhandled rejection',async()=>{
 const entered=deferred(),gate=deferred(),controller=new AbortController();
 const h=await harness({verifier:{verify:async()=>{entered.resolve(null);return gate.promise;}}});
 const reject=assert.rejects(h.resolver.resolve('flow',{signal:controller.signal}),error('external_identity_cancelled'));
 await entered.promise;controller.abort();await reject;gate.reject(Error('private-late'));await new Promise(r=>setImmediate(r));
});
test('C02 concurrent resolutions keep identity data and cancellation independent',async()=>{
 const a=deferred(),b=deferred(),both=deferred();let count=0;const controller=new AbortController();
 const h=await harness({verifier:{verify:async(e:unknown)=>{if(++count===2)both.resolve(null);return e==='a'?a.promise:b.promise;}}});
 const one=h.resolver.resolve('a',{signal:controller.signal}),two=h.resolver.resolve('b');const denied=assert.rejects(one,error('external_identity_cancelled'));
 await both.promise;controller.abort();b.resolve(observation());assert.equal((await two).principalId,principalId);await denied;a.resolve(observation());
});
test('C02 malformed registry arrays and descriptors never execute injected accessors',async()=>{
 let reads=0;const getter=[registration()];Object.defineProperty(getter,'0',{get(){reads++;return registration();},enumerable:true});
 const sparse=new Array(1),proxy=new Proxy([registration()],{ownKeys(){reads++;throw Error('private');}});
 for(const rows of [getter,sparse,proxy,{},null,[null]]){
  const h=await harness();h.setRows(rows);await assert.rejects(h.resolver.resolve('flow'),error('external_identity_directory_invalid',503));
 }
 assert.equal(reads,0);
});
test('C02 constructing from a candidate manifest alone cannot supply authentication or directory ports',async()=>{
 const create=await factory();for(const value of [null,{}, {namespace:{issuer,clientId},liveAdapterAllowed:false},
  {namespace:{issuer,clientId},verifier:{verify:true},directory:{}},
  {namespace:{issuer,clientId},verifier:{verify:()=>null},directory:{lookup:()=>[]},timeoutMs:Infinity,maxObservationAgeMicros:1n}]){
  assert.throws(()=>create(value),error('external_identity_configuration_invalid',500));
 }
});
