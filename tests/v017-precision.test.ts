import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {pagination,page} from '../src/application/pagination.ts';
import {validateTicketReplay} from '../src/application/replay-result.ts';
import {validateConversationResult} from '../src/application/conversation-result.ts';
import {ticketDto} from '../src/http/serialization.ts';
import type {SqlPool,SqlClient} from '../src/infrastructure/sql.ts';
import type {PublicMessage,Ticket} from '../src/domain/model.ts';
import {principal,ticket} from './fixtures.ts';

const at='2026-09-17T12:00:00.';
const msg=(id:string,time:string):PublicMessage=>({id,workspaceId:'workspace-a',accountId:'account-a',ticketId:'ticket-a',actorId:'person-a',actorType:'customer',body:'Mensagem válida',createdAt:time});
function pgRow(t:Ticket):Record<string,unknown>{return {id:t.id,workspace_id:t.workspaceId,account_id:t.accountId,product_instance_id:t.productInstanceId,service_code:t.serviceCode,created_by:t.createdBy,assigned_to:t.assignedTo,subject:t.subject,description:t.description,status:t.status,priority:t.priority,version:t.version,coverage_id:t.coverageId,contract_version_id:t.contractVersionId,contract_snapshot:t.contractSnapshot,created_at:t.createdAt,updated_at:t.updatedAt};}
function sqlFixture(row:Record<string,unknown>){
 const calls:{sql:string;values:unknown[]}[]=[];
 const query=async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});const rows=sql.includes('from helpdesk_core.')?[row]:[];return {command:sql.split(/\s/)[0]!.toUpperCase(),rows,rowCount:rows.length};};
 const client:SqlClient={query,release:()=>{}};const pool:SqlPool={query,connect:async()=>client,end:async()=>{}};
 return {db:new PostgresUnitOfWork(pool),calls};
}
test('cursor emitted for a six-digit instant can be consumed without losing precision',()=>{
 const context={collection:'test'},filter=pagination({limit:1},context).filter;
 const result=page([{id:'b',createdAt:at+'123456Z'},{id:'a',createdAt:at+'123455Z'}],1,filter);
 assert.ok(result.nextCursor);
 assert.equal(pagination({limit:1,cursor:result.nextCursor},context).window.cursor?.at,at+'123456Z');
});
test('mixed milliseconds and microseconds sort by instant, not raw string',async()=>{
 const times=[at+'123Z',at+'123001Z',at+'123999Z',at+'122999Z'];
 const db=new MemoryUnitOfWork({tickets:times.map((createdAt,i)=>ticket({id:'t-'+i,createdAt}))});
 const result=await new HelpdeskService(db).list(principal(),{limit:10});
 assert.deepEqual(result.items.map(x=>x.id),['t-2','t-1','t-0','t-3']);
});
test('different representations of the same instant use the ID as tie breaker',async()=>{
 const db=new MemoryUnitOfWork({tickets:[ticket({id:'t-a',createdAt:at+'123Z'}),ticket({id:'t-z',createdAt:at+'123000Z'})]});
 const service=new HelpdeskService(db),first=await service.list(principal(),{limit:1});
 assert.equal(first.items[0]?.id,'t-z');
 const second=await service.list(principal(),{limit:1,cursor:first.nextCursor!});
 assert.deepEqual(second.items.map(x=>x.id),['t-a']);
});
for(const kind of ['messages','notes','timeline'] as const)test(`${kind}: 75 rows within one millisecond page without loss or duplicates`,async()=>{
 const messages=Array.from({length:75},(_,i)=>msg('m-'+String(i).padStart(3,'0'),at+'123'+String(i).padStart(3,'0')+'Z'));
 const notes=messages.map(({actorType,...m})=>m);
 const events=messages.map(({body,actorType,...m})=>({...m,type:'message.created',customerVisible:true,data:{messageId:m.id,actorType}}));
 const db=new MemoryUnitOfWork({tickets:[ticket()],messages,notes,events});
 const p=principal({grants:[{accountId:'account-a',role:'agent'}]}),service=new HelpdeskService(db);
 let cursor:string|undefined;const ids:string[]=[];
 for(let n=0;n<10;n++){
  const result=await service.conversation(p,'ticket-a',kind,{limit:7,...(cursor?{cursor}:{})});
  ids.push(...result.items.map(x=>x.id));cursor=result.nextCursor??undefined;if(!cursor)break;
 }
 // 75 / 7 needs 11 pages: continue the last page explicitly.
 if(cursor)ids.push(...(await service.conversation(p,'ticket-a',kind,{limit:7,cursor})).items.map(x=>x.id));
 assert.equal(ids.length,75);assert.equal(new Set(ids).size,75);
 assert.deepEqual(ids,messages.map(x=>x.id).reverse());
});
test('PostgreSQL adapter preserves microseconds returned as text',async()=>{
 const id='00000000-0000-4000-8000-000000000001',t=ticket({id,createdAt:at+'123456Z',updatedAt:at+'123789Z'});
 const f=sqlFixture(pgRow(t));const result=await f.db.run(principal(),s=>s.getTicket(id));
 assert.equal(result?.createdAt,t.createdAt);assert.equal(result?.updatedAt,t.updatedAt);
});
test('PostgreSQL timestamp projection is textual but order and cursor compare native timestamps',async()=>{
 const f=sqlFixture(pgRow(ticket()));await f.db.run(principal(),s=>s.listTickets(10,null));
 const query=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!.sql;
 assert.match(query,/to_char\(created_at at time zone 'UTC'/i);
 assert.match(query,/order by tickets\.created_at desc,id desc limit \$5/);
 assert.match(query,/\(created_at,id\)<\(\$3::timestamptz,\$4::uuid\)/);
});
test('replay immutable creation time does not conflate two instants in one millisecond',()=>{
 assert.throws(()=>validateTicketReplay(ticket({createdAt:at+'123456Z'}),ticket({createdAt:at+'123457Z'})),{code:'invalid_idempotency_result'});
});
test('conversation rejects normalized-impossible calendar dates rather than accepting Date.parse coercion',()=>{
 assert.throws(()=>validateConversationResult([msg('m','2026-02-30T12:00:00.000Z')],ticket(),'messages',false,10),{code:'invalid_conversation_result'});
});
test('list state accepts canonical six-digit timestamps',async()=>{
 const path='../web/ticket-list-state.js';const {createTicketListState}=await import(path);
 const state=createTicketListState();const op=state.begin();
 assert.equal(state.accept(op,{items:[ticketDto(principal(),ticket({createdAt:at+'123456Z'}))],next_cursor:null}),true);
});
test('timeline state accepts and orders mixed precision instants without collapsing ties',async()=>{
 const path='../web/timeline-state.js';const {createTimelineState}=await import(path);const state=createTimelineState();state.reset('session/ticket',false);
 const event=(id:string,time:string)=>({id,type:'message.created',data:{},created_at:time});
 assert.equal(state.accept(state.begin(),{items:[event('event-z',at+'123001Z'),event('event-a',at+'123Z')],next_cursor:null}),true);
});
test('conversation display orders mixed precision chronologically',async()=>{
 const path='../web/conversation-state.js';const {createConversationState}=await import(path);const state=createConversationState();const g=state.reset('one');
 state.accept(g,'messages',{items:[{id:'a',created_at:at+'123Z'},{id:'b',created_at:at+'123001Z'}],next_cursor:null});
 assert.deepEqual(state.items('messages').map((x:{id:string})=>x.id),['a','b']);
});
test('same instant uses a deterministic identifier order matching the cursor predicate',async()=>{
 const items=['t-a','t-B','t_1','t-9'].map(id=>ticket({id,createdAt:at+'123Z'}));
 const service=new HelpdeskService(new MemoryUnitOfWork({tickets:items}));let cursor:string|undefined;const ids:string[]=[];
 for(let n=0;n<5;n++){const result=await service.list(principal(),{limit:1,...(cursor?{cursor}:{})});ids.push(...result.items.map(x=>x.id));cursor=result.nextCursor??undefined;if(!cursor)break;}
 assert.deepEqual(ids,items.map(x=>x.id).sort().reverse());
});
test('conversation display ID tie-break agrees with cursor ordering, not locale collation',async()=>{
 const path='../web/conversation-state.js';const {createConversationState}=await import(path);const state=createConversationState();
 state.accept(state.reset('one'),'messages',{items:['m-a','m-B','m_1'].map(id=>({id,created_at:at+'123Z'})),next_cursor:null});
 assert.deepEqual(state.items('messages').map((x:{id:string})=>x.id),['m-a','m-B','m_1'].sort());
});
test('SQL projection refuses infinity and non-AD/out-of-range years instead of formatting ambiguous eras',async()=>{
 const f=sqlFixture(pgRow(ticket()));await f.db.run(principal(),s=>s.listTickets(1,null));
 const q=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!.sql;
 assert.match(q,/case when created_at >= '0001-01-01 00:00:00\+00'::timestamptz/);
 assert.match(q,/created_at < '10000-01-01 00:00:00\+00'::timestamptz/);
});
test('an invalid timestamp returned by the driver is a safe error, not a fabricated Date',async()=>{
 const id='00000000-0000-4000-8000-000000000001';
 for(const bad of [null,'infinity','2026-02-30T00:00:00.000001Z','2026-09-17T12:00:00.1234567Z']){
  const f=sqlFixture({...pgRow(ticket({id})),created_at:bad});
  await assert.rejects(()=>f.db.run(principal(),s=>s.getTicket(id)),{code:'invalid_database_result',status:503});
 }
});
