import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createOpenApiResponseValidator} from '../scripts/openapi-response.ts';
import {createHttpHandler} from '../src/http/handler.ts';import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createConsulteGeoRuntimeHandlers} from '../src/infrastructure/consultegeo-runtime.ts';import {createPostgresLocalConsulteGeoSourcePorts} from '../src/infrastructure/consultegeo-local-source.ts';
import {createSupportWorkflowHttpHandler} from '../src/http/support-workflow.ts';import {HelpdeskError} from '../src/domain/errors.ts';import {principal,coverage} from './fixtures.ts';
const gate=readFile(new URL('../docs/openapi.json',import.meta.url),'utf8').then(JSON.parse).then(createOpenApiResponseValidator);
const origin='https://helpdesk.example.test',id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const input={account_id:'account-a',product_instance_id:'geolab-production',service_code:'SUPPORT',subject:'Contrato de envio',description:'Fixture sem dados reais.',priority:'normal'};
function request(path:string,method='POST',body:unknown={},headers:Record<string,string>={}){return new Request(origin+'/v1'+path,{method,headers:{origin,'content-type':'application/json','idempotency-key':'write-contract-key-0001','if-match':'"1"','x-request-id':id(99),...headers},body:JSON.stringify(body)});}
async function conform(path:string,method:string,r:Response,status:number){
 assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 await (await gate)(path,method,r);const b=await r.json();if(status>=400){assert.equal(b.request_id,r.headers.get('x-request-id'));assert.doesNotMatch(JSON.stringify(b),/PRIVATE_ERROR_SENTINEL/);}return b;
}
function core(){const db=new MemoryUnitOfWork({coverages:[coverage()]});let actor=principal();const service=new HelpdeskService(db,()=>new Date('2026-10-16T18:00:00.000Z'));const handler=createHttpHandler({service,authenticate:async()=>actor});return {db,handler,agent:()=>{actor=principal({id:actor.id,grants:[{accountId:'account-a',role:'agent'}]});}};}
async function create(f:ReturnType<typeof core>){const r=await f.handler(request('/tickets','POST',input)),b=await conform('/tickets','POST',r,201);assert.equal(r.headers.get('etag'),'"'+b.version+'"');assert.equal(r.headers.get('location'),'/v1/tickets/'+b.id);assert.equal(r.headers.get('idempotency-replayed'),'false');return b;}

test('OpenAPI creation and replay preserve the original body, Location and ETag after later changes',async()=>{
 const f=core(),first=await create(f);f.agent();const change=await f.handler(request('/tickets/'+first.id,'PATCH',{priority:'high',reason:'Conferência interna'},{'idempotency-key':'write-change-key-0001'}));await conform('/tickets/{ticket_id}','PATCH',change,200);
 const r=await f.handler(request('/tickets','POST',input)),again=await conform('/tickets','POST',r,200);
 assert.equal(again.id,first.id);assert.equal(again.version,1);assert.equal(r.headers.get('etag'),'"1"');assert.equal(r.headers.get('location'),'/v1/tickets/'+first.id);assert.equal(r.headers.get('idempotency-replayed'),'true');assert.equal(f.db.snapshot().tickets.length,1);
});
test('OpenAPI public messages and private notes preserve201/200 replay and do not leak notes into the public channel',async()=>{
 const f=core(),t=await create(f);f.agent();
 for(const [suffix,schema,body] of [['messages','Message','Mensagem pública'],['notes','Note','PRIVATE_NOTE_SENTINEL']] as const){
  const path='/tickets/'+t.id+'/'+suffix,contract='/tickets/{ticket_id}/'+suffix,key='write-'+schema+'-key-0001';
  const first=await f.handler(request(path,'POST',{body},{'idempotency-key':key})),a=await conform(contract,'POST',first,201);assert.equal(first.headers.get('idempotency-replayed'),'false');
  const second=await f.handler(request(path,'POST',{body},{'idempotency-key':key})),b=await conform(contract,'POST',second,200);assert.equal(second.headers.get('idempotency-replayed'),'true');assert.deepEqual(a,b);
 }
 const publicRead=await f.handler(new Request(origin+'/v1/tickets/'+t.id+'/messages'));assert.doesNotMatch(await publicRead.text(),/PRIVATE_NOTE_SENTINEL/);assert.doesNotMatch(JSON.stringify(f.db.snapshot().outbox),/PRIVATE_NOTE_SENTINEL/);
});
test('OpenAPI priority, assignment and transition receipts keep their original version on replay',async()=>{
 for(const [suffix,method,body] of [['','PATCH',{priority:'high',reason:'Conferência interna'}],['/assignments','POST',{action:'claim',reason:'Conferência interna'}],['/transitions','POST',{to:'open',reason:''}]] as const){
  const f=core(),t=await create(f);f.agent();const path='/tickets/'+t.id+suffix,contract='/tickets/{ticket_id}'+suffix;
  const first=await f.handler(request(path,method,body,{'idempotency-key':'write-operation-key-0001'})),a=await conform(contract,method,first,200);assert.equal(first.headers.get('etag'),'"'+a.version+'"');assert.equal(first.headers.get('idempotency-replayed'),'false');
  const second=await f.handler(request(path,method,body,{'idempotency-key':'write-operation-key-0001'})),b=await conform(contract,method,second,200);assert.equal(second.headers.get('idempotency-replayed'),'true');assert.equal(second.headers.get('etag'),'"'+a.version+'"');assert.deepEqual(b,a);
 }
});
test('OpenAPI core writes reject missing/stale versions and bad input without writes or private details',async()=>{
 const f=core(),t=await create(f);f.agent();const before=f.db.snapshot();
 for(const [body,headers,status] of [[{priority:'high',reason:'Conferência'},{'if-match':''},428],[{priority:'high',reason:'Conferência'},{'if-match':'"9"'},412],[{priority:'invalid',reason:'Conferência'},{},400],[{priority:'high',reason:'Conferência'},{'content-type':'text/plain'},415]] as const){const r=await f.handler(request('/tickets/'+t.id,'PATCH',body,headers));await conform('/tickets/{ticket_id}','PATCH',r,status);assert.deepEqual(f.db.snapshot(),before);}
});
const pool={async connect(){throw Error('No SQL before refusal');},async query(){throw Error('No SQL before refusal');},async end(){}};
const operations=[['/tickets/'+id(4)+'/workflow-commands','/tickets/{ticket_id}/workflow-commands','POST'],['/internal/tickets/'+id(4)+'/execution-checklist/marks','/internal/tickets/{ticket_id}/execution-checklist/marks','POST'],['/support-requests','/support-requests','POST'],['/form-drafts/'+id(4),'/form-drafts/{draft_id}','PUT']] as const;
function composed(status=401,enabled=true){let authentication=0,legacy=0;const source=createPostgresLocalConsulteGeoSourcePorts(pool),handler=createConsulteGeoRuntimeHandlers({pool,source:{...source,mode:'local'},origin,
 authentication:{authenticate:async()=>{authentication++;throw new HelpdeskError(status,status===401?'unauthorized':'resource_scope_denied','PRIVATE_ERROR_SENTINEL');},withAdministrativeAssurance:async()=>{throw Error('No administrative flow');}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},
 flags:{business:()=>enabled,workflow:()=>true,intake:()=>true,administration:()=>false,review:()=>false,registrationReview:()=>false,emailMonitoring:()=>false},legacy:async()=>{legacy++;throw Error('No legacy fallback');}});return {handler,counts:()=>({authentication,legacy})};}
for(const [path,contract,method] of operations)test('OpenAPI mounted write problems before SQL or fallback: '+contract,async()=>{
 for(const status of [401,403]){const f=composed(status);await conform(contract,method,await f.handler(request(path,method)),status);assert.deepEqual(f.counts(),{authentication:1,legacy:0});}
});
test('OpenAPI closed operational writes return complete503 problems before Auth/SQL/fallback',async()=>{
 const f=composed(401,false);for(const [path,contract,method] of operations){const b=await conform(contract,method,await f.handler(request(path,method)),503);assert.equal(b.code,'release_gate_closed');}assert.deepEqual(f.counts(),{authentication:0,legacy:0});
});
test('OpenAPI workflow problems preserve version conflicts and uncertain outcome semantics',async()=>{
 for(const [code,status] of [['workflow_version_conflict',412],['transaction_outcome_unknown',503],['unexpected_private_code',503]] as const){
  const handler=createSupportWorkflowHttpHandler({origin,enabled:()=>true,authenticate:async()=>principal({id:id(1),workspaceId:id(2)}),rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},directory:{readTicketResources:async()=>[{connectionId:id(6),tenantId:'T',type:'work',id:'A'}]},service:{execute:async()=>{throw Object.assign(Error('PRIVATE_ERROR_SENTINEL'),{code});}}});
  const r=await handler(request('/tickets/'+id(4)+'/workflow-commands','POST',{action:'start'})),b=await conform('/tickets/{ticket_id}/workflow-commands','POST',r,status);
  assert.equal(b.code,code==='unexpected_private_code'?'workflow_store_unavailable':code);if(code==='transaction_outcome_unknown'){assert.match(b.detail,/mesma chave e conteúdo/);assert.equal(r.headers.get('retry-after'),null);}
 }
});
