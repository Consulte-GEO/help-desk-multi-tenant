import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';import {ticketSearch} from '../src/application/ticket-search.ts';
import {createTicketListState} from '../web/ticket-list-state.js';import {createTicketSummaryState} from '../web/ticket-summary-state.js';
import {applyTicketView,activeTicketView} from '../web/ticket-views.js';import {inboxFiltersDiffer} from '../web/inbox-view-state.js';
import {principal,ticket} from './fixtures.ts';
const operator=principal({grants:[{accountId:'account-a',role:'agent'},{accountId:'account-b',role:'account_manager'}]}),f={internal_status:'waiting_internal'};
const rows=[ticket({id:'visible',status:'waiting_internal',createdBy:'other'}),ticket({id:'third-party',status:'waiting_third_party'}),ticket({id:'own-b',accountId:'account-b',status:'waiting_internal'}),ticket({id:'other-workspace',workspaceId:'other',status:'waiting_internal'})];
const setup=()=>new HelpdeskService(new MemoryUnitOfWork({tickets:rows}));
test('private status selects exact states only where caller is an operator and combines public filters',async()=>{
 const s=setup();assert.deepEqual((await s.list(operator,{limit:1,...f})).items.map(t=>t.id),['visible']);assert.equal((await s.summarize(operator,f)).total,1);
 assert.equal((await s.summarize(operator,{...f,status:'in_progress'})).total,1);assert.equal((await s.summarize(operator,{...f,status:'received'})).total,0);
 assert.equal((await s.summarize(operator,{...f,priority:'urgent'})).total,0);
 const noNotes={...operator,scopes:['tickets:read']};assert.equal((await s.summarize(noNotes,f)).total,1);await assert.rejects(()=>s.conversation(noNotes,'visible','notes',{limit:1}),{status:403});
 assert.equal((await s.summarize({...operator,workspaceRole:'admin'},f)).total,2);
 for(const p of [principal(),principal({grants:[{accountId:'account-a',role:'account_manager'}]}),principal({kind:'integration',productInstanceIds:['geolab-production']}),{...operator,scopes:[]}]){
  await assert.rejects(()=>s.list(p,{limit:1,...f}),{status:403});await assert.rejects(()=>s.summarize(p,f),{status:403});
 }
 await assert.rejects(()=>s.list(operator,{limit:1,...f,accountId:'account-b'}),{status:403});
});
test('private filter precedes pagination, counts whole authorized corpus and binds cursors',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[...Array.from({length:32},(_,i)=>ticket({id:'t-'+i,status:'waiting_internal'})),...Array.from({length:40},(_,i)=>ticket({id:'b-'+i,accountId:'account-b',status:'waiting_internal',createdAt:'2026-10-16T00:00:00Z'}))]}));
 assert.equal((await s.summarize(operator,f)).total,32);const first=await s.list(operator,{limit:1,...f});assert.ok(first.nextCursor);
 await assert.rejects(()=>s.list(operator,{limit:1,cursor:first.nextCursor!}),{code:'invalid_cursor'});
 const seen=new Set<string>();let cursor:string|undefined;do{const p=await s.list(operator,{limit:7,...f,...(cursor?{cursor}:{})});for(const t of p.items){assert.ok(!seen.has(t.id));seen.add(t.id);}cursor=p.nextCursor??undefined;}while(cursor);assert.equal(seen.size,32);
 await assert.rejects(()=>s.summarize({...operator,grants:[{accountId:'account-a',role:'requester'}]},f),{status:403});
});
test('HTTP refuses unauthorized, invalid/repeated selectors and uses same mode on list and totals',async()=>{
 for(const path of ['/tickets','/tickets/summary']){
  const h=createHttpHandler({service:setup(),ticketTotals:true,authenticate:async()=>operator});
  const r=await h(new Request('https://hd.test/v1'+path+'?internal_status=waiting_internal'));assert.equal(r.status,200);const b=await r.json();assert.equal(path.endsWith('summary')?b.total:b.items.length,1);assert.equal(r.headers.get('cache-control'),'no-store');
  for(const query of ['internal_status=','internal_status=received','internal_status=waiting_internal&internal_status=open'])assert.equal((await h(new Request('https://hd.test/v1'+path+'?'+query))).status,400);
  const denied=createHttpHandler({service:setup(),ticketTotals:true,authenticate:async()=>principal()});assert.equal((await denied(new Request('https://hd.test/v1'+path+'?internal_status=waiting_internal'))).status,403);
 }
 assert.throws(()=>ticketSearch({limit:1,internal_status:'unknown'}),{code:'invalid_input'});
});
test('client query/cursor generations include private status; quick views clear it and mark custom selection',()=>{
 const s=createTicketListState();s.reset(f);const old=s.begin()!;assert.equal(new URL(old.path,'https://hd.test').searchParams.get('internal_status'),'waiting_internal');
 const summary=createTicketSummaryState();assert.equal(new URL(summary.begin(f).path,'https://hd.test').searchParams.get('internal_status'),'waiting_internal');s.reset({});assert.equal(s.current(old),false);
 assert.throws(()=>s.reset({internal_status:'received'}));assert.equal(inboxFiltersDiffer(f,{}),true);
 const p={kind:'human',scopes:['tickets:read'],grants:[{role:'agent'}]},query={...f,q:'needle',search_in:'description',priority:'high'};
 assert.equal(activeTicketView(query,p),null);assert.deepEqual(applyTicketView(query,'waiting',p),{q:'needle',search_in:'description',priority:'high',status:'waiting_for_you'});
});
