import test from 'node:test';import assert from 'node:assert/strict';
import {ticketSearch} from '../src/application/ticket-search.ts';import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';import {createHttpHandler} from '../src/http/handler.ts';import {principal,ticket} from './fixtures.ts';
import {createTicketListState} from '../web/ticket-list-state.js';import {createTicketSummaryState} from '../web/ticket-summary-state.js';import {applyTicketView,activeTicketView} from '../web/ticket-views.js';import {inboxFiltersDiffer} from '../web/inbox-view-state.js';
const at='2026-10-17T03:00:00.000100Z';
test('creation sort normalizes newest to absence and only accepts the two declared orders',()=>{
 assert.deepEqual(ticketSearch({limit:1,sort:'oldest'} as any),{sort:'oldest'});assert.deepEqual(ticketSearch({limit:1,sort:'newest'} as any),{});assert.deepEqual(ticketSearch({limit:1}),{});
 for(const value of ['',null,42,{},'OLDEST',' oldest','updated','oldest;drop table x'])assert.throws(()=>ticketSearch({limit:1,sort:value} as any),{code:'invalid_input'});
 assert(Object.isFrozen(ticketSearch({limit:1,sort:'oldest'} as any)));
});
test('oldest sorts the complete authorized query by exact time/id before page boundaries',async()=>{
 const rows=Array.from({length:153},(_,i)=>ticket({id:'owned-'+String(i).padStart(3,'0'),createdAt:at.replace('100Z',String(100+(i%3)).padStart(3,'0')+'Z')}));
 const expected=[0,1,2].flatMap(group=>rows.filter((_,i)=>i%3===group).map(t=>t.id));
 const db=new MemoryUnitOfWork({tickets:[...rows,ticket({id:'hidden-person',createdBy:'other',createdAt:'2020-01-01T00:00:00.000Z'}),ticket({id:'hidden-account',accountId:'other',createdAt:at}),ticket({id:'hidden-workspace',workspaceId:'other',createdAt:at})]}),s=new HelpdeskService(db),p=principal();
 for(const sort of ['oldest','newest']){let cursor:string|undefined;const ids:string[]=[];do{const page=await s.list(p,{limit:7,sort,...(cursor?{cursor}:{})} as any);ids.push(...page.items.map(t=>t.id));cursor=page.nextCursor??undefined;}while(cursor);assert.deepEqual(ids,sort==='oldest'?expected:[...expected].reverse());assert.equal((await s.summarize(p,{sort} as any)).total,153);}
 assert.equal((await s.summarize(p,{sort:'oldest',created_from:at,created_before:at.replace('100Z','101Z')} as any)).total,51);
 assert.equal((await s.summarize(p,{sort:'oldest',priority:'urgent'} as any)).total,0);assert.equal((await s.list({...p,grants:[]},{limit:7,sort:'oldest'} as any)).items.length,0);await assert.rejects(()=>s.list({...p,scopes:[]},{limit:7,sort:'oldest'} as any),{status:403});
});
test('sort binds the cursor, keeps default cursors compatible, and invalidates client generations',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({id:'a'}),ticket({id:'b'})]})),p=principal();
 const old=await s.list(p,{limit:1});assert(old.nextCursor);assert.equal((await s.list(p,{limit:1,sort:'newest',cursor:old.nextCursor} as any)).items.length,1);
 await assert.rejects(()=>s.list(p,{limit:1,sort:'oldest',cursor:old.nextCursor} as any),{code:'invalid_cursor'});const asc=await s.list(p,{limit:1,sort:'oldest'} as any);await assert.rejects(()=>s.list(p,{limit:1,cursor:asc.nextCursor!}),{code:'invalid_cursor'});
 const list=createTicketListState(),sum=createTicketSummaryState();list.reset({sort:'oldest'} as any);const op=list.begin()!,totals=sum.begin({...list.filters()});assert.equal(new URL(op.path,'https://hd.test').searchParams.get('sort'),'oldest');assert.equal(new URL(totals.path,'https://hd.test').searchParams.get('sort'),'oldest');list.reset();assert(!list.current(op));sum.reset();assert.equal(sum.accept(totals,{}),false);
 list.reset({sort:'newest'} as any);assert.deepEqual(list.filters(),{});assert(inboxFiltersDiffer({sort:'oldest'},{}));assert(!inboxFiltersDiffer({sort:'newest'},{}));
 const person={kind:'human',scopes:['tickets:read'],grants:[{role:'agent'}]};assert.deepEqual(applyTicketView({sort:'oldest',created_from:at},'waiting',person),{sort:'oldest',created_from:at,status:'waiting_for_you'});assert.equal(activeTicketView({sort:'oldest'},person),'all');assert.throws(()=>list.reset({sort:'other'} as any));
});
test('HTTP list and totals accept order, reject duplicates/invalid values and retain private authority',async()=>{
 const s=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket({id:'a'}),ticket({id:'b'})]})),events:unknown[]=[],h=createHttpHandler({service:s,ticketTotals:true,authenticate:async()=>principal(),observe:e=>{events.push(e);}});
 for(const path of ['/tickets','/tickets/summary']){for(const sort of ['oldest','newest']){const r=await h(new Request('https://hd.test/v1'+path+'?sort='+sort));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const b=await r.json();if(path.endsWith('/summary'))assert.equal(b.total,2);else assert.deepEqual(b.items.map((t:any)=>t.id),sort==='oldest'?['a','b']:['b','a']);}
  for(const q of ['sort=','sort=updated','sort=oldest&sort=newest'])assert.equal((await h(new Request('https://hd.test/v1'+path+'?'+q))).status,400);assert.equal((await h(new Request('https://hd.test/v1'+path+'?sort=oldest&internal_status=new'))).status,403);}
 assert.doesNotMatch(JSON.stringify(events),/oldest|newest|sort=/);
});
