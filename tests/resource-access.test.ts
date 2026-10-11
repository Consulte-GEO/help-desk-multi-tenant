import test from 'node:test';
import assert from 'node:assert/strict';
import type {Principal} from '../src/domain/model.ts';

// Only the authority boundary is synthetic. The resolver, parsing and policy are real.
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const W=id(1),P=id(2),A=id(3),C=id(4),B=id(5),M='a'.repeat(64);
const T='2026-10-09T10:00:00.000000Z';
const ref=(name='A',tenant='T1')=>({connectionId:C,tenantId:tenant,type:'work',id:name});
const person=(role:'requester'|'account_manager'|'agent'='requester'):Principal=>({id:P,kind:'human',workspaceId:W,workspaceRole:null,grants:[{accountId:A,role}],scopes:['contexts:resolve','tickets:read','tickets:write']});
const snapshot=(p=person())=>({operation:'tickets.read',principal:structuredClone(p),binding:{id:B,accountId:A,workspaceId:W,connectionId:C,tenantId:'T1',revision:'binding-r1',active:true},manifestFingerprint:M,accessRevision:'access-r1',asOf:T,expiresAt:'2026-10-09T10:00:02.000000Z',resources:[ref('A'),ref('B')]});
const denied={status:403,code:'resource_scope_denied'},unavailable={status:503,code:'resource_scope_unavailable'};
test('resource lookup refuses an overdue source even before its timeout callback runs',async t=>{
 let monotonic=0; t.mock.method(performance,'now',()=>monotonic);
 const create=await factory(); let sourceSignal:AbortSignal|undefined;
 const resolver=create({manifestFingerprint:M,maxAgeMicros:1_000_000n,timeoutMs:50,clock:()=>T,
  authority:{readAccess:async(_query:unknown,signal:AbortSignal)=>{
   sourceSignal=signal;monotonic=51;return snapshot();
  }}});
 await assert.rejects(resolver.resolveResourceScope(person(),[ref()],'tickets.read'),unavailable);
 assert.equal(sourceSignal?.aborted,true);
});

async function factory(){
 const path='../src/application/resource-access.ts';
 const api=await import(path).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof api.createResourceAccessResolver,'function','CG03b resource access resolver is missing');
 return api.createResourceAccessResolver as (options:any)=>any;
}
async function fixture(p=person()){
 const create=await factory();let tick=T,reads=0;let reply:any=snapshot(p);
 let handler:((query:any,signal:AbortSignal)=>Promise<unknown>)|undefined;
 const calls:any[]=[],signals:AbortSignal[]=[];
 const options={manifestFingerprint:M,maxAgeMicros:1_000_000n,timeoutMs:2000,clock:()=>tick,
  authority:{readAccess:async(q:any,s:AbortSignal)=>{reads++;calls.push(q);signals.push(s);return handler?handler(q,s):structuredClone(reply);}}};
 const resolver=create(options);
 return {resolver,options,p,reply,calls,signals,reads:()=>reads,setTime:(t:string)=>{tick=t;},respond:(r:any)=>{reply=r;},handle:(fn:typeof handler)=>{handler=fn;},resolve:(refs=[ref()],op='tickets.read')=>resolver.resolveResourceScope(p,refs,op),
  use:(proof:unknown,work=async(ctx:any)=>ctx,refs=[ref()],op='tickets.read',actor=p,signal?:AbortSignal)=>resolver.withResourceScope(actor,refs,op,proof,work,signal)};
}

test('CG03b no authority or explicit freshness policy means no resolver',async()=>{
 const create=await factory();for(const opts of [{},null,{authority:{readAccess:async()=>snapshot()}},
  {manifestFingerprint:M,maxAgeMicros:0n,timeoutMs:20,authority:{readAccess:async()=>snapshot()}},
  {manifestFingerprint:M,maxAgeMicros:10n,timeoutMs:0,authority:{readAccess:async()=>snapshot()}}])assert.throws(()=>create(opts));
});
test('CG03b resolve and consume revalidate twice and return only selected resources',async()=>{
 const f=await fixture(),proof=await f.resolve();assert.equal(f.reads(),1);
 assert.equal(Object.isFrozen(proof),true);assert.equal(JSON.stringify(proof),'{}');
 const ctx=await f.use(proof);assert.equal(f.reads(),2);assert.deepEqual(ctx.refs,[ref()]);
 assert.equal(ctx.principalId,P);assert.equal(ctx.workspaceId,W);assert.equal(ctx.accountId,A);assert.equal(ctx.bindingId,B);
 assert.equal(ctx.accessRevision,'access-r1');assert.equal(ctx.asOf,T);assert.equal(ctx.operation,'tickets.read');
 assert.ok(Object.isFrozen(ctx)&&Object.isFrozen(ctx.refs)&&Object.isFrozen(ctx.refs[0]));
 assert.equal(Object.hasOwn(ctx,'resources'),false);assert.equal(Object.hasOwn(ctx,'token'),false);
 await assert.rejects(f.use(proof),denied);assert.equal(f.reads(),2);
});
for(const role of ['requester','account_manager','agent'] as const)test('CG03b '+role+' cannot resolve unauthorized work or partial A+C',async()=>{
 const f=await fixture(person(role));await assert.rejects(f.resolve([ref('C')]),denied);await assert.rejects(f.resolve([ref('A'),ref('C')]),denied);
});
test('CG03b workspace admin still needs resource coverage and business scopes',async()=>{
 const p=person();p.workspaceRole='admin';p.grants=[];const f=await fixture(p);
 await assert.rejects(f.resolve([ref('C')]),denied);
 f.reply.principal.scopes=[];await assert.rejects(f.resolve(),denied);
});
for(const change of [(x:any)=>{x.binding.tenantId='T2';},(x:any)=>{x.binding.connectionId=id(99);},(x:any)=>{x.binding.workspaceId=id(99);},(x:any)=>{x.binding.accountId=id(99);},(x:any)=>{x.principal.id=id(99);},(x:any)=>{x.principal.workspaceId=id(99);},(x:any)=>{x.binding.active=false;},(x:any)=>{x.manifestFingerprint='b'.repeat(64);}])test('CG03b foreign/inactive namespace, person or manifest denied '+change.toString(),async()=>{
 const f=await fixture();change(f.reply);await assert.rejects(f.resolve(),denied);
});
for(const operation of ['tickets.delete','*','tickets:read','toString','__proto__','',null])test('CG03b operation is a closed contract '+String(operation),async()=>{
 const f=await fixture();await assert.rejects(f.resolve([ref()],operation as any),{status:400,code:'invalid_resource_operation'});assert.equal(f.reads(),0);
});
test('CG03b selectors stay exact and invalid/empty/duplicate selection never queries authority',async()=>{
 const f=await fixture();for(const refs of [[],[ref(),ref()],[ref(),ref('B','T2')]])await assert.rejects(f.resolve(refs),{status:400,code:'invalid_resource_selection'});
 assert.equal(f.reads(),0);f.reply.resources=[ref('0001')];const proof=await f.resolve([ref('0001')]);
 assert.deepEqual((await f.use(proof,async(c:any)=>c,[ref('0001')])).refs,[ref('0001')]);
 await assert.rejects(f.resolve([ref('1')]),denied);
});
test('CG03b caller role/metadata cannot replace live principal or account grants',async()=>{
 const p=person('account_manager'),f=await fixture(p);p.workspaceRole='admin';p.scopes.push('notes:read');
 await assert.rejects(f.resolve(),denied);assert.equal(f.reads(),1);
 const g=await fixture();g.reply.principal.grants=[];await assert.rejects(g.resolve(),denied);
});
test('CG03b machine identities cannot reach the human authority',async()=>{
 const f=await fixture();f.p.kind='integration';await assert.rejects(f.resolve(),denied);assert.equal(f.reads(),0);
});
for(const operation of ['notes.read','notes.write'])test('CG03b customer and account manager cannot use internal notes '+operation,async()=>{
 for(const role of ['requester','account_manager'] as const){const p=person(role);p.scopes.push('notes:read','notes:write');const f=await fixture(p);f.reply.operation=operation;await assert.rejects(f.resolve([ref()],operation),denied);}
});
test('CG03b notes-only writer does not need notes:read or tickets:write',async()=>{
 const p=person('agent');p.scopes=['tickets:read','notes:write'];const f=await fixture(p);f.reply.operation='notes.write';const proof=await f.resolve([ref()],'notes.write');
 await f.use(proof,async(c:any)=>assert.equal(c.operation,'notes.write'),[ref()],'notes.write');
 await assert.rejects(f.resolve([ref()],'notes.read'),denied);await assert.rejects(f.resolve([ref()],'tickets.write'),denied);
});
for(const op of ['tickets.read','tickets.write','notes.read','notes.write','contexts.resolve'])test('CG03b missing business scope never has a fallback '+op,async()=>{
 const p=person('agent');p.scopes=[];const f=await fixture(p);f.reply.operation=op;await assert.rejects(f.resolve([ref()],op),denied);
});
for(const edit of [(x:any)=>{delete x.accessRevision;},(x:any)=>{x.binding.revision='';},(x:any)=>{x.resources=[ref(),{...ref('B'),allowed:true}];},(x:any)=>{x.resources=[ref(),ref()];},(x:any)=>{x.resources=[ref(),ref('B','T2')];},(x:any)=>{x.approved=true;},(x:any)=>{x.asOf='2026-02-30T10:00:00.000Z';},(x:any)=>{x.expiresAt=T;},(x:any)=>{x.principal.grants.push({...x.principal.grants[0]});}])test('CG03b malformed whole response is not partial authorization '+edit.toString(),async()=>{
 const f=await fixture();edit(f.reply);await assert.rejects(f.resolve(),(e:any)=>[403,503].includes(e.status));
});
test('CG03b null response means no access, a provider error is sanitized unavailability',async()=>{
 const f=await fixture();f.respond(null);await assert.rejects(f.resolve(),denied);
 f.handle(async()=>{throw Error('SECRET-PRIVATE-URL');});await assert.rejects(f.resolve(),(e:any)=>e.code===unavailable.code&&!e.message.includes('SECRET'));
});
for(const target of ['top','principal','binding','scope','grant'])test('CG03b response getters are not invoked '+target,async()=>{
 const f=await fixture();let reads=0;const value=snapshot();
 const [obj,key]=target==='top'?[value,'resources']:target==='principal'?[value.principal,'workspaceRole']:target==='binding'?[value.binding,'accountId']:target==='scope'?[value.principal.scopes,'0']:[value.principal.grants[0],'role'];
 Object.defineProperty(obj,key,{get:()=>{reads++;throw Error('PRIVATE');},enumerable:true});f.handle(async()=>value);
 await assert.rejects(f.resolve(),unavailable);assert.equal(reads,0);
});
test('CG03b provider cannot mutate the captured query, and later input changes do not rewrite selection',async()=>{
 const f=await fixture(),selected=[ref()];let captured:any;
 f.handle(async q=>{captured=q;assert.ok(Object.isFrozen(q)&&Object.isFrozen(q.refs)&&Object.isFrozen(q.refs[0]));return snapshot();});
 const proof=await f.resolve(selected);selected[0]!.id='C';assert.equal(captured.refs[0].id,'A');
 await assert.rejects(f.use(proof,async()=>assert.fail(),selected),denied);assert.equal(f.reads(),1);
});
for(const edit of [(x:any)=>{x.accessRevision='access-r2';},(x:any)=>{x.binding.revision='binding-r2';},(x:any)=>{x.binding.id=id(99);},(x:any)=>{x.binding.accountId=id(99);},(x:any)=>{x.principal.scopes=[];},(x:any)=>{x.principal.workspaceRole='admin';},(x:any)=>{x.resources=[ref('B')];},(x:any)=>{x.binding.active=false;}])test('CG03b revocation/change between resolve and consumption blocks work '+edit.toString(),async()=>{
 const f=await fixture(),proof=await f.resolve();edit(f.reply);let work=0;
 await assert.rejects(f.use(proof,async()=>{work++;}),denied);assert.equal(work,0);
 f.respond(snapshot());await assert.rejects(f.use(proof),denied);assert.equal(f.reads(),2);
});
test('CG03b proof cannot be forged, copied, used for another operation or another resolver',async()=>{
 const f=await fixture(),g=await fixture(),proof=await f.resolve();
 for(const fake of [true,{},null,{verified:true},JSON.parse(JSON.stringify(proof))])await assert.rejects(f.use(fake),denied);
 await assert.rejects(g.use(proof),denied);assert.equal(g.reads(),0);
 await assert.rejects(f.use(proof,async()=>assert.fail(),[ref()],'tickets.write'),denied);assert.equal(f.reads(),1);
});
test('CG03b proof consumption is single-use even with simultaneous callers',async()=>{
 const f=await fixture(),proof=await f.resolve();let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});let used=0;
 f.handle(async()=>{await gate;return snapshot();});const first=f.use(proof,async()=>{used++;});
 try{await assert.rejects(f.use(proof),denied);}finally{release();}
 await first;assert.equal(used,1);assert.equal(f.reads(),2);
});
test('CG03b unrelated concurrent proofs remain independent',async()=>{
 const f=await fixture();const [a,b]=await Promise.all([f.resolve(),f.resolve([ref('B')])]);
 const values=await Promise.all([f.use(a),f.use(b,async(c:any)=>c,[ref('B')])]);assert.deepEqual(values.map(x=>x.refs[0].id),['A','B']);
});
test('CG03b callback failure cannot resurrect proof or retry business work',async()=>{
 const f=await fixture(),proof=await f.resolve();let work=0;const error=Error('business error');
 await assert.rejects(f.use(proof,async()=>{work++;throw error;}),e=>e===error);await assert.rejects(f.use(proof),denied);
 assert.equal(work,1);assert.equal(f.reads(),2);
});
test('CG03b exact microseconds distinguish fresh, future and expired decisions',async()=>{
 const f=await fixture();f.reply.asOf='2026-10-09T10:00:00.000001Z';await assert.rejects(f.resolve(),denied);
 f.setTime('2026-10-09T10:00:00.000001Z');f.reply.expiresAt='2026-10-09T10:00:00.000002Z';const proof=await f.resolve();
 f.setTime('2026-10-09T10:00:00.000002Z');await assert.rejects(f.use(proof),denied);assert.equal(f.reads(),2);
});
test('CG03b maximum snapshot age is enforced before issuing or consuming proof',async()=>{
 const f=await fixture();f.setTime('2026-10-09T10:00:01.000001Z');await assert.rejects(f.resolve(),denied);
 f.setTime(T);const proof=await f.resolve();f.setTime('2026-10-09T10:00:01.000001Z');await assert.rejects(f.use(proof),denied);
});
test('CG03b revalidation cannot extend an already expired original proof',async()=>{
 const f=await fixture();f.reply.expiresAt='2026-10-09T10:00:00.500000Z';const proof=await f.resolve();
 f.handle(async()=>{f.setTime('2026-10-09T10:00:00.500000Z');const v=snapshot();v.asOf='2026-10-09T10:00:00.500000Z';return v;});
 await assert.rejects(f.use(proof,async()=>assert.fail()),denied);
});
test('CG03b backwards or invalid clock never restores a proof',async()=>{
 const f=await fixture(),proof=await f.resolve();f.setTime('2026-10-09T09:59:59.999999Z');await assert.rejects(f.use(proof),unavailable);
 f.setTime(T);await assert.rejects(f.use(proof),denied);f.setTime('invalid');await assert.rejects(f.resolve(),unavailable);
});
test('CG03b expired response arriving after lookup is rejected before business callback',async()=>{
 const f=await fixture();f.handle(async()=>{f.setTime('2026-10-09T10:00:03.000000Z');return snapshot();});await assert.rejects(f.resolve(),denied);
});
test('CG03b abort before query and during query never returns a usable proof',async()=>{
 const f=await fixture(),cancel=new AbortController();cancel.abort();
 await assert.rejects(f.resolver.resolveResourceScope(f.p,[ref()],'tickets.read',cancel.signal),unavailable);assert.equal(f.reads(),0);
 const c=new AbortController();f.handle(async()=>{c.abort();return snapshot();});
 await assert.rejects(f.resolver.resolveResourceScope(f.p,[ref()],'tickets.read',c.signal),unavailable);
});
test('CG03b bounded timeout aborts provider and ignores a late answer without retry',async()=>{
 const f=await fixture(),create=await factory();let release!:(v:unknown)=>void;let attempts=0;let observed:AbortSignal|undefined;
 const resolver=create({...f.options,timeoutMs:15,authority:{readAccess:async(_q:any,s:AbortSignal)=>{attempts++;observed=s;return new Promise(r=>{release=r;});}}});
 try{await assert.rejects(resolver.resolveResourceScope(f.p,[ref()],'tickets.read'),unavailable);assert.equal(observed?.aborted,true);assert.equal(attempts,1);}finally{release?.(snapshot());}
 await new Promise<void>(r=>setImmediate(r));assert.equal(attempts,1);
});
test('CG03b property/scopes ordering changes do not falsely invalidate equivalent access',async()=>{
 const f=await fixture(),proof=await f.resolve();f.reply.principal.scopes.reverse();
 f.reply.binding=Object.fromEntries(Object.entries(f.reply.binding).reverse());
 const ctx=await f.use(proof);assert.equal(ctx.accountId,A);
});

test('CG03b review requires response qualification for the exact operation',async()=>{
 const f=await fixture();delete f.reply.operation;await assert.rejects(f.resolve(),unavailable);
});
test('CG03b review local principal changed during revalidation cannot enter business work',async()=>{
 const f=await fixture(),proof=await f.resolve();
 f.handle(async()=>{f.p.scopes=[];return snapshot();});
 await assert.rejects(f.use(proof,async()=>assert.fail('stale local principal reached work')),denied);
});
test('CG03b review access timestamp cannot go backwards across the two checks',async()=>{
 const f=await fixture();f.setTime('2026-10-09T10:00:00.000300Z');f.reply.asOf='2026-10-09T10:00:00.000200Z';
 const proof=await f.resolve();f.reply.asOf='2026-10-09T10:00:00.000100Z';
 await assert.rejects(f.use(proof,async()=>assert.fail('older snapshot reached work')),denied);
});
test('CG03b review expiry is checked immediately before returning a proof',async()=>{
 const f=await fixture(),create=await factory();let reads=0;
 f.reply.expiresAt='2026-10-09T10:00:00.000001Z';
 const r=create({...f.options,clock:()=>++reads<3?T:'2026-10-09T10:00:00.000001Z'});
 await assert.rejects(r.resolveResourceScope(f.p,[ref()],'tickets.read'),denied);
});

for(const op of ['contexts.resolve','tickets.read','tickets.write','notes.read','notes.write'])test('CG03b complete allowed '+op+' uses the matching authority qualification',async()=>{
 const p=person('agent');p.scopes=['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'];
 const f=await fixture(p);f.reply.operation=op;const proof=await f.resolve([ref()],op);
 const ctx=await f.use(proof,async(c:any)=>c,[ref()],op);assert.equal(ctx.operation,op);assert.equal(f.reads(),2);
 assert.equal(f.calls[0].operation,op);assert.deepEqual(Object.keys(f.calls[0]).sort(),['connectionId','operation','principalId','refs','tenantId','workspaceId']);
});
test('CG03b authority reply for another operation cannot authorize a write',async()=>{
 const f=await fixture();await assert.rejects(f.resolve([ref()],'tickets.write'),denied);assert.equal(f.reads(),1);
});
test('CG03b equivalent set ordering is accepted without adding resources',async()=>{
 const f=await fixture(),proof=await f.resolve([ref('A'),ref('B')]);
 const ctx=await f.use(proof,async(c:any)=>c,[ref('B'),ref('A')]);assert.deepEqual(ctx.refs,[ref('A'),ref('B')]);
});
test('CG03b authority failure at consumption burns only this proof and never retries',async()=>{
 const f=await fixture(),proof=await f.resolve();let work=0;f.handle(async()=>{throw Error('PRIVATE');});
 await assert.rejects(f.use(proof,async()=>{work++;}),unavailable);f.handle(undefined);await assert.rejects(f.use(proof),denied);
 assert.equal(work,0);assert.equal(f.reads(),2);const fresh=await f.resolve();await f.use(fresh);assert.equal(f.reads(),4);
});
test('CG03b cancelled consumption neither queries again nor invokes work',async()=>{
 const f=await fixture(),proof=await f.resolve(),c=new AbortController();c.abort();
 await assert.rejects(f.use(proof,async()=>assert.fail(),[ref()],'tickets.read',f.p,c.signal),unavailable);
 assert.equal(f.reads(),1);await assert.rejects(f.use(proof),denied);
});
test('CG03b caller getters are rejected without execution or authority lookup',async()=>{
 const f=await fixture();let reads=0;Object.defineProperty(f.p,'id',{get:()=>{reads++;return P;},enumerable:true});
 await assert.rejects(f.resolve(),denied);assert.equal(reads,0);assert.equal(f.reads(),0);
});
