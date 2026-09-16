import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {eventDto} from '../src/http/serialization.ts';
import {principal,ticket} from './fixtures.ts';
import type {Principal,Ticket,TicketEvent} from '../src/domain/model.ts';

const target=ticket();
const agent=principal({id:'agent-a',grants:[{accountId:target.accountId,role:'agent'}]});
const reason='Avaliação interna da urgência';
const requestId='10000000-0000-4000-8000-000000000001';
function setup(t:Ticket=target){const db=new MemoryUnitOfWork({tickets:[t]});return {db,service:new HelpdeskService(db,()=>new Date('2026-09-16T12:00:00Z'))};}
async function change(service:HelpdeskService,p:Principal=agent,priority:unknown='high',version:unknown=1,why:unknown=reason,key='priority-change-0001',id=target.id){
 const method=Reflect.get(service,'changePriority');assert.equal(typeof method,'function','Priority command must exist');
 return method.call(service,p,id,priority,version,why,key,requestId) as Promise<{ticket:Ticket;replayed:boolean}>;
}

test('priority changes atomically and preserves status, identity and contract snapshot',async()=>{
 const {db,service}=setup(),before=db.snapshot().tickets[0]!;
 const result=await change(service);assert.equal(result.ticket.priority,'high');assert.equal(result.ticket.version,2);assert.equal(result.replayed,false);
 assert.deepEqual(result.ticket,{...before,priority:'high',version:2,updatedAt:'2026-09-16T12:00:00.000Z'});
 const {events,outbox,idempotency}=db.snapshot();assert.equal(events.length,1);assert.equal(outbox.length,1);assert.equal(idempotency.length,1);
 assert.equal(events[0]!.type,'ticket.priority_changed');assert.deepEqual(events[0]!.data,{from:'normal',to:'high',reason,version:2});
 assert.equal(events[0]!.actorId,agent.id);assert.equal(outbox[0]!.id,events[0]!.id);assert.equal(outbox[0]!.requestId,requestId);
 assert.doesNotMatch(JSON.stringify(outbox),/Avaliação|reason/);
});
test('workspace administrator can change an authorized account priority',async()=>{const {service}=setup();assert.equal((await change(service,principal({workspaceRole:'admin',grants:[]}))).ticket.priority,'high');});
for(const [label,p] of [
 ['requester',principal()],['account manager',principal({grants:[{accountId:target.accountId,role:'account_manager'}]})],
 ['integration',principal({kind:'integration',productInstanceIds:[target.productInstanceId],grants:[{accountId:target.accountId,role:'agent'}]})],
 ['agent without write', {...agent,scopes:['tickets:read']}],['agent without read',{...agent,scopes:['tickets:write']}],
 ['unassigned workspace agent',principal({workspaceRole:'agent'})],
] as [string,Principal][]){test(label+' cannot change priority',async()=>{const {db,service}=setup();await assert.rejects(()=>change(service,p),{code:'forbidden'});assert.equal(db.snapshot().events.length,0);assert.equal(db.snapshot().tickets[0]!.version,1);});}
for(const p of [{...agent,workspaceId:'other'},{...agent,grants:[{accountId:'other',role:'agent' as const}]}])test('out-of-scope priority target is not disclosed '+p.workspaceId+JSON.stringify(p.grants),async()=>{const {service}=setup();await assert.rejects(()=>change(service,p),{code:'resource_not_found'});});
test('priority replay produces one event and one outbox even after further changes',async()=>{
 const {service,db}=setup();const a=await change(service);await service.addMessage(agent,target.id,'Acompanhamento','priority-message-0001',requestId);
 const b=await change(service);assert.equal(b.replayed,true);assert.deepEqual(a.ticket,b.ticket);assert.equal((await service.get(agent,target.id)).version,3);
 assert.equal(db.snapshot().events.filter(e=>e.type==='ticket.priority_changed').length,1);
});
test('replay cannot disclose internal result after operator role is removed',async()=>{const {service}=setup();await change(service);await assert.rejects(()=>change(service,{...agent,grants:[{accountId:target.accountId,role:'account_manager'}]}),{code:'forbidden'});});
test('same idempotency key with another reason is rejected',async()=>{const {service}=setup();await change(service);await assert.rejects(()=>change(service,agent,'high',1,'Outro motivo'),{code:'idempotency_conflict'});});
test('concurrent priority changes from same version have a single winner',async()=>{
 const {service,db}=setup();const results=await Promise.allSettled([change(service),change(service,agent,'urgent',1,reason,'priority-change-0002')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const rejected=results.find(r=>r.status==='rejected');assert.equal(rejected?.status==='rejected'&&rejected.reason.code,'version_conflict');assert.equal(db.snapshot().events.length,1);
});
test('concurrent identical requests replay exactly once in memory',async()=>{const {service,db}=setup();const results=await Promise.all([change(service),change(service)]);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal(db.snapshot().events.length,1);});
test('outbox failure rolls back priority, event and idempotency',async()=>{const {db,service}=setup();db.failOutbox=true;await assert.rejects(()=>change(service),/Injected outbox/);const snapshot=db.snapshot();assert.equal(snapshot.tickets[0]!.priority,'normal');assert.equal(snapshot.events.length,0);assert.equal(snapshot.idempotency.length,0);});
test('same priority is a version-checked no-op without audit noise',async()=>{const {db,service}=setup();const r=await change(service,agent,'normal');assert.equal(r.ticket.version,1);assert.equal(db.snapshot().events.length,0);assert.equal(db.snapshot().outbox.length,0);assert.equal((await change(service,agent,'normal')).replayed,true);});
test('no-op does not bypass stale If-Match',async()=>{const {service}=setup(ticket({version:2}));await assert.rejects(()=>change(service,agent,'normal'),{code:'version_conflict'});});
for(const status of ['closed','cancelled'] as const)test('terminal '+status+' ticket priority is immutable',async()=>{const {service}=setup(ticket({status}));await assert.rejects(()=>change(service),{code:'priority_change_not_allowed'});});
for(const value of ['',null,5,'critical','HIGH'])test('invalid priority rejected '+JSON.stringify(value),async()=>{const {service}=setup();await assert.rejects(()=>change(service,agent,value),{code:'invalid_input'});});
for(const value of ['', '   ',null,'x'.repeat(2001),'internal\u0000reason','line\nreason','bad\ud800'])test('invalid internal reason rejected '+JSON.stringify(value).slice(0,30),async()=>{const {service}=setup();await assert.rejects(()=>change(service,agent,'high',1,value),{code:'invalid_input'});});
for(const value of [0,-1,1.1,NaN,'1',undefined])test('priority expected version validated '+String(value),async()=>{const {service}=setup();const method=Reflect.get(service,'changePriority');assert.equal(typeof method,'function');await assert.rejects(()=>method.call(service,agent,target.id,'high',value,reason,'priority-change-0001',requestId),{code:'precondition_required'});});
test('priority reason whitespace is canonical for idempotency',async()=>{const {service}=setup();const a=await change(service,agent,'high',1,' '+reason+' ');const b=await change(service);assert.equal(a.ticket.id,b.ticket.id);assert.equal(b.replayed,true);});
test('timeline public projection discloses priorities but never reason or actor',()=>{
 const e:TicketEvent={id:'event-a',workspaceId:target.workspaceId,accountId:target.accountId,ticketId:target.id,actorId:agent.id,type:'ticket.priority_changed',customerVisible:true,data:{from:'normal',to:'high',reason,version:2},createdAt:target.createdAt};
 assert.deepEqual(eventDto(principal(),e),{id:e.id,type:e.type,created_at:e.createdAt,data:{from:'normal',to:'high',version:2}});
 assert.equal((eventDto(agent,e).data as Record<string,unknown>).reason,reason);
});
test('PATCH accepts only priority/reason, returns ETag and deduplicates',async()=>{
 const {service,db}=setup();const handler=createHttpHandler({service,authenticate:async()=>agent});
 const req=()=>new Request('https://helpdesk.test/v1/tickets/'+target.id,{method:'PATCH',headers:{'content-type':'application/json','if-match':'"1"','idempotency-key':'priority-http-key-001'},body:JSON.stringify({priority:'high',reason})});
 const a=await handler(req());assert.equal(a.status,200);assert.equal(a.headers.get('etag'),'"2"');assert.equal((await a.json()).priority,'high');
 const b=await handler(req());assert.equal(b.status,200);assert.equal(b.headers.get('idempotency-replayed'),'true');assert.equal(db.snapshot().events.length,1);
});
for(const [label,body,headers,query,status] of [
 ['mass assignment',{priority:'high',reason,status:'closed'},{},'',400],
 ['missing precondition',{priority:'high',reason},{'if-match':''},'',428],
 ['weak ETag',{priority:'high',reason},{'if-match':'W/"1"'},'',400],
 ['missing key',{priority:'high',reason},{'idempotency-key':''},'',400],
 ['query selector',{priority:'high',reason},{},'?account_id=other',400],
 ['empty reason',{priority:'high',reason:''},{},'',400],
] as [string,unknown,Record<string,string>,string,number][])test('PATCH rejects '+label,async()=>{
 const {service}=setup();const handler=createHttpHandler({service,authenticate:async()=>agent});const r=await handler(new Request('https://helpdesk.test/v1/tickets/'+target.id+query,{method:'PATCH',headers:{'content-type':'application/json','if-match':'"1"','idempotency-key':'priority-http-key-001',...headers},body:JSON.stringify(body)}));assert.equal(r.status,status);
});
