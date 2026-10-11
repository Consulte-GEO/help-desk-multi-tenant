import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash} from '../src/domain/canonical.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at='2026-10-09T12:00:10.123000Z',start='2026-10-09T12:00:00.123000Z',end='2026-10-09T12:01:00.123000Z';
const key='synthetic-publication-001';
const target=()=>({principalId:id(1),workspaceId:id(2),accountId:id(3),bindingId:id(4),connectionId:id(5),tenantId:'Tenant-A',operation:'tickets.read'});
const snapshot=()=>({target:target(),manifestFingerprint:'a'.repeat(64),bindingRevision:'binding-v1',accessRevision:'source-v1',asOf:start,expiresAt:end,state:'active',complete:true,
 resources:['A','B'].map(id=>({connectionId:target().connectionId,tenantId:'Tenant-A',type:'work',id}))});
async function factory(){
 const name='../src/application/resource-grant-publisher.ts';const mod=await import(name).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof mod.createResourceGrantPublisher,'function','CG03f server publisher is missing');return mod.createResourceGrantPublisher;
}
/** Transactional reference model ONLY, not a PostgreSQL store or distributed-lock test.
 * State is staged on a private clone and committed with its receipt together.
 */
function referenceStore(){
 let current:any={revision:'0',snapshot:null};const receipts=new Map<string,any>();let commits=0,replacements=0,transactions=0;
 let turn=Promise.resolve(),hook:((stage:string)=>void)|undefined,ack:(x:any)=>unknown=x=>x,loseAck=false;
 return {
  runPublication:async(t:any,k:string,admit:()=>void,work:(tx:any)=>Promise<any>)=>{
   transactions++;admit();const previous=turn;let release!:()=>void;turn=new Promise<void>(r=>{release=r;});await previous;
   try{
    admit();let next=structuredClone(current),nextReceipt:any,replaceCalled=false;
    const tx={
     findReceipt:async()=>{hook?.('receipt');return receipts.get(requestHash(t)+k)??null;},
     readState:async()=>{hook?.('state');return structuredClone(next);},
     replaceGrant:async(plan:any)=>{hook?.('replace');admit();replaceCalled=true;
      // The fake simulates multiple revision advances from existing child triggers.
      next={revision:String(BigInt(next.revision)+3n),snapshot:structuredClone(plan.snapshot)};
      return ack({revision:next.revision,snapshotHash:plan.snapshotHash});},
     appendReceipt:async(value:any)=>{hook?.('append');admit();nextReceipt=structuredClone(value);return true;},
    };
    const result=await work(tx);hook?.('before_commit');admit();
    if(replaceCalled){current=next;replacements++;}if(nextReceipt)receipts.set(requestHash(t)+k,nextReceipt);commits++;
    hook?.('after_commit');if(loseAck){loseAck=false;throw new HelpdeskError(503,'transaction_outcome_unknown','synthetic missing ack');}
    return result;
   }finally{release();}
  },
  state:()=>structuredClone(current),counts:()=>({commits,replacements,transactions,receipts:receipts.size}),
  seed:(state:any)=>{current=structuredClone(state);},hook:(fn:typeof hook)=>{hook=fn;},ack:(fn:typeof ack)=>{ack=fn;},loseAck:()=>{loseAck=true;},
  corruptReceipt:(fn:(x:any)=>void)=>{for(const r of receipts.values())fn(r);}
 };
}
async function fixture(store=referenceStore()){
 let value:any=snapshot(),tick=at,sourceCalls=0;let clockHook:(()=>string)|undefined;let sourceHook:((t:any,s:AbortSignal)=>Promise<unknown>)|undefined;
 const create=await factory();const publisher=create({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:50,clock:()=>clockHook?clockHook():tick,
  source:{readCompleteCoverage:async(t:any,s:AbortSignal)=>{sourceCalls++;return sourceHook?sourceHook(t,s):structuredClone(value);}},store});
 return {publisher,store,time:(v:string)=>{tick=v;},source:(v:any)=>{value=v;},sourceHook:(fn:typeof sourceHook)=>{sourceHook=fn;},sourceCalls:()=>sourceCalls,clock:(fn:()=>string)=>{clockHook=fn;},
  publish:(expected='0',k=key,t:any=target(),signal?:AbortSignal)=>publisher.publish(t,expected,k,signal)};
}
test('CG03f source observation is published with one atomic revision and receipt',async()=>{
 const f=await fixture(),r=await f.publish();assert.equal(r.replayed,false);assert.equal(r.receipt.revision,'3');
 assert.equal(r.receipt.previousRevision,'0');assert.equal(r.receipt.resourceCount,2);assert.deepEqual(f.store.state().snapshot.resources.map((r:any)=>r.id),['A','B']);
 assert.deepEqual(f.store.counts(),{transactions:1,commits:1,replacements:1,receipts:1});
});
test('CG03f durable replay returns the original receipt without republishing refreshed source data',async()=>{
 const f=await fixture(),first=await f.publish(),newer=snapshot();newer.asOf='2026-10-09T12:00:01.123000Z';newer.accessRevision='source-v2';newer.resources=[];newer.state='revoked';f.source(newer);
 const replay=await f.publish();assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,first.receipt);
 assert.equal(f.store.counts().replacements,1);assert.equal(f.sourceCalls(),2);
});
test('CG03f same key with changed expected revision conflicts instead of replacing the receipt',async()=>{
 const f=await fixture();await f.publish();await assert.rejects(f.publish('3'),{code:'resource_publication_conflict'});
 assert.equal(f.store.counts().replacements,1);
});
test('CG03f an acknowledged commit remains acknowledged after late expiry',async()=>{
 const f=await fixture();f.store.hook(stage=>{if(stage==='after_commit')f.time(end);});assert.equal((await f.publish()).receipt.revision,'3');
});
test('CG03f lost COMMIT ack is not retried; same-key reconciliation finds the single stored receipt',async()=>{
 const f=await fixture();f.store.loseAck();await assert.rejects(f.publish(),{code:'transaction_outcome_unknown'});
 assert.equal(f.store.counts().replacements,1);assert.equal(f.store.counts().receipts,1);
 const replay=await f.publish();assert.equal(replay.replayed,true);assert.equal(f.store.counts().replacements,1);
});
test('CG03f failed receipt append rolls back staged coverage and does not acknowledge publication',async()=>{
 const f=await fixture();f.store.hook(stage=>{if(stage==='append')throw Error('private transport detail');});
 await assert.rejects(f.publish());assert.deepEqual(f.store.state(),{revision:'0',snapshot:null});assert.equal(f.store.counts().commits,0);
});
for(const response of [null,{}, {revision:'0',snapshotHash:'a'.repeat(64)}, {revision:'1',snapshotHash:'a'.repeat(64)}, {revision:1,snapshotHash:'a'.repeat(64)}])test('CG03f invalid replacement acknowledgement rolls back '+JSON.stringify(response),async()=>{
 const f=await fixture();f.store.ack(()=>response);await assert.rejects(f.publish(),{code:'resource_publication_store_invalid'});
 assert.equal(f.store.counts().replacements,0);assert.equal(f.store.counts().receipts,0);
});
for(const field of ['principalId','workspaceId','accountId','bindingId','connectionId','tenantId','operation'])test('CG03f qualified source cannot be substituted with wrong target '+field,async()=>{
 const f=await fixture(),s=snapshot();(s.target as any)[field]=field.endsWith('Id')?id(99):field==='operation'?'tickets.write':'Other';f.source(s);
 await assert.rejects(f.publish());assert.equal(f.store.counts().transactions,0);
});
test('CG03f caller-approved manifest cannot replace the configured source fingerprint',async()=>{
 const f=await fixture(),s=snapshot();s.manifestFingerprint='b'.repeat(64);f.source(s);
 await assert.rejects(f.publish(),{code:'resource_publication_source_invalid'});assert.equal(f.store.counts().transactions,0);
});
test('CG03f caller request is detached before source wait',async()=>{
 const f=await fixture(),t=target();let seen:any;
 f.sourceHook(async q=>{seen=q;t.accountId=id(99);await Promise.resolve();return snapshot();});
 await f.publish('0',key,t);assert.equal(seen.accountId,target().accountId);assert.equal(f.store.state().snapshot.target.accountId,target().accountId);assert.equal(Object.isFrozen(seen),true);
});
test('CG03f source exception never opens a publication transaction or exposes private details',async()=>{
 const f=await fixture();f.sourceHook(async()=>{throw Error('private source secret');});
 await assert.rejects(f.publish(),(e:any)=>e.code==='resource_publication_source_unavailable'&&!/private|secret/.test(e.message));
 assert.equal(f.store.counts().transactions,0);
});
test('CG03f missing mapping is denied, not treated as empty coverage',async()=>{
 const f=await fixture();f.source(null);await assert.rejects(f.publish(),{code:'resource_publication_source_denied'});assert.equal(f.store.counts().transactions,0);
});
test('CG03f an incomplete source response is not truncated or published',async()=>{
 const f=await fixture(),s=snapshot();s.complete=false;f.source(s);await assert.rejects(f.publish(),{code:'resource_publication_source_invalid'});assert.equal(f.store.counts().transactions,0);
});
test('CG03f timeout ignores a source response that arrives after the deadline',async t=>{
 // Test the exact configured deadline without depending on host scheduling/load.
 t.mock.timers.enable({apis:['setTimeout']});
 const f=await fixture();let finish!:(value:unknown)=>void,entered!:()=>void,signal:AbortSignal|undefined;
 const started=new Promise<void>(r=>{entered=r;});
 f.sourceHook(async(_q,s)=>{signal=s;entered();return new Promise(r=>{finish=r;});});
 const rejected=assert.rejects(f.publish(),{code:'resource_publication_source_unavailable'});
 await started;t.mock.timers.tick(50);await rejected;finish(snapshot());await Promise.resolve();
 assert.equal(signal?.aborted,true);assert.equal(f.store.counts().transactions,0);
});
test('CG03f pre-aborted calls do not read source or open a transaction',async()=>{
 const f=await fixture(),c=new AbortController();c.abort();await assert.rejects(f.publish('0',key,target(),c.signal));
 assert.equal(f.sourceCalls(),0);assert.equal(f.store.counts().transactions,0);
});
for(const phase of ['state','replace','append','before_commit'])test('CG03f expiry during '+phase+' prevents publication',async()=>{
 const f=await fixture();f.store.hook(s=>{if(s===phase)f.time(end);});await assert.rejects(f.publish(),{code:'resource_publication_stale'});
 assert.equal(f.store.counts().commits,0);assert.equal(f.store.counts().replacements,0);
});
test('CG03f invalid clock before source lookup is safely refused',async()=>{
 const f=await fixture();f.time('invalid');await assert.rejects(f.publish(),{code:'resource_publication_clock_invalid'});assert.equal(f.sourceCalls(),0);
});
test('CG03f clock rollback cannot publish a previously valid snapshot',async()=>{
 const f=await fixture();f.store.hook(s=>{if(s==='state')f.time('2026-10-09T12:00:09.123000Z');});
 await assert.rejects(f.publish(),{code:'resource_publication_clock_invalid'});assert.equal(f.store.counts().replacements,0);
});
test('CG03f stored receipt tampering is refused rather than treated as missing',async()=>{
 const f=await fixture();await f.publish();f.store.corruptReceipt(r=>{r.snapshotHash='bad';});
 await assert.rejects(f.publish(),{code:'resource_publication_store_invalid'});assert.equal(f.store.counts().replacements,1);
});
test('CG03f two concurrent publications against the same revision produce one winner',async()=>{
 const shared=referenceStore(),a=await fixture(shared),b=await fixture(shared);
 const result=await Promise.allSettled([a.publish('0','synthetic-intent-0001'),b.publish('0','synthetic-intent-0002')]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);assert.equal(shared.counts().replacements,1);
});
test('CG03f concurrent retries of the same intent return the same single receipt',async()=>{
 const shared=referenceStore(),a=await fixture(shared),b=await fixture(shared);
 const [x,y]=await Promise.all([a.publish(),b.publish()]);assert.deepEqual(x.receipt,y.receipt);assert.equal(x.replayed!==y.replayed,true);assert.equal(shared.counts().replacements,1);
});
test('CG03f delayed source response cannot overwrite a newer committed observation',async t=>{
 // This scenario isolates ordering/CAS; deadline expiration is tested separately.
 // No product timeout is raised, and no sleep is used as a synchronization primitive.
 t.mock.timers.enable({apis:['setTimeout']});
 const shared=referenceStore(),slow=await fixture(shared),fast=await fixture(shared);let release!:(x:any)=>void,entered!:()=>void;
 const started=new Promise<void>(r=>{entered=r;});
 slow.sourceHook(async()=>{entered();return new Promise(r=>{release=r;});});
 const late=slow.publish('0','synthetic-slow-intent');
 const rejected=assert.rejects(late,{code:'resource_publication_conflict'});
 await started;const newer=snapshot();newer.asOf='2026-10-09T12:00:01.123000Z';newer.accessRevision='source-v2';newer.resources=[];newer.state='revoked';fast.source(newer);
 try{await fast.publish('0','synthetic-fast-intent');}finally{release(snapshot());}
 await rejected;assert.equal(shared.state().snapshot.state,'revoked');
});
test('CG03f bad idempotency keys cannot dispatch to source',async()=>{
 const f=await fixture();await assert.rejects(f.publish('0','short'),{code:'resource_publication_invalid'});assert.equal(f.sourceCalls(),0);
});

test('CG03f every clock reading is checked for rollback, including the planning boundary',async()=>{
 const f=await fixture();let reads=0;f.clock(()=>++reads===9?'2026-10-09T12:00:09.123000Z':at);
 await assert.rejects(f.publish(),{code:'resource_publication_clock_invalid'});assert.equal(f.store.counts().replacements,0);
});
test('CG03f typed transport errors cannot leak private driver details',async()=>{
 const f=await fixture();f.store.hook(s=>{if(s==='replace')throw new HelpdeskError(503,'private_driver_code','private credential detail');});
 await assert.rejects(f.publish(),(e:any)=>e.code==='resource_publication_store_invalid'&&!/private|credential/.test(e.message));
 assert.equal(f.store.counts().commits,0);
});
test('CG03f a store that never ran the callback cannot acknowledge publication',async()=>{
 const create=await factory();const p=create({source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:50,clock:()=>at,
  store:{runPublication:async()=>({success:true})}});
 await assert.rejects(p.publish(target(),'0',key),{code:'resource_publication_outcome_unknown'});
});

test('CG03f malformed current database state is a persistence failure, not caller input or empty grant',async()=>{
 const f=await fixture();f.store.seed({revision:'3',snapshot:null});
 await assert.rejects(f.publish('3'),{code:'resource_publication_store_invalid'});assert.equal(f.store.counts().replacements,0);
});
