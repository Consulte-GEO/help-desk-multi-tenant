import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createOpenApiResponseValidator} from '../scripts/openapi-response.ts';
import {createHttpHandler} from '../src/http/handler.ts';import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';import {HelpdeskError} from '../src/domain/errors.ts';
import {createConsulteGeoRuntimeHandlers} from '../src/infrastructure/consultegeo-runtime.ts';import {createPostgresLocalConsulteGeoSourcePorts} from '../src/infrastructure/consultegeo-local-source.ts';
import {principal,ticket} from './fixtures.ts';
const gate=readFile(new URL('../docs/openapi.json',import.meta.url),'utf8').then(JSON.parse).then(createOpenApiResponseValidator);
const at='2026-10-16T16:00:00.123Z',correlation='10000000-0000-4000-8000-000000000001';
const request=(path:string)=>new Request('https://helpdesk.example.test/v1'+path,{headers:{'x-request-id':correlation}});
async function conform(path:string,response:Response,status=200){
 assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 await (await gate)(path,'GET',response);return response.json();
}
function fixture(options:{operator?:boolean;totals?:boolean;authenticationOnly?:boolean;error?:number}={}){
 const actor=principal(options.operator?{id:'agent-a',grants:[{accountId:'account-a',role:'agent'}]}:{});
 const t=ticket({status:'waiting_customer',assignedTo:'agent-a',createdAt:at,updatedAt:at});
 const db=new MemoryUnitOfWork({tickets:[t,ticket({id:'second',createdAt:at,updatedAt:at}),ticket({id:'hidden-account',accountId:'other',createdAt:at,updatedAt:at})],
  messages:[{id:'message-a',ticketId:t.id,workspaceId:t.workspaceId,accountId:t.accountId,actorId:'person-a',actorType:'customer',body:'Public fixture',createdAt:at}],
  notes:[{id:'note-a',ticketId:t.id,workspaceId:t.workspaceId,accountId:t.accountId,actorId:'agent-a',body:'PRIVATE_NOTE_SENTINEL',createdAt:at}],
  events:[{id:'event-a',ticketId:t.id,workspaceId:t.workspaceId,accountId:t.accountId,actorId:'agent-a',type:'ticket.status_changed',customerVisible:true,createdAt:at,data:{from:'open',to:'waiting_customer',reason:'PRIVATE_REASON_SENTINEL'}}]});
 const service=new HelpdeskService(db,()=>new Date(at));
 const authenticate=async()=>{if(options.error)throw new HelpdeskError(options.error,options.error===401?'unauthorized':'forbidden','Safe fixture refusal.');return actor;};
 const handler=createHttpHandler({service,authenticate,ticketTotals:options.totals!==false,authenticationOnly:options.authenticationOnly,publicConfig:{supabaseUrl:'https://auth.example.test',publishableKey:'public-fixture'}});
 return {handler,authenticate};
}
test('OpenAPI validates core public responses, identity and authentication-only release boundary',async()=>{
 for(const authenticationOnly of [false,true]){const {handler}=fixture({authenticationOnly});for(const path of ['/capabilities','/public-config','/me'])await conform(path,await handler(request(path)));
  const caps=await (await handler(request('/capabilities'))).json();assert.equal(caps.capabilities.tickets,!authenticationOnly);assert.equal(caps.capabilities.ticket_totals,!authenticationOnly);
  if(authenticationOnly)await conform('/tickets',await handler(request('/tickets')),503);
 }
});
test('OpenAPI validates populated ticket reads, complete totals and public/internal projections',async()=>{
 for(const operator of [false,true]){const {handler}=fixture({operator});
  const list=await conform('/tickets',await handler(request('/tickets?limit=1')));assert.equal(list.items.length,1);assert.ok(list.next_cursor);
  const summary=await conform('/tickets/summary',await handler(request('/tickets/summary')));assert.equal(summary.total,2);assert.equal(Object.values(summary.statuses).reduce((a:any,b:any)=>a+b,0),2);
  const detail=await conform('/tickets/{ticket_id}',await handler(request('/tickets/ticket-a')));assert.equal(Object.hasOwn(detail,'internal_status'),operator);assert.equal(Object.hasOwn(detail,'assignment'),operator);
  const messages=await conform('/tickets/{ticket_id}/messages',await handler(request('/tickets/ticket-a/messages')));assert.equal(messages.items.length,1);assert.doesNotMatch(JSON.stringify(messages),/PRIVATE_/);
  const events=await conform('/tickets/{ticket_id}/timeline',await handler(request('/tickets/ticket-a/timeline')));assert.equal(events.items.length,1);if(!operator)assert.doesNotMatch(JSON.stringify(events),/PRIVATE_/);
  const notes=await conform('/tickets/{ticket_id}/notes',await handler(request('/tickets/ticket-a/notes')),operator?200:403);if(operator)assert.equal(notes.items[0].body,'PRIVATE_NOTE_SENTINEL');
 }
});
test('OpenAPI validates safe401/403/404/400/405/503 problems and correlation in core reads',async()=>{
 const cases=[{options:{error:401},path:'/me',schema:'/me',status:401},{options:{error:403},path:'/tickets',schema:'/tickets',status:403},{options:{},path:'/tickets/missing',schema:'/tickets/{ticket_id}',status:404},{options:{},path:'/tickets/summary?status=private',schema:'/tickets/summary',status:400},{options:{totals:false},path:'/tickets/summary',schema:'/tickets/summary',status:503}];
 for(const c of cases){const r=await fixture(c.options).handler(request(c.path)),body=await conform(c.schema,r,c.status);assert.equal(body.request_id,correlation);assert.equal(r.headers.get('x-request-id'),correlation);}
 const r=await fixture().handler(new Request('https://helpdesk.example.test/v1/tickets/summary',{method:'POST',headers:{'x-request-id':correlation}}));assert.equal(r.status,405);await (await gate)('/tickets/summary','GET',r);
});
const pool={async connect(){throw Error('Public/closed routes must not use SQL');},async query(){throw Error('Public/closed routes must not use SQL');},async end(){}};
function composed(local:boolean,business=true,workflow=true,intake=true,email=true,authenticationFailure?:number){
 let authentication=0,legacyCalls=0;const f=fixture({authenticationOnly:!business});
 const authenticate=async()=>{authentication++;if(authenticationFailure)throw new HelpdeskError(authenticationFailure,authenticationFailure===401?'unauthorized':'forbidden','Private auth details must not be returned.');throw Error('No auth on public/closed routes');};
 const runtime=createConsulteGeoRuntimeHandlers({pool,origin:'https://helpdesk.example.test',source:local?{...createPostgresLocalConsulteGeoSourcePorts(pool),mode:'local'}:undefined,
  authentication:{authenticate,withAdministrativeAssurance:async()=>{throw Error('No MFA');}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},emailCursorKey:new Uint8Array(32),
  flags:{business:()=>business,workflow:()=>workflow,administration:()=>false,intake:()=>intake,review:()=>false,emailMonitoring:()=>email,registrationReview:()=>false},legacy:async(req,context)=>{legacyCalls++;return f.handler(req,context);}});
 return {runtime,counts:()=>({authentication,legacyCalls})};
}
test('OpenAPI validates public config and capabilities from the real composed factories without SQL/Auth',async()=>{
 for(const args of [[true,true,true,true,true],[true,true,true,false,false],[true,true,false,true,true],[true,false,true,true,true],[false,true,true,true,true]] as const){const f=composed(args[0],args[1],args[2],args[3],args[4]);
  const caps=await conform('/capabilities',await f.runtime(request('/capabilities'))),config=await conform('/public-config',await f.runtime(request('/public-config'))),ready=args[0]&&args[1]&&args[2];
  assert.equal(caps.capabilities.ticket_totals,ready);assert.equal(config.ticket_totals,ready);assert.equal(caps.capabilities.email_monitoring,ready&&args[4]);assert.equal(config.email_monitoring,ready&&args[4]);
  assert.equal(config.consultegeo_intake,ready&&args[3]);assert.equal(config.consultegeo_review,false);assert.equal(caps.capabilities.support_review,false);assert.deepEqual(f.counts(),{authentication:0,legacyCalls:2});
 }
});
test('OpenAPI validates composed unavailable ticket reads without falling back or inventing authority',async()=>{
 const f=composed(false);for(const [path,schema] of [['/tickets','/tickets'],['/tickets/summary','/tickets/summary'],['/tickets/ticket-a','/tickets/{ticket_id}']] as const){
  const response=await f.runtime(request(path)),body=await conform(schema,response,503);assert.equal(body.code,'release_gate_closed');assert.equal(body.request_id,correlation);assert.equal(response.headers.get('x-request-id'),correlation);assert.equal(response.headers.get('retry-after'),'2');
 }
 const invalid=request('/tickets');invalid.headers.set('x-request-id','PRIVATE_CORRELATION_SENTINEL');const rejected=await f.runtime(invalid),safe=await conform('/tickets',rejected,503);assert.equal(safe.request_id,rejected.headers.get('x-request-id'));assert.match(safe.request_id,/^[a-f0-9-]{36}$/);assert.doesNotMatch(JSON.stringify(safe),/PRIVATE_CORRELATION_SENTINEL/);
 assert.deepEqual(f.counts(),{authentication:0,legacyCalls:0});
});
test('OpenAPI validates early rate-limit and unexpected-error problems without exposing private data',async()=>{
 let auth=0;const limited=createHttpHandler({service:null as never,authenticate:async()=>{auth++;throw Error('No authentication after rate limit');},rateLimiter:{beforeAuthentication:async()=>{throw Object.assign(new HelpdeskError(429,'rate_limit_exceeded','Limite temporário.'),{retryAfterSeconds:7});},afterAuthentication:async()=>{}}});
 const r=await limited(request('/capabilities'));await conform('/capabilities',r,429);assert.equal(r.headers.get('retry-after'),'7');assert.equal(auth,0);
 const broken=createHttpHandler({service:null as never,authenticate:async()=>{throw Error('PRIVATE_CONNECTION_SECRET');}}),body=await conform('/tickets',await broken(request('/tickets')),500);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_CONNECTION_SECRET/);
});
test('OpenAPI validates refusals from the mounted scoped reader before any database/directory access',async()=>{
 for(const status of [401,403]){const f=composed(true,true,true,true,true,status);
  for(const [path,schema] of [['/tickets','/tickets'],['/tickets/summary','/tickets/summary'],['/tickets/10000000-0000-4000-8000-000000000001','/tickets/{ticket_id}']] as const){
   const response=await f.runtime(request(path)),body=await conform(schema,response,status);assert.equal(body.request_id,response.headers.get('x-request-id'));assert.doesNotMatch(JSON.stringify(body),/Private auth details/);
  }
  assert.deepEqual(f.counts(),{authentication:3,legacyCalls:0});
 }
});
