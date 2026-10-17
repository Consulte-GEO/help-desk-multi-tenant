import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedTicketHttpHandler} from '../src/http/scoped-ticket-handler.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createBorrowedPostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read']};
 const calls:{sql:string;args?:unknown[]}[]=[],state:{ready:boolean;abort?:()=>void;invalid?:unknown}={ready:true};
 const contexts=[{accountId:id(3),productInstanceId:id(4),connectionId:id(5),tenantId:'mrv'}];
 const pool:SqlPool={query:async()=>{throw Error('Second pool query forbidden');},end:async()=>{},connect:async()=>({release(){},async query(sql,args){calls.push({sql,args});
  if(sql.includes('cg_local_prepare_ticket_collection')){state.abort?.();return {command:'SELECT',rowCount:1,rows:[{source:state.invalid===undefined?contexts:state.invalid}]};}
  if(sql.includes('count(*)'))return {command:'SELECT',rowCount:1,rows:[{total:'0',received:'0',in_progress:'0',waiting_for_you:'0',resolved:'0',closed:'0'}]};
  return {command:['BEGIN','COMMIT','ROLLBACK'].includes(sql)?sql:'SELECT',rowCount:0,rows:[]};
 }})};
 const options:any={enabled:()=>state.ready,pool,resolver:createResourceAccessResolver({authority:{readAccess:async()=>{throw Error('Collection cannot choose caller refs');}},manifestFingerprint:'a'.repeat(64),timeoutMs:100,maxAgeMicros:1n}),
  directory:{readTicketResources:async()=>{throw Error('No collection directory chosen from caller');}},directoryTimeoutMs:100,collection:true,
  authenticate:async()=>p,rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},
  execute:async(c:any,actor:Principal,r:Request)=>createHttpHandler({ticketTotals:true,authenticate:async()=>actor,service:new HelpdeskService((createBorrowedPostgresUnitOfWork as any)(c,actor,{localCollection:true}))})(r)};
 return {p,calls,state,contexts,handler:createScopedTicketHttpHandler(options)};
}
const request=(query='',method='GET',signal?:AbortSignal)=>new Request('https://helpdesk.example/v1/tickets'+query,{method,signal});

test('mounted collection accepts explicit description mode on list and summary with same private namespace',async()=>{
 for(const endpoint of ['?q=needle&search_in=description','/summary?q=needle&search_in=description']){
  const f=fixture(),r=await f.handler(request(endpoint));assert.equal(r.status,200);
  const statement=f.calls.find(x=>x.sql.includes('from helpdesk_core.tickets'))!;assert.ok(statement);
  assert.match(statement.sql,/strpos\(translate\(description,/);assert.match(statement.sql,/cg_local_ticket_directory/);
  assert.doesNotMatch(statement.sql,/internal_notes|ticket_messages/);assert.equal(f.calls.at(-1)?.sql,'COMMIT');
 }
 for(const query of ['?q=needle&search_in=description&search_in=description','/summary?q=needle&search_in=notes']){
  const f=fixture(),r=await f.handler(request(query));assert.equal(r.status,400);assert.ok(!f.calls.some(x=>x.sql.includes('from helpdesk_core.tickets')));
 }
});

test('summary is an authenticated local collection route, never a caller-supplied ticket identifier',async()=>{
 const f=fixture(),r=await f.handler(request('/summary?q=needle'));assert.equal(r.status,200);assert.equal((await r.json()).total,0);
 assert.ok(f.calls.some(x=>x.sql.includes('cg_local_prepare_ticket_collection')));assert.equal(f.calls.at(-1)?.sql,'COMMIT');
 for(const query of ['/summary?limit=1','/summary?cursor=anything','/summary?q=ab&q=cd','/summary?refs=forged']){const denied=fixture();assert.equal((await denied.handler(request(query))).status,400);assert.equal(denied.calls.length,0);}
 const off=fixture();off.state.ready=false;assert.equal((await off.handler(request('/summary'))).status,503);assert.equal(off.calls.length,0);
});

test('mounted summary rejects unsupported method with405 instead of suggesting a retryable outage',async()=>{
 const f=fixture(),r=await f.handler(request('/summary','POST'));assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET');assert.equal(f.calls.length,0);
});
test('qualified collection prepares native access on same borrowed transaction before the filtered SQL page',async()=>{
 const f=fixture(),r=await f.handler(request('?limit=1&q=encanto&status=received&priority=normal'));assert.equal(r.status,200);assert.deepEqual(await r.json(),{items:[],next_cursor:null});
 const prepare=f.calls.findIndex(x=>x.sql.includes('cg_local_prepare_ticket_collection')),list=f.calls.findIndex(x=>x.sql.includes('from helpdesk_core.tickets'));
 assert.ok(prepare>=0&&prepare<list);assert.equal(f.calls.filter(x=>x.sql==='BEGIN').length,1);assert.equal(f.calls.filter(x=>x.sql==='COMMIT').length,1);
 const statement=f.calls[list]!;assert.ok(statement.sql.indexOf('jsonb_array_elements')<statement.sql.indexOf('($3::timestamptz'));assert.ok(statement.sql.includes('cg_local_ticket_directory(tickets.id)'));
 assert.equal(statement.args?.[12],JSON.stringify(f.contexts));assert.equal(statement.args?.[5],'encanto');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('generic ticket POST remains closed with no SQL even when collection GET is configured',async()=>{const f=fixture(),r=await f.handler(request('','POST'));assert.equal(r.status,503);assert.equal(f.calls.length,0);});
test('unknown, repeated and forged collection selectors never dispatch SQL',async()=>{
 for(const query of ['?refs=A','?limit=1&limit=2','?account_id=not-a-uuid','?limit=0']){const f=fixture(),r=await f.handler(request(query));assert.equal(r.status,400);assert.ok(!f.calls.some(x=>x.sql.includes('from helpdesk_core.tickets')));}
});
test('malformed native namespace result rolls back before paging instead of giving unrestricted access',async()=>{
 for(const value of [null,{},[{accountId:id(3)}],[{accountId:id(3),productInstanceId:id(4),connectionId:id(5),tenantId:'mrv',authority:true}]]){const f=fixture();f.state.invalid=value;const r=await f.handler(request());assert.equal(r.status,503);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));assert.ok(!f.calls.some(x=>x.sql.includes('from helpdesk_core.tickets')));}
});
test('empty native coverage still executes a restrictive local namespace predicate',async()=>{const f=fixture();f.state.invalid=[];const r=await f.handler(request());assert.equal(r.status,200);assert.equal(f.calls.find(x=>x.sql.includes('from helpdesk_core.tickets'))?.args?.[12],'[]');});
test('cancel during native preparation rolls back and never executes page SQL',async()=>{
 const f=fixture(),controller=new AbortController();f.state.abort=()=>controller.abort();const r=await f.handler(request('','GET',controller.signal));assert.equal(r.status,409);assert.ok(f.calls.some(x=>x.sql==='ROLLBACK'));assert.ok(!f.calls.some(x=>x.sql.includes('from helpdesk_core.tickets')));
});
test('local borrowed get projects actual bounded protocol/profile/requester metadata and rejects corrupt native summary',async()=>{
 const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[],scopes:['tickets:read']};
 const summary={protocol:'CG-10001',profileVersionId:'cg-wf-'+id(10)+'-v1',workflow:true,requesterId:id(2)},calls:string[]=[];
 let metadata:unknown=summary;
 const row={id:id(6),workspace_id:p.workspaceId,account_id:id(3),product_instance_id:id(4),service_code:'SUPPORT',created_by:p.id,assigned_to:null,subject:'Residencial Encanto',description:'Native summary',status:'new',priority:'normal',version:1,coverage_id:id(8),contract_version_id:id(9),contract_snapshot:{contractId:id(9),version:1,policy:{}},created_at:'2026-10-14T12:00:00.123456Z',updated_at:'2026-10-14T12:00:00.123456Z'};
 const pool:SqlPool={query:async()=>{throw Error();},end:async()=>{},connect:async()=>({release(){},async query(sql){calls.push(sql);return {command:['BEGIN','COMMIT','ROLLBACK'].includes(sql)?sql:'SELECT',rowCount:1,rows:[{...row,consultegeo_summary:metadata}]};}})};
 const get=()=>runTransaction(pool,p,c=>new HelpdeskService((createBorrowedPostgresUnitOfWork as any)(c,p,{consulteGeoLocal:true})).get(p,id(6)));
 const result=await get();assert.deepEqual((result as any).consulteGeo,summary);assert.ok(calls.some(sql=>sql.includes('cg_local_ticket_summary(tickets.id)')));
 for(const value of [{...summary,workflow:false},{...summary,requesterId:'foreign'},{...summary,protocol:'legacy-10001'},{...summary,internalNote:'secret'}]){metadata=value;await assert.rejects(get(),{code:'invalid_database_result'});assert.equal(calls.at(-1),'ROLLBACK');}
 metadata=null;assert.equal(Object.hasOwn(await get(),'consulteGeo'),false);
});
