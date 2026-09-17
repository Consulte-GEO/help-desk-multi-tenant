import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {canTransition} from '../src/domain/workflow.ts';
import {canReadInternalNote,canWriteInternalNote,isOperator} from '../src/domain/policy.ts';
import {statuses} from '../src/domain/model.ts';
import type {Principal,Ticket} from '../src/domain/model.ts';
import {principal,ticket} from './fixtures.ts';
const id='13000000-0000-4000-8000-000000000001';
const agent=principal({id:'agent-actions',grants:[{accountId:'account-a',role:'agent'}]});
function setup(p:Principal=agent,t:Ticket=ticket({id,status:'open'})){
 let current=p;
 const db=new MemoryUnitOfWork({tickets:[t]});const service=new HelpdeskService(db);
 const handle=createHttpHandler({service,authenticate:async()=>current});
 return {db,service,handle,setPrincipal:(value:Principal)=>{current=value;}};
}
const get=(handle:ReturnType<typeof createHttpHandler>,tid=id)=>handle(new Request('https://local.invalid/v1/tickets/'+tid));
function actions(value:any){assert.ok(value.available_actions,'GET must contain server-computed available_actions');return value.available_actions;}
test('GET returns actions bound to the same ticket/version and no internal identifiers',async()=>{
 const {handle,db}=setup();const before=db.snapshot();const r=await get(handle);assert.equal(r.status,200);
 const body=await r.json(),a=actions(body);assert.equal(a.ticket_id,id);assert.equal(a.version,body.version);assert.equal(r.headers.get('etag'),'"1"');
 assert.deepEqual(Object.keys(a).sort(),['ticket_id','version','reply','read_notes','add_note','change_priority','claim','release','transitions'].sort());
 assert.equal(a.reply,true);assert.equal(a.read_notes,true);assert.equal(a.add_note,true);assert.equal(a.change_priority,true);assert.equal(a.claim,true);assert.equal(a.release,false);
 assert.equal(JSON.stringify(a).includes(agent.id),false);assert.deepEqual(db.snapshot(),before);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('read-only operator has no mutating actions even though their account role is agent',async()=>{
 const p={...agent,scopes:['tickets:read','notes:read']};const a=actions(await (await get(setup(p).handle)).json());
 for(const key of ['reply','add_note','change_priority','claim','release'])assert.equal(a[key],false,key);
 assert.equal(a.read_notes,true);assert.deepEqual(a.transitions,[]);
});
test('admin role does not compensate for absent write scopes',async()=>{
 const p=principal({workspaceRole:'admin',grants:[],scopes:['tickets:read']});const a=actions(await (await get(setup(p).handle)).json());
 for(const key of ['reply','read_notes','add_note','change_priority','claim','release'])assert.equal(a[key],false,key);
 assert.deepEqual(a.transitions,[]);
});
test('reading notes and writing notes are independent permissions',async()=>{
 for(const [scopes,read,write] of [[['tickets:read','notes:read'],true,false],[['tickets:read','notes:write'],false,true],[['tickets:read','tickets:write'],false,false]] as [string[],boolean,boolean][]){
  const a=actions(await (await get(setup({...agent,scopes}).handle)).json());assert.equal(a.read_notes,read);assert.equal(a.add_note,write);
 }
});
test('transitions agree with the domain for every state and relevant profile, not a second frontend workflow',async()=>{
 const profiles=[agent,principal(),{...agent,scopes:['tickets:read']},principal({kind:'integration',productInstanceIds:['geolab-production']})];
 for(const p of profiles)for(const status of statuses){
  const t=ticket({id,status}),a=actions(await (await get(setup(p,t).handle)).json());
  const actor=isOperator(p,t.workspaceId,t.accountId)?'agent':'customer';
  const expected=p.scopes.includes('tickets:write')?statuses.filter(to=>canTransition(status,to,actor)):[];
  assert.deepEqual(a.transitions.map((v:any)=>v.to),expected,`${p.kind}/${p.id}/${status}`);
  for(const move of a.transitions)assert.equal(move.requires_reason,status==='resolved'&&move.to==='open');
  assert.equal(a.read_notes,canReadInternalNote(p,t));assert.equal(a.add_note,canWriteInternalNote(p,t));
 }
});
test('mixed-role actor receives customer actions in customer account, even after seeing agent actions',async()=>{
 const p=principal({grants:[{accountId:'account-a',role:'agent'},{accountId:'account-b',role:'requester'}]});
 const t=ticket({id,accountId:'account-b',status:'resolved'});const b=await (await get(setup(p,t).handle)).json();const a=actions(b);
 assert.equal(a.read_notes,false);assert.equal(a.add_note,false);assert.equal(a.change_priority,false);assert.equal(a.claim,false);
 assert.deepEqual(a.transitions,[{to:'open',requires_reason:true},{to:'closed',requires_reason:false}]);assert.equal(b.internal_status,undefined);
});
test('assignment hints preserve claim-own and admin-release behavior',async()=>{
 for(const [p,owner,claim,release] of [[agent,null,true,false],[agent,agent.id,false,true],[agent,'other-agent',false,false],[{...agent,workspaceRole:'admin'},'other-agent',false,true]] as [Principal,string|null,boolean,boolean][]){
  const a=actions(await (await get(setup(p,ticket({id,status:'open',assignedTo:owner})).handle)).json());assert.equal(a.claim,claim);assert.equal(a.release,release);
 }
});
test('terminal status disables classification/assignment but preserves conversation without reopening',async()=>{
 for(const status of ['closed','cancelled'] as const){
  const {handle,service,db}=setup(agent,ticket({id,status,assignedTo:agent.id}));const a=actions(await (await get(handle)).json());
  assert.equal(a.change_priority,false);assert.equal(a.claim,false);assert.equal(a.release,false);assert.deepEqual(a.transitions,[]);assert.equal(a.reply,true);assert.equal(a.add_note,true);
  await service.addMessage(agent,id,'Resposta adicional sem reabertura','actions-terminal-'+status,id);assert.equal(db.snapshot().tickets[0]!.status,status);
 }
});
test('a plan is not authorization: scope revocation after GET blocks the command and clears new hints',async()=>{
 const {handle,setPrincipal,db}=setup();assert.equal(actions(await (await get(handle)).json()).change_priority,true);
 setPrincipal({...agent,scopes:['tickets:read']});
 const r=await handle(new Request('https://local.invalid/v1/tickets/'+id,{method:'PATCH',headers:{'content-type':'application/json','if-match':'"1"','idempotency-key':'actions-revoked-0001'},body:JSON.stringify({priority:'high',reason:'Revisão'})}));
 assert.equal(r.status,403);assert.equal(actions(await (await get(handle)).json()).change_priority,false);assert.equal(db.snapshot().events.length,0);
});
test('known ticket of another account/workspace does not disclose hints',async()=>{
 for(const t of [ticket({id,accountId:'account-other'}),ticket({id,workspaceId:'workspace-other'})]){
  const r=await get(setup(agent,t).handle);assert.equal(r.status,404);assert.equal((await r.json()).available_actions,undefined);
 }
});
test('action hints exist only in current detail reads; list and replays stay immutable snapshots',async()=>{
 const {handle,service}=setup();const list=await handle(new Request('https://local.invalid/v1/tickets'));assert.equal((await list.json()).items[0].available_actions,undefined);
 const first=await service.changePriority(agent,id,'high',1,'Revisar atendimento','actions-replay-001',id);assert.equal(first.replayed,false);
 const r=await handle(new Request('https://local.invalid/v1/tickets/'+id,{method:'PATCH',headers:{'content-type':'application/json','if-match':'"1"','idempotency-key':'actions-replay-001'},body:JSON.stringify({priority:'high',reason:'Revisar atendimento'})}));
 assert.equal(r.status,200);assert.equal(r.headers.get('idempotency-replayed'),'true');assert.equal((await r.json()).available_actions,undefined);
 assert.equal(actions(await (await get(handle)).json()).version,2);
});
test('reopen requires explanation at execution, not just a frontend hint',async()=>{
 const p=principal(),{handle,service}=setup(p,ticket({id,status:'resolved'}));const a=actions(await (await get(handle)).json());
 assert.equal(a.transitions.find((v:any)=>v.to==='open').requires_reason,true);
 await assert.rejects(()=>service.transition(p,id,'open',1,'','actions-reopen-01',id),{code:'reopen_reason_required'});
});
