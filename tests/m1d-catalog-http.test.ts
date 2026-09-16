import {test} from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';import {HelpdeskError} from '../src/domain/errors.ts';
import {principal,coverage} from './fixtures.ts';
function setup(){const db=new MemoryUnitOfWork({coverages:[coverage()],supportContexts:[{workspaceId:'workspace-a',accountId:'account-a',accountName:'Cliente A',productInstanceId:'geolab-production',productName:'Sistema A',environment:'production',serviceCode:'SUPPORT',serviceName:'Suporte'}]});
 const service=new HelpdeskService(db,()=>new Date('2026-09-16T12:00:00Z'));
 const handler=createHttpHandler({service,authenticate:async req=>{if(!req.headers.has('authorization'))throw new HelpdeskError(401,'unauthorized','Entre para continuar.');return principal();}});return {db,handler};}
const request=(query='',method='GET',auth=true)=>new Request('https://hd.test/v1/support-contexts'+query,{method,headers:auth?{authorization:'Bearer client'}:{}});
test('catalogue HTTP contract is a no-store public projection, not a serialized domain model',async()=>{
 const {handler}=setup();const r=await handler(request());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(r.headers.get('x-request-id'));
 const body=await r.json();assert.deepEqual(body,{items:[{account_id:'account-a',account_name:'Cliente A',product_instance_id:'geolab-production',product_name:'Sistema A',environment:'production',service_code:'SUPPORT',service_name:'Suporte'}],next_cursor:null});
 assert.doesNotMatch(JSON.stringify(body),/policy|workspace|grants|credential|contract_id|firstResponse/);
});
test('catalogue requires an authenticated identity',async()=>{assert.equal((await setup().handler(request('','GET',false))).status,401);});
test('catalogue capability is available independently of administrative CRUD',async()=>{const r=await setup().handler(new Request('https://hd.test/v1/capabilities'));const b=await r.json();assert.equal(b.capabilities.support_catalog,true);assert.equal(b.capabilities.contract_admin,false);});
for(const query of ['?limit=0','?limit=101','?limit=NaN','?limit=1&limit=2','?account_id=','?account_id=account-a&account_id=account-a','?cursor=','?cursor=%25%25%25','?workspace_id=secret','?offset=0'])
 test('catalogue rejects ambiguous or malformed selector '+query,async()=>{assert.equal((await setup().handler(request(query))).status,400);});
test('catalogue rejects an unauthorized known account without metadata',async()=>{const r=await setup().handler(request('?account_id=secret-account'));assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/secret-account|Cliente/);});
for(const method of ['POST','DELETE','PATCH'])test('catalogue is read-only: '+method,async()=>{const r=await setup().handler(request('',method));assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET');});
test('discovery performs no ticket, idempotency, audit or outbox writes',async()=>{const {handler,db}=setup();const before=db.snapshot();assert.equal((await handler(request())).status,200);assert.deepEqual(db.snapshot(),before);});
