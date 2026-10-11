import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {requestHash} from '../src/domain/canonical.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import {parseResourceGrantTarget,normalizeResourceGrantSnapshot,planResourcePublication} from '../src/domain/resource-publication.ts';
import {createResourceGrantPublisher} from '../src/application/resource-grant-publisher.ts';
import type {SqlPool,SqlClient,SqlResult} from '../src/infrastructure/sql.ts';
import type {ResourceGrantPublicationStore} from '../src/application/resource-grant-publisher.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const target=()=>parseResourceGrantTarget({principalId:id(1),workspaceId:id(2),accountId:id(3),bindingId:id(4),connectionId:id(5),tenantId:'Tenant-A',operation:'tickets.read'});
const at='2026-10-09T12:00:10.123000Z',key='synthetic-publication-001';
const snapshot=()=>normalizeResourceGrantSnapshot({target:target(),manifestFingerprint:'a'.repeat(64),bindingRevision:'b1',accessRevision:'a1',asOf:'2026-10-09T12:00:00.123001Z',expiresAt:'2026-10-09T12:01:00.123001Z',state:'active',complete:true,resources:['0001','A'].map(id=>({connectionId:target().connectionId,tenantId:'Tenant-A',type:'work',id}))});
const plan=()=>planResourcePublication({revision:'0',snapshot:null},snapshot(),'0',at,60_000_000n);
const receipt=()=>({key,commandHash:requestHash({target:target(),expectedRevision:'0'}),targetHash:requestHash(target()),previousRevision:'0',revision:'4',snapshotHash:plan().snapshotHash,state:'active' as const,resourceCount:2,asOf:snapshot().asOf,expiresAt:snapshot().expiresAt});
const invalid={code:'resource_publication_store_invalid'};
async function factory():Promise<(p:SqlPool)=>ResourceGrantPublicationStore>{
 const path='../src/infrastructure/resource-grant-publication-store.ts';
 const module=await import(path).catch((error:unknown)=>{if((error as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
 assert.equal(typeof module.createPostgresResourceGrantPublicationStore,'function','CG03g PostgreSQL publication adapter is missing');return module.createPostgresResourceGrantPublicationStore;
}
/** Driver fault harness, NOT a database: records actual adapter SQL and emulates only responses.
 * These tests prove dispatch/validation/lifecycle, not PostgreSQL syntax, RLS or locking. */
function transport(){
 const events:string[]=[],values:unknown[][]=[],releases:(Error|undefined)[]=[];let connections=0,ends=0;
 let respond:((stage:string,r:SqlResult)=>Promise<SqlResult>|SqlResult)|undefined;
 const client=Object.assign(new EventEmitter(),{query:async(sql:string,params?:unknown[])=>{
  const stage=sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'?sql:sql.includes('set_config')?'context':sql.includes('pg_roles')?'role':sql.includes('cg_publication_open')?'open':sql.includes('cg_publication_replace')?'replace':sql.includes('cg_publication_append')?'append':'UNEXPECTED';
  events.push(stage);values.push(params??[]);assert.notEqual(stage,'UNEXPECTED',sql);
  const r:SqlResult=['BEGIN','COMMIT','ROLLBACK'].includes(stage)?{command:stage,rows:[],rowCount:null}:{command:'SELECT',rowCount:1,rows:[stage==='role'?{role:'helpdesk_resource_publisher',login:'helpdesk_resource_publisher',superuser:false,bypass_rls:false,create_role:false,create_db:false,inherit:false,replication:false,member_of_role:false,owns_private_objects:false,owns_objects:false}:stage==='open'?{publication:{receipt:null,current:{revision:'0',snapshot:null}}}:stage==='replace'?{publication:{revision:'4',snapshotHash:plan().snapshotHash}}:stage==='append'?{publication:true}:{}]};
  return respond?respond(stage,r):r;
 },release:(error?:Error)=>{events.push('release');releases.push(error);}}) as SqlClient;
 const pool:SqlPool={connect:async()=>{connections++;events.push('connect');return client;},query:async()=>{throw Error('pool.query must not be used');},end:async()=>{ends++;}};
 return {pool,events,values,releases,counts:()=>({connections,ends}),hook:(fn:typeof respond)=>{respond=fn;},client};
}
async function fixture(){const h=transport(),create=await factory();return {...h,store:create(h.pool)};}
async function publish(f:Awaited<ReturnType<typeof fixture>>,admit=()=>{}){
 return f.store.runPublication(target(),key,admit,async tx=>{
  assert.equal(await tx.findReceipt(),null);assert.deepEqual(await tx.readState(),{revision:'0',snapshot:null});
  assert.deepEqual(await tx.replaceGrant(plan()),{revision:'4',snapshotHash:plan().snapshotHash});
  assert.equal(await tx.appendReceipt(receipt()),true);return 'confirmed';
 });
}
test('CG03g publication uses one connection and confirms only after receipt and COMMIT',async()=>{
 const f=await fixture();assert.equal(await publish(f),'confirmed');
 assert.deepEqual(f.events,['connect','BEGIN','context','role','open','replace','append','COMMIT','release']);
 assert.deepEqual(f.counts(),{connections:1,ends:0});assert.deepEqual(f.releases,[undefined]);
 assert.deepEqual(f.values[f.events.indexOf('context')-1],['','']);
});
test('CG03g source text is passed as parameters, preserving exact microseconds and source IDs',async()=>{
 const f=await fixture();await publish(f);const args=f.values[f.events.indexOf('replace')-1];
 assert.ok(args,'The replace command must have recorded its SQL parameters.');
 assert.ok(args.some(x=>typeof x==='string'&&x.includes('123001Z')));assert.ok(args.some(x=>typeof x==='string'&&x.includes('0001')));
});
test('CG03g historical receipt replay dispatches no replacement or append',async()=>{
 const f=await fixture();f.hook((s,r)=>s==='open'?{...r,rows:[{publication:{receipt:receipt(),current:null}}]}:r);
 const got=await f.store.runPublication(target(),key,()=>{},async tx=>await tx.findReceipt());
 assert.deepEqual(got,receipt());assert.deepEqual(f.events,['connect','BEGIN','context','role','open','COMMIT','release']);
});
for(const [field,value] of [['role','helpdesk_app'],['login','postgres'],['superuser',true],['bypass_rls',true],['create_role',true],['create_db',true],['inherit',true],['member_of_role',true],['owns_private_objects',true],['replication',true],['owns_objects',true]] as const)test('CG03g denies unsafe publisher role '+field,async()=>{
 const f=await fixture();f.hook((s,r)=>s==='role'?{...r,rows:[{...r.rows[0],[field]:value}]}:r);
 await assert.rejects(publish(f),{code:'resource_publication_publisher_denied'});assert.ok(!f.events.includes('open'));assert.ok(!f.events.includes('COMMIT'));
});
for(const stage of ['role','open','replace','append'])test('CG03g raw SQL failure at '+stage+' is sanitized and rolls back once',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s===stage)throw Object.assign(Error('private-driver-password'),{code:'XX000'});return r;});
 await assert.rejects(publish(f),(e:any)=>e.code==='resource_publication_store_invalid'&&!/private|password/.test(e.message));
 assert.ok(!f.events.includes('COMMIT'));assert.equal(f.events.filter(x=>x==='ROLLBACK').length,1);assert.equal(f.counts().connections,1);
});
for(const result of [undefined,null,{}, {command:'UPDATE',rowCount:1,rows:[{publication:true}]},{command:'SELECT',rowCount:0,rows:[]},{command:'SELECT',rowCount:2,rows:[{},{}]}])test('CG03g malformed SQL result is not success '+JSON.stringify(result),async()=>{
 const f=await fixture();f.hook((s,r)=>s==='append'?result as SqlResult:r);await assert.rejects(publish(f),invalid);assert.ok(!f.events.includes('COMMIT'));
});
for(const payload of [undefined,{},true,{receipt:null,current:null},{receipt:null,current:{revision:'1',snapshot:null}}])test('CG03g malformed locked state fails closed '+JSON.stringify(payload),async()=>{
 const f=await fixture();f.hook((s,r)=>s==='open'?{...r,rows:[{publication:payload}]}:r);
 await assert.rejects(publish(f),invalid);assert.ok(!f.events.includes('replace'));
});
test('CG03g private persisted snapshot cannot switch publication target',async()=>{
 const f=await fixture(),other=structuredClone(snapshot());(other.target as any).accountId=id(99);
 f.hook((s,r)=>s==='open'?{...r,rows:[{publication:{receipt:null,current:{revision:'3',snapshot:other}}}]}:r);
 await assert.rejects(publish(f),invalid);assert.ok(!f.events.includes('replace'));
});
for(const payload of [{revision:4,snapshotHash:plan().snapshotHash},{revision:'0',snapshotHash:plan().snapshotHash},{revision:'4',snapshotHash:'0'.repeat(64)},{revision:'9223372036854775808',snapshotHash:plan().snapshotHash}])test('CG03g replacement acknowledgement is validated '+JSON.stringify(payload),async()=>{
 const f=await fixture();f.hook((s,r)=>s==='replace'?{...r,rows:[{publication:payload}]}:r);await assert.rejects(publish(f),invalid);assert.ok(!f.events.includes('append'));assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g callback cannot omit the immutable receipt and still COMMIT',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();await tx.replaceGrant(plan());return 1;}),invalid);assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g receipt without a replacement is rejected before its SQL',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},tx=>tx.appendReceipt(receipt())),invalid);assert.ok(!f.events.includes('append'));
});
test('CG03g catching an invalid phase cannot revive that transaction',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{try{await tx.readState();}catch{}return 1;}),invalid);assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g changed receipt cannot be recorded even when its revision looks valid',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();await tx.replaceGrant(plan());return tx.appendReceipt({...receipt(),resourceCount:1});}),invalid);assert.ok(!f.events.includes('append'));
});
test('CG03g changed plan target cannot retarget the locked row',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();return tx.replaceGrant({...plan(),target:{...target(),principalId:id(99)}});}),invalid);assert.ok(!f.events.includes('replace'));
});
test('CG03g callback-owned transaction is unusable after commit',async()=>{
 const f=await fixture();let held:any;await f.store.runPublication(target(),key,()=>{},async tx=>{held=tx;await tx.findReceipt();await tx.readState();await tx.replaceGrant(plan());await tx.appendReceipt(receipt());});
 const count=f.events.length;await assert.rejects(held.findReceipt(),invalid);assert.equal(f.events.length,count);
});
test('CG03g failing admission rolls back even when caught in the callback',async()=>{
 const f=await fixture();let deny=false;const reason=new HelpdeskError(409,'resource_publication_cancelled','Cancelled');
 f.hook((s,r)=>{if(s==='replace')deny=true;return r;});await assert.rejects(publish(f,()=>{if(deny)throw reason;}),e=>e===reason);assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g confirmed COMMIT is preserved if admission changes after dispatch',async()=>{
 const f=await fixture();let deny=false;f.hook((s,r)=>{if(s==='COMMIT')deny=true;return r;});
 assert.equal(await publish(f,()=>{if(deny)throw new HelpdeskError(409,'late','Late');}),'confirmed');
});
test('CG03g lost COMMIT confirmation is unknown and never retries the publication',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='COMMIT')throw Error('private acknowledgment');return r;});
 await assert.rejects(publish(f),{code:'transaction_outcome_unknown'});assert.equal(f.events.filter(x=>x==='replace').length,1);assert.equal(f.counts().connections,1);assert.ok(f.releases[0]);
});
for(const action of [async(f:Awaited<ReturnType<typeof fixture>>)=>f.store.runPublication({...target(),principalId:'not-uuid'},key,()=>{},async()=>1),async(f:Awaited<ReturnType<typeof fixture>>)=>f.store.runPublication(target(),'short',()=>{},async()=>1)])test('CG03g invalid publication input never acquires a connection',async()=>{
 const f=await fixture();await assert.rejects(action(f));assert.equal(f.counts().connections,0);
});
test('CG03g the real publisher composes with the PostgreSQL adapter on the driver harness',async()=>{
 const f=await fixture();const publisher=createResourceGrantPublisher({store:f.store,source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 const r=await publisher.publish(target(),'0',key);assert.equal(r.replayed,false);assert.equal(r.receipt.revision,'4');assert.equal(f.events.at(-2),'COMMIT');
});
test('CG03g outstanding unawaited SQL is drained before rollback/release',async()=>{
 const f=await fixture();let unblock!:()=>void,entered!:()=>void;const began=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{unblock=r;});
 f.hook(async(s,r)=>{if(s==='replace'){entered();await gate;}return r;});
 const work=f.store.runPublication(target(),key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();void tx.replaceGrant(plan());await began;return 1;});
 const rejected=assert.rejects(work,invalid);await began;await new Promise<void>(r=>setImmediate(r));
 try{assert.ok(!f.events.includes('release'));assert.ok(!f.events.includes('ROLLBACK'));}finally{unblock();}
 await rejected;assert.ok(f.events.includes('ROLLBACK'));assert.ok(!f.events.includes('COMMIT'));
});

test('CG03g review snapshots caller target before waiting for the pool',async()=>{
 const create=await factory(),f=transport(),input={...target()};
 const pool={...f.pool,connect:async()=>{input.accountId=id(99);return f.pool.connect();}};
 const store=create(pool);await store.runPublication(input,key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();await tx.replaceGrant(plan());await tx.appendReceipt(receipt());});
 const args=f.values[f.events.indexOf('open')-1];
 assert.ok(args,'The open command must have recorded its SQL parameters.');
 assert.equal(typeof args[0],'string');
 const sent=JSON.parse(String(args[0]));assert.equal(sent.accountId,target().accountId);
});
test('CG03g review double invocation of a transaction method never dispatches a second command',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{await Promise.allSettled([tx.findReceipt(),tx.findReceipt()]);return 1;}),invalid);
 assert.equal(f.events.filter(x=>x==='open').length,1);assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g review returning from an untouched transaction is not publication success',async()=>{
 const f=await fixture();await assert.rejects(f.store.runPublication(target(),key,()=>{},async()=>42),invalid);assert.ok(!f.events.includes('COMMIT'));
});
test('CG03g review plan getters and serializers are never used to choose SQL data',async()=>{
 const f=await fixture();let calls=0;const changed={...plan()};Object.defineProperty(changed,'snapshot',{enumerable:true,get:()=>{calls++;return snapshot();}});
 await assert.rejects(f.store.runPublication(target(),key,()=>{},async tx=>{await tx.findReceipt();await tx.readState();return tx.replaceGrant(changed);}),invalid);
 assert.equal(calls,0);assert.ok(!f.events.includes('replace'));
});
test('CG03g review extra SQL output columns cannot be treated as a verified acknowledgement',async()=>{
 const f=await fixture();f.hook((s,r)=>s==='append'?{...r,rows:[{publication:true,approved:true}]}:r);await assert.rejects(publish(f),invalid);assert.ok(!f.events.includes('COMMIT'));
});
for(const code of ['PGR01','40001','40P01','55P03'])test('CG03g review conflict '+code+' is sanitized and never retried',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='replace')throw Object.assign(Error('private driver statement'),{code});return r;});
 await assert.rejects(publish(f),(e:any)=>e.code==='resource_publication_conflict'&&!e.message.includes('private'));assert.equal(f.events.filter(x=>x==='replace').length,1);assert.ok(!f.events.includes('COMMIT'));
});
for(const code of ['PGR02','42501'])test('CG03g review denial '+code+' does not expose database text',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='open')throw Object.assign(Error('private account details'),{code});return r;});
 await assert.rejects(publish(f),(e:any)=>e.code==='resource_publication_publisher_denied'&&!e.message.includes('private'));assert.ok(!f.events.includes('replace'));
});
test('CG03g review a synthetic fatal connection event preserves rollback and unknown distinctions',async()=>{
 for(const stage of ['replace','COMMIT']){
  const f=await fixture();f.hook((s,r)=>{if(s===stage)(f.client as any).emit('error',Error('private transport'));return r;});
  await assert.rejects(publish(f),{code:stage==='COMMIT'?'transaction_outcome_unknown':'database_unavailable'});assert.equal(f.releases.length,1);assert.ok(f.releases[0]);
 }
});

function composedPublisher(f:Awaited<ReturnType<typeof fixture>>){
 return createResourceGrantPublisher({store:f.store,source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
}
test('CG03h the composed publisher reports a denied login as denial, not an unknown publication',async()=>{
 const f=await fixture();f.hook((s,r)=>s==='role'?{...r,rows:[{...r.rows[0],role:'helpdesk_app'}]}:r);
 await assert.rejects(composedPublisher(f).publish(target(),'0',key),{status:403,code:'resource_publication_publisher_denied'});
 assert.ok(!f.events.includes('open'));assert.ok(!f.events.includes('replace'));assert.ok(!f.events.includes('COMMIT'));
});
for(const stage of ['open','replace'])test('CG03h composed publisher preserves a confirmed SQL revision conflict at '+stage,async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s===stage)throw Object.assign(Error('private source detail'),{code:'PGR01'});return r;});
 await assert.rejects(composedPublisher(f).publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.status===409&&e.code==='resource_publication_conflict'&&!e.message.includes('private'));
 assert.ok(!f.events.includes('COMMIT'));assert.equal(f.events.filter(x=>x==='ROLLBACK').length,1);
});
test('CG03h source mapping denial in SQL remains a sanitized 403 through both layers',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='open')throw Object.assign(Error('private mapping detail'),{code:'PGR02'});return r;});
 await assert.rejects(composedPublisher(f).publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.status===403&&e.code==='resource_publication_publisher_denied'&&!e.message.includes('private'));
 assert.ok(!f.events.includes('replace'));assert.ok(!f.events.includes('COMMIT'));
});
test('CG03h failed opening SQL before the application callback is invalid persistence, not a lost COMMIT',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='open')throw Error('private SQL details');return r;});
 await assert.rejects(composedPublisher(f).publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.code==='resource_publication_store_invalid'&&!e.message.includes('private'));
 assert.ok(!f.events.includes('replace'));assert.ok(!f.events.includes('COMMIT'));
});
test('CG03h lost COMMIT with a denial-shaped transport error remains unknown in the composition',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='COMMIT')throw Object.assign(Error('private acknowledgement'),{code:'PGR02'});return r;});
 await assert.rejects(composedPublisher(f).publish(target(),'0',key),{code:'transaction_outcome_unknown'});
 assert.equal(f.events.filter(x=>x==='replace').length,1);assert.equal(f.events.filter(x=>x==='COMMIT').length,1);
});
test('CG03h known store error after the callback returned its staged result cannot claim rollback',async()=>{
 const f=await fixture(),store:ResourceGrantPublicationStore={runPublication:async(t,k,a,work)=>{
  const value=await f.store.runPublication(t,k,a,work);assert.ok(value);
  throw new HelpdeskError(403,'resource_publication_publisher_denied','private late denial');
 }};
 const publisher=createResourceGrantPublisher({store,source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),{code:'resource_publication_outcome_unknown'});
 assert.equal(f.events.filter(x=>x==='COMMIT').length,1);
});
test('CG03h known pre-callback errors are rebuilt with a local status and safe message',async()=>{
 const publisher=createResourceGrantPublisher({store:{runPublication:async()=>{throw new HelpdeskError(200,'resource_publication_conflict','private SQL contents');}},source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.status===409&&e.code==='resource_publication_conflict'&&!e.message.includes('private'));
});
test('CG03h store error code getters are not executed by result classification',async()=>{
 let reads=0;const problem=Object.defineProperty(Error('private'), 'code', {get:()=>{reads++;return 'resource_publication_conflict';}});
 const publisher=createResourceGrantPublisher({store:{runPublication:async()=>{throw problem;}},source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),{code:'resource_publication_outcome_unknown'});assert.equal(reads,0);
});
test('CG03h cancellation during the source lookup remains cancellation and never enters persistence',async()=>{
 const f=await fixture(),controller=new AbortController();let entered!:()=>void,release!:()=>void,sourceSignal:AbortSignal|undefined;
 const began=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});
 const publisher=createResourceGrantPublisher({store:f.store,source:{readCompleteCoverage:async(_target,signal)=>{sourceSignal=signal;entered();await gate;return snapshot();}},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 const running=publisher.publish(target(),'0',key,controller.signal);
 const checked=assert.rejects(running,{status:409,code:'resource_publication_cancelled'});
 await began;controller.abort();
 try{await checked;assert.equal(sourceSignal?.aborted,true);assert.equal(f.counts().connections,0);}finally{release();}
});
test('CG03h source timeout remains unavailable, distinct from caller cancellation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=await fixture();let entered!:()=>void,release!:()=>void;const began=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});
 const publisher=createResourceGrantPublisher({store:f.store,source:{readCompleteCoverage:async()=>{entered();await gate;return snapshot();}},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 const running=publisher.publish(target(),'0',key);const checked=assert.rejects(running,{code:'resource_publication_source_unavailable'});
 await began;t.mock.timers.tick(1000);try{await checked;assert.equal(f.counts().connections,0);}finally{release();}
});
test('CG03h a throwing store error descriptor cannot escape the composed safe result',async()=>{
 const problem=new Proxy(Error('not returned'),{getOwnPropertyDescriptor(){throw Error('private descriptor details');}});
 const publisher=createResourceGrantPublisher({store:{runPublication:async()=>{throw problem;}},source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.code==='resource_publication_outcome_unknown'&&!e.message.includes('private'));
});
test('CG03h a throwing SQL error descriptor is sanitized by the adapter before leaving its transaction',async()=>{
 const f=await fixture();f.hook((s,r)=>{if(s==='open')throw new Proxy(Error('not returned'),{getOwnPropertyDescriptor(){throw Error('private SQL descriptor');}});return r;});
 await assert.rejects(publish(f),(e:unknown)=>e instanceof HelpdeskError&&e.code==='resource_publication_store_invalid'&&!e.message.includes('private'));
 assert.ok(!f.events.includes('COMMIT'));assert.equal(f.events.filter(x=>x==='ROLLBACK').length,1);
});

test('CG03i a store refusing a failed batch before a staged result is not an unknown publication',async()=>{
 const publisher=createResourceGrantPublisher({store:{runPublication:async()=>{
  throw new HelpdeskError(200,'transaction_statement_failed','private rejected statement');
 }},source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),(e:unknown)=>e instanceof HelpdeskError&&e.status===503
  &&e.code==='resource_publication_store_invalid'&&!e.message.includes('private'));
});
test('CG03i a statement-failure-shaped exception after a staged result cannot undo an acknowledged commit',async()=>{
 const f=await fixture();const store:ResourceGrantPublicationStore={runPublication:async(t,k,a,work)=>{
  await f.store.runPublication(t,k,a,work);throw new HelpdeskError(503,'transaction_statement_failed','private late failure');
 }};
 const publisher=createResourceGrantPublisher({store,source:{readCompleteCoverage:async()=>snapshot()},manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at});
 await assert.rejects(publisher.publish(target(),'0',key),{code:'resource_publication_outcome_unknown'});
 assert.equal(f.events.filter(x=>x==='COMMIT').length,1);assert.equal(f.events.filter(x=>x==='replace').length,1);
});
