import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {ticketSearch} from '../src/application/ticket-search.ts';
import {createTicketListState} from '../web/ticket-list-state.js';
import {createTicketSummaryState} from '../web/ticket-summary-state.js';
import {applyTicketView} from '../web/ticket-views.js';
import {inboxFiltersDiffer} from '../web/inbox-view-state.js';
import {principal,ticket} from './fixtures.ts';
const p=principal(),options={q:'RELATÓRIO %_',search_in:'description'};
const setup=()=>new HelpdeskService(new MemoryUnitOfWork({tickets:[
 ticket({id:'description-match',subject:'Assunto sem o termo',description:'Detalhes de relatório %_ aprovado'}),
 ticket({id:'subject-only',subject:'Relatório %_',description:'Descrição diversa'}),
 ticket({id:'hidden-person',createdBy:'stranger',description:'Relatório %_'}),
 ticket({id:'hidden-account',accountId:'other',description:'Relatório %_'}),
 ticket({id:'hidden-workspace',workspaceId:'other',description:'Relatório %_'})]}));

test('description mode is explicit, literal, case folded, accent sensitive and authorized',async()=>{
 const s=setup();assert.deepEqual((await s.list(p,{limit:1,...options})).items.map(t=>t.id),['description-match']);
 assert.equal((await s.summarize(p,options)).total,1);
 assert.deepEqual((await s.list(p,{limit:25,q:options.q})).items.map(t=>t.id),['subject-only']);
 for(const q of ['relatorio %_','relatório __','não existe'])assert.equal((await s.summarize(p,{...options,q})).total,0);
 assert.equal((await s.summarize(p,{...options,priority:'urgent'})).total,0);
 assert.equal((await s.summarize({...p,grants:[]},options)).total,0);
 await assert.rejects(()=>s.list({...p,scopes:[]},{limit:1,...options}),{status:403});
 const m={...p,kind:'integration' as const,productInstanceIds:['different']};assert.equal((await s.summarize(m,options)).total,0);
});

test('description search precedes LIMIT, keeps complete totals and binds the cursor to mode',async()=>{
 const rows=Array.from({length:607},(_,i)=>ticket({id:'t-'+String(i).padStart(4,'0'),description:'needle',subject:'needle in both'}));
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:rows}));const filters={q:'needle',search_in:'description'};
 assert.equal((await s.summarize(p,filters)).total,607);
 const first=await s.list(p,{limit:1,...filters});assert.equal(first.items.length,1);assert.ok(first.nextCursor);
 await assert.rejects(()=>s.list(p,{limit:1,q:'needle',cursor:first.nextCursor!}),{code:'invalid_cursor'});
 const seen=new Set<string>();let cursor:string|undefined;
 do{const page=await s.list(p,{limit:100,...filters,...(cursor?{cursor}:{})});for(const t of page.items){assert.ok(!seen.has(t.id));seen.add(t.id);}cursor=page.nextCursor??undefined;}while(cursor);
 assert.equal(seen.size,607);
});

test('HTTP list and totals accept same mode, reject missing term/unknown/repeated selectors and keep telemetry private',async()=>{
 const events:unknown[]=[],h=createHttpHandler({service:setup(),ticketTotals:true,authenticate:async()=>p,observe:e=>events.push(e)});
 for(const endpoint of ['/tickets','/tickets/summary']){
  const r=await h(new Request('https://hd.test/v1'+endpoint+'?q=relat%C3%B3rio%20%25_&search_in=description'));assert.equal(r.status,200);const b=await r.json();
  if(endpoint.endsWith('summary'))assert.equal(b.total,1);else assert.deepEqual(b.items.map((t:any)=>t.id),['description-match']);
  assert.equal(r.headers.get('cache-control'),'no-store');
  for(const q of ['search_in=description','q=needle&search_in=notes','q=needle&search_in=','q=needle&search_in=description&search_in=description'])
   assert.equal((await h(new Request('https://hd.test/v1'+endpoint+'?'+q))).status,400,q);
 }
 assert.doesNotMatch(JSON.stringify(events),/relatório|%25|q=|search_in|description-match/);
});

test('mode requires valid q in application and UI, and quick views preserve it',()=>{
 assert.deepEqual(ticketSearch({...options,limit:25}),{q:'relatório %_',search_in:'description'});
 for(const v of [{search_in:'description'},{q:'needle',search_in:'notes'},{q:'needle',search_in:''}]){
  assert.throws(()=>ticketSearch({limit:25,...v}),{code:'invalid_input'});assert.throws(()=>createTicketListState().reset(v));
 }
 const state=createTicketListState();state.reset(options);const old=state.begin()!;assert.equal(new URL(old.path,'https://hd.test').searchParams.get('search_in'),'description');
 const totals=createTicketSummaryState();assert.equal(new URL(totals.begin(options).path,'https://hd.test').searchParams.get('search_in'),'description');
 state.reset({q:options.q});assert.equal(state.current(old),false);assert.deepEqual(state.filters(),{q:options.q});
 const person={kind:'human',scopes:['tickets:read'],workspace_role:null,grants:[]};
 assert.deepEqual(applyTicketView(options,'waiting',person),{...options,status:'waiting_for_you'});
 assert.equal(inboxFiltersDiffer(options,{q:options.q}),true);
});
