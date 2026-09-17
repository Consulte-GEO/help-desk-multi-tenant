import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import type {UnitOfWork,Store} from '../src/application/ports.ts';
import {principal,ticket,coverage} from './fixtures.ts';
const u=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=()=>principal({id:u(1),workspaceId:u(2),grants:[{accountId:u(3),role:'requester'}]});
const config={supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fixture'};
function authentication(result:unknown=actor(),user:unknown={id:u(4)}){
 let sql=0,network=0;
 const pool:SqlPool={query:async()=>{sql++;return {rows:[{principal:result}],rowCount:1};},connect:async()=>{throw Error('unused');},end:async()=>{}};
 return {auth:createAuthentication(pool,config,async()=>{network++;return Response.json(user);}),counts:()=>({sql,network})};
}
const req=(workspace=u(2))=>new Request('https://test.invalid/v1/me',{headers:{authorization:'Bearer human.jwt.fixture','x-workspace-id':workspace}});
test('production Auth rejects symbolic workspace before provider/SQL',async()=>{
 const a=authentication();await assert.rejects(()=>a.auth.authenticate(req('workspace-a')),{code:'invalid_identifier'});
 assert.deepEqual(a.counts(),{sql:0,network:0});
});
test('successful provider response must contain a UUID, not a demo alias',async()=>{
 const a=authentication(actor(),{id:'supabase-user'});await assert.rejects(()=>a.auth.authenticate(req()),{code:'auth_unavailable'});assert.equal(a.counts().sql,0);
});
for(const [label,patch] of [
 ['principal',{id:'person-a'}],['grant',{grants:[{accountId:'account-a',role:'requester'}]}]
] as const)test('private principal rejects non-UUID '+label,async()=>{
 const a=authentication({...actor(),...patch});await assert.rejects(()=>a.auth.authenticate(req()),{code:'invalid_principal'});
});
test('production Auth preserves distinct Supabase user and Help Desk principal UUIDs',async()=>{
 const a=authentication();const p=await a.auth.authenticate(req());assert.equal(p.id,u(1));assert.notEqual(p.id,u(4));
});
test('PostgreSQL store rejects an unknown symbolic ticket without querying it',async()=>{
 const queries:string[]=[];
 const c={query:async(sql:string)=>{queries.push(sql);return {command:sql==='BEGIN'?'BEGIN':sql==='COMMIT'?'COMMIT':'SELECT',rows:[],rowCount:0};},release:()=>{}};
 const pool:SqlPool={connect:async()=>c,query:c.query,end:async()=>{}};
 await assert.rejects(()=>new HelpdeskService(new PostgresUnitOfWork(pool)).get(actor(),'not-a-uuid'),{status:404});
 assert.equal(queries.some(q=>q.includes('from helpdesk_core.tickets')),false);
});
for(const [label,bad] of [['NUL','text\u0000text'],['lone high surrogate','text\uD800'],['lone low surrogate','text\uDC00']] as const){
 test('creation rejects '+label+' before persistence',async()=>{
  const db=new MemoryUnitOfWork({coverages:[coverage()]});const service=new HelpdeskService(db,()=>new Date('2026-09-16T12:00:00Z'));
  await assert.rejects(()=>service.create(principal(),{accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Valid subject',description:bad,priority:'normal'},'review-input-validation','review'),{status:400});
  assert.equal(db.snapshot().tickets.length,0);assert.equal(db.snapshot().outbox.length,0);
 });
 test('public reply rejects '+label+' without a new message',async()=>{
  const db=new MemoryUnitOfWork({tickets:[ticket()]});await assert.rejects(()=>new HelpdeskService(db).addMessage(principal(),'ticket-a',bad,'review-bad-message','review'),{status:400});assert.equal(db.snapshot().messages.length,0);
 });
}
test('valid multiline Unicode content is preserved exactly',async()=>{
 const db=new MemoryUnitOfWork({tickets:[ticket()]});const body='Olá 👷🏽‍♀️\nLinha 2\tOK\r\nFim';
 const r=await new HelpdeskService(db).addMessage(principal(),'ticket-a',body,'review-valid-message','review');assert.equal(r.message.body,body);
});
function badRows(kind:'messages'|'notes'|'events',rows:unknown,t=ticket()):UnitOfWork{
 const base=new MemoryUnitOfWork({tickets:[t]});return {run:(p,work)=>base.run(p,s=>work({...s,[kind]:async()=>rows} as Store))};
}
const message=()=>({id:'message-a',workspaceId:'workspace-a',accountId:'account-a',ticketId:'ticket-a',actorId:'person-a',actorType:'customer',body:'PRIVATE-ROW-SENTINEL',createdAt:'2026-09-16T12:00:00.000Z'});
for(const [field,value] of [['workspaceId','workspace-b'],['accountId','account-b'],['ticketId','ticket-b']] as const){
 test('conversation rejects wrong '+field+' even after authorized parent lookup',async()=>{
  const service=new HelpdeskService(badRows('messages',[{...message(),[field]:value}]));
  const response=await createHttpHandler({service,authenticate:async()=>principal()})(new Request('https://test.invalid/v1/tickets/ticket-a/messages'));
  assert.equal(response.status,503);assert.equal((await response.text()).includes('PRIVATE-ROW-SENTINEL'),false);
 });
}
test('conversation rejects duplicated rows rather than emitting a partial page',async()=>{
 const service=new HelpdeskService(badRows('messages',[message(),message()]));await assert.rejects(()=>service.conversation(principal(),'ticket-a','messages',{limit:25}),{code:'invalid_conversation_result'});
});
test('customer cannot receive a misclassified internal event',async()=>{
 const e={...message(),type:'note.created',customerVisible:true,data:{noteId:'note-private'}};
 const service=new HelpdeskService(badRows('events',[e]));await assert.rejects(()=>service.conversation(principal(),'ticket-a','timeline',{limit:25}),{code:'invalid_conversation_result'});
});
test('operator internal notes still require the exact account/ticket',async()=>{
 const p=principal({grants:[{accountId:'account-a',role:'agent'}]});const service=new HelpdeskService(badRows('notes',[{...message(),accountId:'account-b'}]));
 await assert.rejects(()=>service.conversation(p,'ticket-a','notes',{limit:25}),{code:'invalid_conversation_result'});
});
test('parent lookup cannot substitute another authorized ticket',async()=>{
 const db:UnitOfWork={run:async(_p,work)=>work({getTicket:async()=>ticket({id:'ticket-b'})} as unknown as Store)};
 await assert.rejects(()=>new HelpdeskService(db).get(principal(),'ticket-a'),{status:404});
});
