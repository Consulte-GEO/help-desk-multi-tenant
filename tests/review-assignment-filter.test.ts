import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {ticketDto} from '../src/http/serialization.ts';
import {createTicketListState} from '../web/ticket-list-state.js';
import {principal,ticket} from './fixtures.ts';
const operator=()=>principal({grants:[{accountId:'account-a',role:'agent'},{accountId:'account-b',role:'requester'}]});
function setup(){
 const p=operator();const rows=[
  ticket({id:'t-5',assignedTo:'person-b'}),ticket({id:'t-4',assignedTo:null}),
  ticket({id:'t-3',assignedTo:p.id}),ticket({id:'t-2',assignedTo:p.id}),
  ticket({id:'t-1',accountId:'account-b',assignedTo:p.id}),
  ticket({id:'t-0',workspaceId:'workspace-b',assignedTo:p.id})
 ];
 return {p,rows,db:new MemoryUnitOfWork({tickets:rows})};
}
test('mine filters before pagination and respects per-account operator scope',async()=>{
 const {p,db}=setup(),s=new HelpdeskService(db);
 const first=await s.list(p,{limit:1,assignment:'mine'});assert.deepEqual(first.items.map(t=>t.id),['t-3']);assert.ok(first.nextCursor);
 const second=await s.list(p,{limit:1,assignment:'mine',cursor:first.nextCursor});assert.deepEqual(second.items.map(t=>t.id),['t-2']);assert.equal(second.nextCursor,null);
});
test('unassigned returns only authorized operator-account tickets',async()=>{
 const {p,db}=setup();const r=await new HelpdeskService(db).list(p,{limit:25,assignment:'unassigned'});assert.deepEqual(r.items.map(t=>t.id),['t-4']);
});
test('assignment filters combine with existing status priority and subject filters',async()=>{
 const {p,db}=setup();db.seedTicket(ticket({id:'t-3',assignedTo:p.id,status:'open',priority:'urgent',subject:'Filtro exclusivo'}));
 const r=await new HelpdeskService(db).list(p,{limit:25,assignment:'mine',status:'in_progress',priority:'urgent',q:'exclusivo'});assert.deepEqual(r.items.map(t=>t.id),['t-3']);
});
for(const p of [principal(),principal({grants:[{accountId:'account-a',role:'account_manager'}]}),principal({kind:'integration'})]){
 test('nonoperator cannot infer assignment through filters: '+p.kind+'/'+p.grants[0]?.role,async()=>{
  const {db}=setup();await assert.rejects(()=>new HelpdeskService(db).list(p,{limit:25,assignment:'unassigned'}),{status:403});
 });
}
test('mixed-role human cannot explicitly filter assignment in requester account',async()=>{
 const {p,db}=setup();await assert.rejects(()=>new HelpdeskService(db).list(p,{limit:25,assignment:'mine',accountId:'account-b'}),{status:403});
});
test('mine cursor cannot be reused for unassigned',async()=>{
 const {p,db}=setup(),s=new HelpdeskService(db);const r=await s.list(p,{limit:1,assignment:'mine'});assert.ok(r.nextCursor);
 await assert.rejects(()=>s.list(p,{limit:1,assignment:'unassigned',cursor:r.nextCursor!}),{code:'invalid_cursor'});
});
test('HTTP supports assignment filter and rejects unknown and duplicate selectors',async()=>{
 const {p,db}=setup(),handle=createHttpHandler({service:new HelpdeskService(db),authenticate:async()=>p});
 const r=await handle(new Request('https://test.invalid/v1/tickets?assignment=mine'));assert.equal(r.status,200);assert.equal((await r.json()).items.length,2);
 for(const query of ['assignment=other','assignment=','assignment=mine&assignment=unassigned']){
  assert.equal((await handle(new Request('https://test.invalid/v1/tickets?'+query))).status,400);
 }
});
test('UI carries assignment selection to the API and preserves default behavior',()=>{
 const s=createTicketListState();s.reset({assignment:'mine'});assert.match(s.begin()!.path,/assignment=mine/);
 s.reset();assert.doesNotMatch(s.begin()!.path,/assignment=/);
});
test('late page from another assignment view cannot replace the current list',()=>{
 const s=createTicketListState();s.reset({assignment:'mine'});const old=s.begin()!;
 s.reset({assignment:'unassigned'});const now=s.begin()!;
 assert.equal(s.accept(old,{items:[ticketDto(operator(),ticket())],next_cursor:null}),false);
 assert.equal(s.accept(now,{items:[],next_cursor:null}),true);assert.deepEqual(s.items(),[]);
});
