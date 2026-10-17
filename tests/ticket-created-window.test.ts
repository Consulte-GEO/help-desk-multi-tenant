import test from 'node:test';import assert from 'node:assert/strict';
import {ticketSearch} from '../src/application/ticket-search.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {createTicketListState} from '../web/ticket-list-state.js';import {createTicketSummaryState} from '../web/ticket-summary-state.js';
import {applyTicketView} from '../web/ticket-views.js';import {inboxFiltersDiffer} from '../web/inbox-view-state.js';
import {principal,ticket} from './fixtures.ts';
const from='2026-10-17T03:00:00.000100Z',before='2026-10-17T03:00:00.000200Z',window={created_from:from,created_before:before};
test('creation window normalizes only redundant fractional zeros and rejects invalid bounds',()=>{
 assert.deepEqual(ticketSearch({limit:1,created_from:'2026-10-17T03:00:00.123000Z',created_before:before.replace('03:','04:')}),{created_from:'2026-10-17T03:00:00.123Z',created_before:before.replace('03:','04:')});
 for(const value of ['',null,42,new Date(),'2026-02-30T03:00:00.000Z','2026-10-17','2026-10-17T03:00:00Z','2026-10-17T03:00:00.0000001Z','2026-10-17T00:00:00.000-03:00','0000-01-01T00:00:00.000Z'])for(const key of ['created_from','created_before'])assert.throws(()=>ticketSearch({limit:1,[key]:value} as any),{code:'invalid_input'});
 for(const w of [{created_from:before,created_before:from},{created_from:from,created_before:from},{created_from:'2026-10-17T03:00:00.000Z',created_before:'2026-10-17T03:00:00.000000Z'}])assert.throws(()=>ticketSearch({limit:1,...w}),{code:'invalid_input'});
 assert.ok(Object.isFrozen(ticketSearch({limit:1,...window})));assert.deepEqual(ticketSearch({limit:1}),{});
});
test('creation window is inclusive/exclusive with exact microseconds, before pages and totals',async()=>{
 const db=new MemoryUnitOfWork({tickets:[ticket({id:'before',createdAt:'2026-10-17T03:00:00.000099Z'}),ticket({id:'at-end',createdAt:before}),...Array.from({length:153},(_,i)=>ticket({id:'owned-'+String(i).padStart(3,'0'),createdAt:i?from.replace('100Z','101Z'):from})),ticket({id:'private-person',createdBy:'other',createdAt:from}),ticket({id:'private-account',accountId:'other',createdAt:from}),ticket({id:'private-workspace',workspaceId:'other',createdAt:from})]});
 const s=new HelpdeskService(db),p=principal();assert.equal((await s.summarize(p,window)).total,153);let cursor:string|undefined;const ids=new Set<string>();do{const page=await s.list(p,{limit:7,...window,...(cursor?{cursor}:{})});for(const row of page.items){assert.ok(!ids.has(row.id));ids.add(row.id);}cursor=page.nextCursor??undefined;}while(cursor);assert.equal(ids.size,153);
 assert.equal((await s.summarize(p,{created_before:from})).total,1);assert.equal((await s.summarize(p,{created_from:before})).total,1);
 assert.equal((await s.summarize(p,{...window,priority:'urgent'})).total,0);assert.equal((await s.summarize({...p,grants:[]},window)).total,0);
 await assert.rejects(()=>s.list({...p,scopes:[]},{limit:1,...window}),{status:403});
});
test('creation window binds cursor, accepts equivalent bounds and invalidates client generations',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({id:'a'}),ticket({id:'b'})]})),p=principal(),f={created_from:'2026-01-01T00:00:00.000000Z'};
 const first=await s.list(p,{limit:1,...f});assert.ok(first.nextCursor);assert.equal((await s.list(p,{limit:1,created_from:'2026-01-01T00:00:00.000Z',cursor:first.nextCursor!})).items.length,1);
 await assert.rejects(()=>s.list(p,{limit:1,cursor:first.nextCursor!}),{code:'invalid_cursor'});
 const list=createTicketListState();list.reset(window);const old=list.begin()!;for(const [key,value]of Object.entries(window))assert.equal(new URL(old.path,'https://hd.test').searchParams.get(key),value);
 const sum=createTicketSummaryState(),operation=sum.begin(window);for(const [key,value]of Object.entries(window))assert.equal(new URL(operation.path,'https://hd.test').searchParams.get(key),value);
 list.reset({created_from:from});assert.equal(list.current(old),false);assert.equal(inboxFiltersDiffer(window,{}),true);
 const person={kind:'human',scopes:['tickets:read'],grants:[{role:'agent'}]};assert.deepEqual(applyTicketView(window,'waiting',person),{...window,status:'waiting_for_you'});
 for(const bad of [{created_from:''},{created_before:'today'},{created_from:before,created_before:from}])assert.throws(()=>list.reset(bad));
});
test('HTTP list/totals share public window grammar, refuse duplicates and retain private filter authority',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({createdAt:from})]}));
 for(const path of ['/tickets','/tickets/summary']){
  const events:unknown[]=[],h=createHttpHandler({service:s,ticketTotals:true,authenticate:async()=>principal(),observe:event=>{events.push(event);}}),url='https://hd.test/v1'+path;
  const response=await h(new Request(url+'?'+new URLSearchParams(window)));assert.equal(response.status,200);const body=await response.json();assert.equal(path.endsWith('summary')?body.total:body.items.length,1);assert.equal(response.headers.get('cache-control'),'no-store');
  for(const q of ['created_from=','created_before=today','created_from='+before+'&created_before='+from,'created_from='+from+'&created_from='+from])assert.equal((await h(new Request(url+'?'+q))).status,400);
  assert.equal((await h(new Request(url+'?'+new URLSearchParams({...window,internal_status:'new'})))).status,403);
  assert.doesNotMatch(JSON.stringify(events),/created_from|created_before|000100Z|000200Z/);
 }
});
