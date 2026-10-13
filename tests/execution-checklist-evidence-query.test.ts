import test from 'node:test';import assert from 'node:assert/strict';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createExecutionChecklistService} from '../src/application/execution-checklist.ts';
import {createPostgresExecutionChecklistStore} from '../src/infrastructure/execution-checklist-store.ts';
const noteAt='2026-10-12T11:59:59.999999Z';
const context=()=>({principalId:id(2),workspaceId:id(1),accountId:id(3),ticketId:id(6),ticketVersion:4,checklistRevision:0,readAt:AT});
const query=()=>({expectedTicketVersion:4,expectedChecklistRevision:0,before:null});
function direct(rows:any[]=[{id:id(90),at:noteAt}],meta:any={}){
 const calls:{sql:string;values:any[]}[]=[];const client:any={query:async(sql:string,values:any[])=>{calls.push({sql,values});return {command:'SELECT',rowCount:rows.length,rows,...meta};},release(){throw Error('No release');}};
 const store:any=createPostgresExecutionChecklistStore(client);
 assert.equal(typeof store.queryEvidence,'function','metadata query missing');return {calls,store,run:(q:any=query())=>store.queryEvidence(context(),q)};
}
test('evidence SQL is parameterized, bounded, scoped and contains no body selection',async()=>{const f=direct(),p=await f.run();assert.equal(p.items.length,1);const c=f.calls[0]!;assert.match(c.sql,/n\.workspace_id=\$1/);assert.match(c.sql,/n\.account_id=\$2/);assert.match(c.sql,/n\.ticket_id=\$3/);assert.match(c.sql,/n\.actor_id=\$4/);assert.match(c.sql,/ORDER BY n\.created_at DESC,n\.id DESC/);assert.match(c.sql,/LIMIT \$8/);assert.doesNotMatch(c.sql,/select\s+\*|n\.body|n\.title|OFFSET/iu);assert.deepEqual(c.values,[id(1),id(3),id(6),id(2),AT,null,null,21]);assert.ok(!c.sql.includes(id(6)));});
test('evidence native timestamp keyset and boundary are values, not SQL',async()=>{const f=direct(),q={...query(),before:{at:AT,id:id(91)}};await f.run(q);assert.match(f.calls[0]!.sql,/\(n\.created_at,n\.id\)<\(\$6::timestamptz,\$7::uuid\)/);assert.deepEqual(f.calls[0]!.values.slice(5,7),[AT,id(91)]);});
test('evidence first 20 plus sentinel yields next cursor, no fake total',async()=>{const f=direct(Array.from({length:21},(_,i)=>({id:id(120-i),at:noteAt})));const p=await f.run();assert.equal(p.items.length,20);assert.deepEqual(p.next,p.items.at(-1));assert.equal('total' in p,false);});
for(const [name,rows,meta] of [
 ['body',[{id:id(90),at:noteAt,body:'PRIVATE'}],{}],['count',[{id:id(90),at:noteAt}],{rowCount:0}],['wrong command',[],{command:'UPDATE'}],['too many',Array.from({length:22},(_,i)=>({id:id(100-i),at:noteAt})),{}],['duplicate',[{id:id(90),at:noteAt},{id:id(90),at:noteAt}],{}],['malformed sentinel',[...Array.from({length:20},(_,i)=>({id:id(120-i),at:noteAt})),{id:id(100),at:noteAt,body:'PRIVATE'}],{}],['future',[{id:id(90),at:'2026-10-12T12:00:00.000002Z'}],{}]
] as const)test('evidence store refuses '+name+' rather than a partial page',async()=>{const f=direct([...rows],meta);await assert.rejects(f.run(),{code:'checklist_store_invalid'});});
test('empty SELECT is explicitly valid, not confused with database error',async()=>{const f=direct([]);assert.deepEqual((await f.run()).items,[]);assert.equal((await f.run()).next,null);});
function serviceFixture(){
 const f=markingFixture(),refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];let revoked=false,clock=AT;
 const calls:string[]=[],options={rows:[{id:id(90),at:noteAt}],afterList:()=>{},changeRecord:()=>{}};
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:5000,clock:()=>clock,authority:{readAccess:async q=>revoked?null:{principal:f.principal,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',resources:refs}}});
 const result=(r:unknown)=>({command:'SELECT',rowCount:1,rows:[{result:r}]});
 const pool:any={connect:async()=>({query:async(sql:string,args:any[]=[])=>{
  calls.push(sql);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {command:sql,rowCount:0,rows:[]};
  if(sql.startsWith('select set_config'))return {command:'SELECT',rowCount:1,rows:[]};
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:{...context(),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:args[1],asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',refs,ticketId:id(6)}}].map(({scope})=>({scope:Object.fromEntries(Object.entries(scope).filter(([k])=>!['ticketVersion','checklistRevision','readAt'].includes(k)))}))};
  if(sql.includes('pg_roles'))return result({role:'helpdesk_app',login:'helpdesk_app',superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});
  if(sql.includes('hdn_lock_execution_checklist')){options.changeRecord();return result(structuredClone(f.record));}
  if(sql.includes('FROM helpdesk_core.internal_notes')){options.afterList();return {command:'SELECT',rowCount:options.rows.length,rows:structuredClone(options.rows)};}
  throw Error('Unexpected statement');
 },release(){}}),query:async()=>{throw Error('pool escape');},end:async()=>{}};
 const service:any=createExecutionChecklistService({pool,resolver});assert.equal(typeof service.queryEvidence,'function','authorized evidence query missing');
 return {...f,refs,calls,options,service,run:(q:any=query())=>service.queryEvidence(f.principal,id(6),refs,q),revoke:()=>{revoked=true;},time:(t:string)=>{clock=t;}};
}
test('evidence service uses current transaction and makes no write, receipt or note',async()=>{const f=serviceFixture(),p=await f.run();assert.equal(p.items.length,1);assert.equal(f.calls.at(-1),'COMMIT');assert.ok(!f.calls.some(s=>/hdn_mark|INSERT|UPDATE|DELETE|hdn_checklist_receipt/.test(s)));assert.doesNotMatch(JSON.stringify(p),/body|email|reason|PRIVATE/);});
test('evidence revised ticket rejected before notes are read',async()=>{const f=serviceFixture();f.record.context.ticketVersion=5;await assert.rejects(f.run(),{code:'checklist_version_conflict'});assert.ok(!f.calls.some(s=>s.includes('FROM helpdesk_core.internal_notes')));});
test('evidence changed checklist revision is rejected before listing',async()=>{const f=serviceFixture();await assert.rejects(f.run({...query(),expectedChecklistRevision:1}),{code:'checklist_version_conflict'});assert.equal(f.calls.at(-1),'ROLLBACK');});
test('evidence another assignee is not offered for marking',async()=>{const f=serviceFixture();f.record.assignedTo=id(99);await assert.rejects(f.run(),{code:'checklist_forbidden'});assert.ok(!f.calls.some(s=>s.includes('FROM helpdesk_core.internal_notes')));});
test('evidence forbidden ticket state cannot prepare a mark',async()=>{const f=serviceFixture();f.record.ticketStatus='resolved';await assert.rejects(f.run(),{code:'checklist_state_conflict'});});
test('evidence revoked resource blocks connection acquisition',async()=>{const f=serviceFixture();f.revoke();await assert.rejects(f.run(),{code:'resource_scope_denied'});assert.equal(f.calls.length,0);});
test('evidence expiry after SQL prevents returning data or COMMIT',async()=>{const f=serviceFixture();f.options.afterList=()=>f.time('2026-10-12T12:00:30.000001Z');await assert.rejects(f.run(),{code:'resource_scope_denied'});assert.equal(f.calls.at(-1),'ROLLBACK');assert.ok(!f.calls.includes('COMMIT'));});
