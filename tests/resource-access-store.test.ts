import {HelpdeskError} from '../src/domain/errors.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

// Real resolver and transaction runner; only provider and SQL transport are synthetic.
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at='2026-10-09T12:00:00.123000Z',until='2026-10-09T12:01:00.123000Z';
const refs=[{connectionId:id(4),tenantId:'Tenant-A',type:'work',id:'0001'}];
const denied={code:'resource_scope_database_mismatch'},invalid={code:'resource_scope_database_unavailable'};
async function runner(){
 const path='../src/infrastructure/resource-access-store.ts';
 const module=await import(path).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof module.runResourceTicketTransaction,'function','CG03e database-bound resource store is missing');
 return module.runResourceTicketTransaction as (...args:any[])=>Promise<any>;
}
function fixture(){
 const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:null,
  grants:[{accountId:id(3),role:'account_manager'}],scopes:['tickets:read','tickets:write']};
 let reads=0,tick=at;
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,
  clock:()=>tick,authority:{readAccess:async()=>{reads++;return {principal:structuredClone(p),operation:'tickets.read',
   binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'Tenant-A',active:true,revision:'binding-1'},
   accessRevision:'access-1',manifestFingerprint:'a'.repeat(64),asOf:at,expiresAt:until,resources:refs};}}});
 const scope={ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),
  bindingRevision:'binding-1',accessRevision:'access-1',manifestFingerprint:'a'.repeat(64),operation:'tickets.read',asOf:at,expiresAt:until,refs:structuredClone(refs)};
 let response:any={command:'SELECT',rowCount:1,rows:[{scope}]};
 let hook:(sql:string)=>void=()=>{};const statements:string[]=[],parameters:unknown[][]=[],releases:unknown[]=[];
 const pool:SqlPool={connect:async()=>({query:async(sql,v)=>{statements.push(sql);parameters.push(v??[]);hook(sql);
  if(sql.includes('cg_lock_ticket_scope'))return response;
  return {command:sql.startsWith('select')?'SELECT':sql,rowCount:0,rows:[]};},release:e=>{releases.push(e);}}),
  query:async()=>{throw Error('Do not escape the transaction');},end:async()=>{}};
 return {p,resolver,pool,scope,statements,parameters,releases,reads:()=>reads,
  time:(v:string)=>{tick=v;},hook:(fn:typeof hook)=>{hook=fn;},response:(v:unknown)=>{response=v;},
  proof:()=>resolver.resolveResourceScope(p,refs,'tickets.read')};
}
async function use(f:ReturnType<typeof fixture>,work:(client:any,context:any)=>Promise<any>=async()=>42,proof?:unknown){
 return (await runner())(f.pool,f.resolver,f.p,id(6),refs,'tickets.read',proof??await f.proof(),work);
}
test('CG03e validates the database snapshot on the owned connection before business work',async()=>{
 const f=fixture();assert.equal(await use(f,async(c,ctx)=>{assert.equal(ctx.bindingId,id(5));await c.query('select business');return 42;}),42);
 assert.equal(f.reads(),2);const query=f.statements.findIndex(s=>s.includes('cg_lock_ticket_scope'));assert.ok(query>1);
 assert.deepEqual(f.parameters[query],[id(6),'tickets.read']);assert.ok(query<f.statements.indexOf('select business'));
 assert.equal(f.statements.at(-1),'COMMIT');assert.equal(f.releases.length,1);
});
for(const field of ['ticketId','principalId','workspaceId','accountId','bindingId','bindingRevision','accessRevision','manifestFingerprint','operation'] as const){
 test('CG03e rejects mismatched persisted '+field+' without business work',async()=>{
  const f=fixture();f.scope[field]=field.endsWith('Id')?id(90):'changed';let calls=0;
  await assert.rejects(use(f,async()=>{calls++;}),denied);assert.equal(calls,0);assert.equal(f.statements.at(-1),'ROLLBACK');assert.equal(f.statements.includes('COMMIT'),false);
 });
}
for(const field of ['asOf','expiresAt'] as const)test('CG03e never rounds away one microsecond in '+field,async()=>{
 const f=fixture();f.scope[field]=f.scope[field].replace('123000','123001');await assert.rejects(use(f),denied);
});
test('CG03e accepts equivalent canonical UTC millisecond and microsecond representations',async()=>{
 const f=fixture();f.scope.asOf=f.scope.asOf.replace('123000','123');f.scope.expiresAt=f.scope.expiresAt.replace('123000','123');assert.equal(await use(f),42);
});
for(const change of ['tenant','id','extra'] as const)test('CG03e refuses changed persisted resource set '+change,async()=>{
 const f=fixture();if(change==='tenant')f.scope.refs[0]!.tenantId='Tenant-B';else if(change==='id')f.scope.refs[0]!.id='1';else f.scope.refs.push({...refs[0]!,id:'B'});
 await assert.rejects(use(f),denied);
});
test('CG03e absence of database provenance denies even with a valid local lease',async()=>{
 const f=fixture();f.response({command:'SELECT',rowCount:1,rows:[{scope:null}]});await assert.rejects(use(f),denied);
});
for(const response of [{},{command:'UPDATE',rowCount:1,rows:[]},{command:'SELECT',rowCount:0,rows:[]},{command:'SELECT',rowCount:'1',rows:[{scope:null}]},{command:'SELECT',rowCount:1,rows:[{scope:true}]},{command:'SELECT',rowCount:1,rows:[{scope:{}}]},{command:'SELECT',rowCount:1,rows:[{scope:null,extra:'private'}]}])test('CG03e rejects malformed database acknowledgement '+JSON.stringify(response),async()=>{
 const f=fixture();f.response(response);await assert.rejects(use(f),invalid);assert.equal(f.statements.includes('COMMIT'),false);
});
test('CG03e database errors are sanitized; the callback never runs',async()=>{
 const f=fixture();f.hook(sql=>{if(sql.includes('cg_lock_ticket_scope'))throw Error('private SQL detail');});let calls=0;
 await assert.rejects(use(f,async()=>{calls++;}),(e:any)=>e.code===invalid.code&&!e.message.includes('private'));assert.equal(calls,0);
});
test('CG03e does not execute getters or accept hidden data from a malformed driver result',async()=>{
 const f=fixture();let calls=0;Object.defineProperty(f.scope,'bindingRevision',{get:()=>{calls++;return 'binding-1';}});
 await assert.rejects(use(f),invalid);assert.equal(calls,0);
});
test('CG03e rejected admission consumes the proof and cannot be retried as business work',async()=>{
 const f=fixture(),proof=await f.proof();f.scope.accessRevision='changed';await assert.rejects(use(f,async()=>assert.fail(),proof),denied);
 f.scope.accessRevision='access-1';await assert.rejects(use(f,async()=>assert.fail(),proof),{code:'resource_scope_denied'});assert.equal(f.reads(),2);
});
test('CG03e preserves expiry denial after the database wait',async()=>{
 const f=fixture();f.hook(sql=>{if(sql.includes('cg_lock_ticket_scope'))f.time(until);});
 await assert.rejects(use(f),{code:'resource_scope_denied'});assert.equal(f.statements.includes('COMMIT'),false);
});
test('CG03e business error is not replaced or retried by the snapshot guard',async()=>{
 const f=fixture(),failure=Error('business failure');let calls=0;
 await assert.rejects(use(f,async()=>{calls++;throw failure;}),e=>e===failure);assert.equal(calls,1);assert.equal(f.statements.at(-1),'ROLLBACK');
});
test('CG03e confirmed COMMIT remains confirmed after late expiry',async()=>{
 const f=fixture();f.hook(sql=>{if(sql==='COMMIT')f.time(until);});assert.equal(await use(f),42);
});
test('CG03e lost COMMIT acknowledgement is unknown, not a fabricated authorization denial',async()=>{
 const f=fixture();f.hook(sql=>{if(sql==='COMMIT')throw Error('lost ack');});await assert.rejects(use(f),{code:'transaction_outcome_unknown'});
});

test('CG03e review sanitizes a typed SQL transport error rather than trusting its class',async()=>{
 const f=fixture();f.hook(sql=>{if(sql.includes('cg_lock_ticket_scope'))throw new HelpdeskError(503,'private_driver_code','private credential detail');});
 await assert.rejects(use(f),(e:any)=>e.code===invalid.code&&!/private|credential/.test(e.message));
 assert.equal(f.statements.includes('COMMIT'),false);
});
test('CG03e review preserves a known admission code without trusting a transport message',async()=>{
 const f=fixture();f.hook(sql=>{if(sql.includes('cg_lock_ticket_scope'))throw new HelpdeskError(403,'resource_scope_denied','private credential detail');});
 await assert.rejects(use(f),(e:any)=>e.code==='resource_scope_denied'&&!/private|credential/.test(e.message));
 assert.equal(f.statements.includes('COMMIT'),false);
});

// CG03i: exception objects and descriptor traps at the transport boundary are
// not local domain decisions. Never let one adopt the parser's denial identity.
test('CG03i an SQL error with a throwing descriptor trap is sanitized',async()=>{
 const f=fixture();const hostile=new Proxy({},{getOwnPropertyDescriptor(){throw Error('private descriptor detail');}});
 f.hook(sql=>{if(sql.includes('cg_lock_ticket_scope'))throw hostile;});
 await assert.rejects(use(f),(e:any)=>e.code===invalid.code&&!/private/.test(e.message));
 assert.equal(f.statements.includes('COMMIT'),false);
});
for(const code of ['resource_scope_database_mismatch','resource_scope_database_unavailable'])test('CG03i a result descriptor cannot inject '+code+' or a private message',async()=>{
 const f=fixture(),cause=new HelpdeskError(403,code,'private parser detail');
 f.response(new Proxy({},{getOwnPropertyDescriptor(){throw cause;}}));
 await assert.rejects(use(f),(e:any)=>e.code===invalid.code&&e.status===503&&!/private/.test(e.message));
 assert.equal(f.statements.includes('COMMIT'),false);
});
test('CG03i result parsing never reads an attacker-controlled error code getter',async()=>{
 const f=fixture();let reads=0;
 const error=new HelpdeskError(403,'initial','private parser detail');
 Object.defineProperty(error,'code',{get(){reads++;throw Error('private code getter');}});
 f.response(new Proxy({},{getOwnPropertyDescriptor(){throw error;}}));
 await assert.rejects(use(f),(e:any)=>e.code===invalid.code&&!/private/.test(e.message));
 assert.equal(reads,0);assert.equal(f.statements.includes('COMMIT'),false);
});
test('CG03i a real mismatched scope still has the locally generated 403 response',async()=>{
 const f=fixture();f.scope.accessRevision='changed';
 await assert.rejects(use(f),(e:any)=>e.code===denied.code&&e.status===403&&!/private/.test(e.message));
});
