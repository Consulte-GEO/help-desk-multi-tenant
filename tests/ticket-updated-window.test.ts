import test from 'node:test';import assert from 'node:assert/strict';
import {ticketSearch} from '../src/application/ticket-search.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {createTicketListState} from '../web/ticket-list-state.js';import {createTicketSummaryState} from '../web/ticket-summary-state.js';
import {applyTicketView} from '../web/ticket-views.js';import {inboxFiltersDiffer} from '../web/inbox-view-state.js';
import {principal,ticket} from './fixtures.ts';
const from='2026-10-17T03:00:00.000100Z',before='2026-10-17T03:00:00.000200Z',window={updated_from:from,updated_before:before};
test('update and creation windows intersect while ordering and cursor stay on creation',async()=>{
 const older='2026-10-01T00:00:00.000Z',middle='2026-10-02T00:00:00.000Z',newer='2026-10-03T00:00:00.000Z';
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({id:'old-created',createdAt:older,updatedAt:from}),ticket({id:'new-created',createdAt:newer,updatedAt:from}),ticket({id:'middle-created',createdAt:middle,updatedAt:from.replace('100Z','101Z')}),ticket({id:'old-updated',createdAt:older,updatedAt:older})]})),p=principal();
 const first=await s.list(p,{limit:1,...window});assert.deepEqual(first.items.map(t=>t.id),['new-created']);assert.ok(first.nextCursor);const next=await s.list(p,{limit:1,...window,cursor:first.nextCursor!});assert.deepEqual(next.items.map(t=>t.id),['middle-created']);
 const combined={...window,created_from:middle,created_before:newer};assert.equal((await s.summarize(p,combined)).total,1);assert.deepEqual((await s.list(p,{limit:10,...combined})).items.map(t=>t.id),['middle-created']);await assert.rejects(()=>s.list(p,{limit:1,...combined,cursor:first.nextCursor!}),{code:'invalid_cursor'});
 for(const state of [createTicketListState(),createTicketSummaryState()]){if('reset'in state&&'filters'in state)state.reset(combined);const op='filters'in state?state.begin():state.begin(combined);const params=new URL(op!.path,'https://hd.test').searchParams;for(const [key,value]of Object.entries(combined))assert.equal(params.get(key),value);}
 const person={kind:'human',scopes:['tickets:read'],grants:[{role:'agent'}]};assert.deepEqual(applyTicketView(combined,'all',person),combined);
});
test('update window normalizes only redundant fractional zeros and rejects invalid bounds',()=>{
 assert.deepEqual(ticketSearch({limit:1,updated_from:'2026-10-17T03:00:00.123000Z',updated_before:before.replace('03:','04:')}),{updated_from:'2026-10-17T03:00:00.123Z',updated_before:before.replace('03:','04:')});
 for(const value of ['',null,42,new Date(),'2026-02-30T03:00:00.000Z','2026-10-17','2026-10-17T03:00:00Z','2026-10-17T03:00:00.0000001Z','2026-10-17T00:00:00.000-03:00','0000-01-01T00:00:00.000Z'])for(const key of ['updated_from','updated_before'])assert.throws(()=>ticketSearch({limit:1,[key]:value} as any),{code:'invalid_input'});
 for(const w of [{updated_from:before,updated_before:from},{updated_from:from,updated_before:from},{updated_from:'2026-10-17T03:00:00.000Z',updated_before:'2026-10-17T03:00:00.000000Z'}])assert.throws(()=>ticketSearch({limit:1,...w}),{code:'invalid_input'});
 assert.ok(Object.isFrozen(ticketSearch({limit:1,...window})));assert.deepEqual(ticketSearch({limit:1}),{});
});
test('update window is inclusive/exclusive with exact microseconds, before pages and totals',async()=>{
 const db=new MemoryUnitOfWork({tickets:[ticket({id:'before',updatedAt:'2026-10-17T03:00:00.000099Z'}),ticket({id:'at-end',updatedAt:before}),...Array.from({length:153},(_,i)=>ticket({id:'owned-'+String(i).padStart(3,'0'),updatedAt:i?from.replace('100Z','101Z'):from})),ticket({id:'private-person',createdBy:'other',updatedAt:from}),ticket({id:'private-account',accountId:'other',updatedAt:from}),ticket({id:'private-workspace',workspaceId:'other',updatedAt:from})]});
 const s=new HelpdeskService(db),p=principal();assert.equal((await s.summarize(p,window)).total,153);let cursor:string|undefined;const ids=new Set<string>();do{const page=await s.list(p,{limit:7,...window,...(cursor?{cursor}:{})});for(const row of page.items){assert.ok(!ids.has(row.id));ids.add(row.id);}cursor=page.nextCursor??undefined;}while(cursor);assert.equal(ids.size,153);
 assert.equal((await s.summarize(p,{updated_before:from})).total,1);assert.equal((await s.summarize(p,{updated_from:before})).total,1);
 assert.equal((await s.summarize(p,{...window,priority:'urgent'})).total,0);assert.equal((await s.summarize({...p,grants:[]},window)).total,0);
 await assert.rejects(()=>s.list({...p,scopes:[]},{limit:1,...window}),{status:403});
});
test('update window binds cursor, accepts equivalent bounds and invalidates client generations',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({id:'a'}),ticket({id:'b'})]})),p=principal(),f={updated_from:'2026-01-01T00:00:00.000000Z'};
 const first=await s.list(p,{limit:1,...f});assert.ok(first.nextCursor);assert.equal((await s.list(p,{limit:1,updated_from:'2026-01-01T00:00:00.000Z',cursor:first.nextCursor!})).items.length,1);
 await assert.rejects(()=>s.list(p,{limit:1,cursor:first.nextCursor!}),{code:'invalid_cursor'});
 const list=createTicketListState();list.reset(window);const old=list.begin()!;for(const [key,value]of Object.entries(window))assert.equal(new URL(old.path,'https://hd.test').searchParams.get(key),value);
 const sum=createTicketSummaryState(),operation=sum.begin(window);for(const [key,value]of Object.entries(window))assert.equal(new URL(operation.path,'https://hd.test').searchParams.get(key),value);
 list.reset({updated_from:from});assert.equal(list.current(old),false);assert.equal(inboxFiltersDiffer(window,{}),true);
 const person={kind:'human',scopes:['tickets:read'],grants:[{role:'agent'}]};assert.deepEqual(applyTicketView(window,'waiting',person),{...window,status:'waiting_for_you'});
 for(const bad of [{updated_from:''},{updated_before:'today'},{updated_from:before,updated_before:from}])assert.throws(()=>list.reset(bad));
});
test('HTTP list/totals share public window grammar, refuse duplicates and retain private filter authority',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({updatedAt:from})]}));
 for(const path of ['/tickets','/tickets/summary']){
  const events:unknown[]=[],h=createHttpHandler({service:s,ticketTotals:true,authenticate:async()=>principal(),observe:event=>{events.push(event);}}),url='https://hd.test/v1'+path;
  const response=await h(new Request(url+'?'+new URLSearchParams(window)));assert.equal(response.status,200);const body=await response.json();assert.equal(path.endsWith('summary')?body.total:body.items.length,1);assert.equal(response.headers.get('cache-control'),'no-store');
  for(const q of ['updated_from=','updated_before=today','updated_from='+before+'&updated_before='+from,'updated_from='+from+'&updated_from='+from])assert.equal((await h(new Request(url+'?'+q))).status,400);
  assert.equal((await h(new Request(url+'?'+new URLSearchParams({...window,internal_status:'new'})))).status,403);
  assert.doesNotMatch(JSON.stringify(events),/updated_from|updated_before|000100Z|000200Z/);
 }
});
