import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {ticketDto,eventDto} from '../src/http/serialization.ts';
import {principal,ticket} from './fixtures.ts';
import type {Principal,Ticket} from '../src/domain/model.ts';

const id='10000000-0000-4000-8000-000000000001';
const target=ticket({id});
const agent=principal({id:'agent-a',grants:[{accountId:target.accountId,role:'agent'}]});
const other={...agent,id:'agent-b'};
const admin=principal({id:'admin-a',workspaceRole:'admin',grants:[]});
const why='Assumindo a análise técnica';
function setup(t:Ticket=target){const db=new MemoryUnitOfWork({tickets:[t]});return {db,service:new HelpdeskService(db,()=>new Date('2026-09-16T18:00:00Z'))};}
async function assign(service:HelpdeskService,p:Principal=agent,action:unknown='claim',version:unknown=1,reason:unknown=why,key='assignment-test-key-001',tid=id):Promise<{ticket:Ticket;replayed:boolean}>{
 const method=Reflect.get(service,'changeAssignment');assert.equal(typeof method,'function','Assignment command must exist');
 return method.call(service,p,tid,action,version,reason,key,id);
}
const assigned=(t:Ticket)=>Reflect.get(t,'assignedTo');
test('claim advances version and preserves contract, status and priority; event stays internal',async()=>{
 const {db,service}=setup();const r=await assign(service);assert.equal(assigned(r.ticket),agent.id);assert.equal(r.ticket.version,2);
 assert.deepEqual(r.ticket.contractSnapshot,target.contractSnapshot);assert.equal(r.ticket.status,target.status);assert.equal(r.ticket.priority,target.priority);
 const s=db.snapshot();assert.equal(s.events.length,1);assert.equal(s.outbox.length,0);assert.equal(s.idempotency.length,1);
 assert.equal(s.events[0]!.type,'ticket.assignment_changed');assert.equal(s.events[0]!.customerVisible,false);
 assert.deepEqual(s.events[0]!.data,{action:'claim',from:null,to:agent.id,reason:why,version:2});
});
test('release own assignment returns to unassigned and stores reason',async()=>{const {db,service}=setup();await assign(service);const r=await assign(service,agent,'release',2,'Devolver para triagem','assignment-release-001');assert.equal(assigned(r.ticket),null);assert.equal(r.ticket.version,3);assert.equal(db.snapshot().events[1]!.data.action,'release');});
test('another operator cannot take or release an occupied ticket',async()=>{const {service}=setup();await assign(service);await assert.rejects(()=>assign(service,other,'claim',2),{code:'assignment_conflict'});await assert.rejects(()=>assign(service,other,'release',2),{code:'assignment_release_forbidden'});});
test('administrator can release another operator but cannot take it directly',async()=>{const {service}=setup();await assign(service);await assert.rejects(()=>assign(service,admin,'claim',2),{code:'assignment_conflict'});const released=await assign(service,admin,'release',2);assert.equal(assigned(released.ticket),null);});
test('same owner claim and unassigned release are version-checked no-ops',async()=>{const {db,service}=setup();const a=await assign(service,agent,'release');assert.equal(a.ticket.version,1);assert.equal(db.snapshot().events.length,0);await assign(service,agent,'claim',1,why,'assignment-noop-claim');const b=await assign(service,agent,'claim',2,why,'assignment-noop-again');assert.equal(b.ticket.version,2);assert.equal(db.snapshot().events.length,1);});
test('identical concurrent claims have one mutation and one replay in memory',async()=>{const {db,service}=setup();const r=await Promise.all([assign(service),assign(service)]);assert.equal(r.filter(x=>x.replayed).length,1);assert.equal(db.snapshot().events.length,1);});
test('two operators racing same version have one winner',async()=>{const {db,service}=setup();const r=await Promise.allSettled([assign(service),assign(service,other)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(db.snapshot().events.length,1);const loser=r.find(x=>x.status==='rejected');assert.equal(loser?.status==='rejected'&&loser.reason.code,'version_conflict');});
test('replay is original result after release, without claiming again',async()=>{const {db,service}=setup();const first=await assign(service);await assign(service,agent,'release',2,why,'assignment-later-release');const replay=await assign(service);assert.equal(replay.replayed,true);assert.deepEqual(first.ticket,replay.ticket);assert.equal(assigned((await service.get(agent,id))),null);assert.equal(db.snapshot().events.length,2);});
test('changed reason with same key conflicts',async()=>{const {service}=setup();await assign(service);await assert.rejects(()=>assign(service,agent,'claim',1,'Outro motivo'),{code:'idempotency_conflict'});});
test('stale version fails even for no-op',async()=>{const {service}=setup();await assign(service);await assert.rejects(()=>assign(service,agent,'claim',1,why,'assignment-stale-key'),{code:'version_conflict'});});
for(const [label,p] of [
 ['requester',principal()],['manager',principal({grants:[{accountId:target.accountId,role:'account_manager'}]})],
 ['machine',principal({kind:'integration',productInstanceIds:[target.productInstanceId],grants:[{accountId:target.accountId,role:'agent'}]})],
 ['no write',{...agent,scopes:['tickets:read']}],['no read',{...agent,scopes:['tickets:write']}],
 ['workspace agent without account',principal({workspaceRole:'agent'})]
] as [string,Principal][])test(label+' cannot change assignment',async()=>{const {db,service}=setup();await assert.rejects(()=>assign(service,p),{code:'forbidden'});assert.equal(db.snapshot().events.length,0);});
test('own assignment does not restore revoked access',async()=>{const {service}=setup();await assign(service);const revoked={...agent,grants:[]};await assert.rejects(()=>service.get(revoked,id),{code:'resource_not_found'});await assert.rejects(()=>assign(service,revoked),{code:'resource_not_found'});});
test('former operator with account-manager access cannot replay assignment cache',async()=>{const {service}=setup();await assign(service);await assert.rejects(()=>assign(service,{...agent,grants:[{accountId:target.accountId,role:'account_manager'}]}),{code:'forbidden'});});
for(const status of ['closed','cancelled'] as const)test('terminal '+status+' blocks assignment',async()=>{const {service}=setup(ticket({id,status}));await assert.rejects(()=>assign(service),{code:'assignment_not_allowed'});});
for(const action of ['transfer','',null,{},'CLAIM'])test('reject action '+JSON.stringify(action),async()=>{const {service}=setup();await assert.rejects(()=>assign(service,agent,action),{code:'invalid_input'});});
for(const reason of ['',null,'\n','a'.repeat(2001)])test('reject bad reason '+String(reason).slice(0,8),async()=>{const {service}=setup();await assert.rejects(()=>assign(service,agent,'claim',1,reason),{code:'invalid_input'});});
test('precondition and idempotency are required',async()=>{const {service}=setup();await assert.rejects(()=>assign(service,agent,'claim',0),{code:'precondition_required'});await assert.rejects(()=>assign(service,agent,'claim',1,why,''),{code:'invalid_idempotency_key'});});
test('event failure rolls back assignment and cache',async()=>{
 const db=new MemoryUnitOfWork({tickets:[target]});const service=new HelpdeskService({run:(p,work)=>db.run(p,s=>work({...s,addEvent:async()=>{throw Error('event unavailable');}}))});
 await assert.rejects(()=>assign(service),/event unavailable/);assert.equal(db.snapshot().tickets[0]!.version,1);assert.equal(db.snapshot().idempotency.length,0);
});
test('only operator DTO has assignment summary; nobody receives principal ID',async()=>{const {service}=setup();const {ticket:t}=await assign(service);const a=ticketDto(agent,t) as any,b=ticketDto(other,t) as any;assert.deepEqual(a.assignment,{state:'mine',can_claim:false,can_release:true});assert.deepEqual(b.assignment,{state:'other',can_claim:false,can_release:false});assert.equal('assignment' in ticketDto(principal(),t),false);assert.doesNotMatch(JSON.stringify(a),/agent-a|assignedTo|assigned_to/);});
test('customer timeline never receives responsibility event or reason',async()=>{const {db,service}=setup();await assign(service);assert.deepEqual(await service.timeline(principal(),id),[]);const e=eventDto(agent,db.snapshot().events[0]!);assert.deepEqual(e.data,{action:'claim',reason:why,version:2});assert.doesNotMatch(JSON.stringify(e),/agent-a/);});
function request(body:unknown={action:'claim',reason:why},extra:Record<string,string>={},suffix='') {return new Request('https://helpdesk.test/v1/tickets/'+id+'/assignments'+suffix,{method:'POST',headers:{'content-type':'application/json','if-match':'"1"','idempotency-key':'assignment-http-key-01',...extra},body:JSON.stringify(body)});}
test('POST assignment returns version and replay; customer is forbidden',async()=>{const {service}=setup();const h=createHttpHandler({service,authenticate:async()=>agent});const a=await h(request());assert.equal(a.status,200);assert.equal(a.headers.get('etag'),'"2"');assert.equal((await a.json()).assignment.state,'mine');const b=await h(request());assert.equal(b.headers.get('idempotency-replayed'),'true');const customer=createHttpHandler({service,authenticate:async()=>principal()});assert.equal((await customer(request())).status,403);});
for(const [label,body,headers,query,status] of [
 ['target principal',{action:'claim',reason:why,principal_id:other.id},{},'',400],
 ['missing version',{action:'claim',reason:why},{'if-match':''},'',428],
 ['query selector',{action:'claim',reason:why},{},'?account_id=other',400],
 ['missing key',{action:'claim',reason:why},{'idempotency-key':''},'',400]
] as [string,unknown,Record<string,string>,string,number][])test('assignment HTTP rejects '+label,async()=>{const {service}=setup();const h=createHttpHandler({service,authenticate:async()=>agent});assert.equal((await h(request(body,headers,query))).status,status);});
