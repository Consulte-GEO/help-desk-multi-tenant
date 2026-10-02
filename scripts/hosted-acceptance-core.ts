/** Test client for existing HTTP routes. Never provisions, releases or mutates a Help Desk. */
import {createHash,randomUUID} from 'node:crypto';
import {readIdentityResponse} from '../src/infrastructure/auth-response.ts';
import {SHORT_SESSION_PATTERN} from '../src/infrastructure/session-lifecycle.ts';
import {RELEASE} from '../src/version.ts';

type ObjectValue=Record<string,unknown>;
export type HostedAccount={accountId:string;requesterId:string;productInstanceId:string;ticketId:string;serviceCode:string};
export type HostedFixture={schema:1;environment:'homologation';origin:string;supabaseUrl:string;deploymentCommit:string;
 workspaceId:string;deniedWorkspaceId:string;agentId:string;integrationId:string;accountA:HostedAccount;accountB:HostedAccount;
 machineTicketId:string;machinePublicMessageId:string;internalNoteId:string;internalNoteMarker:string;publicMessageId:string};
export type HostedTokens={requesterA:string;requesterB:string;agentA:string;machineA:string};
type Actor=keyof HostedTokens;
type Code='ok'|'not_run'|'prerequisite_failed'|'release_gate_closed'|'http_unavailable'|'unsafe_http_response'
 |'invalid_json_response'|'unexpected_status'|'contract_mismatch'|'fixture_missing'|'privacy_violation';
type CheckStatus='not_run'|'passed'|'failed'|'blocked';
export type HostedCheck={id:string;status:CheckStatus;code:Code;http_status:number|null;request_id:string|null};
export type HostedReport={schema:1;scope:'hosted-read-acceptance';run_id:string;status:'planned'|'passed'|'failed'|'blocked';
 transport:'none'|'injected'|'https';origin:string;declared_deployment_commit:string;deployment_commit_verified:false;
 config_sha256:string;started_at:string;completed_at:string;platform_approved:false;operational:false;
 login_lifecycle_tested:false;m2m_lifecycle_tested:false;browser_tested:false;restore_tested:false;checks:HostedCheck[]};
export type HostedOptions={execute?:boolean;confirmOrigin?:string;fetcher?:typeof fetch};
class CheckFailure extends Error {code:Code;constructor(code:Code){super('Hosted acceptance check failed.');this.code=code;}}
function fail(code:Code):never {throw new CheckFailure(code);}
function requireCheck(condition:unknown,code:Code='contract_mismatch'):asserts condition {if(!condition)fail(code);}
const isObject=(v:unknown):v is ObjectValue=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:ObjectValue,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function invalidConfig():never {throw new Error('Configuração de homologação inválida ou incompatível.');}
/** Return a private copy, so caller mutations cannot redirect an in-progress run. */
function configuration(input:unknown):HostedFixture {
 if(!isObject(input)||!exact(input,['schema','environment','origin','supabaseUrl','deploymentCommit','workspaceId','deniedWorkspaceId',
  'agentId','integrationId','accountA','accountB','machineTicketId','machinePublicMessageId','internalNoteId','internalNoteMarker','publicMessageId']))invalidConfig();
 if(input.schema!==1||input.environment!=='homologation'||typeof input.origin!=='string'
  ||!/^https:\/\/[a-f0-9]{24}--helpdesk-consultegeo\.netlify\.app$/.test(input.origin)
  ||typeof input.supabaseUrl!=='string'||!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(input.supabaseUrl)
  ||typeof input.deploymentCommit!=='string'||!/^[a-f0-9]{40}$/.test(input.deploymentCommit)
  ||typeof input.internalNoteMarker!=='string'||!/^HD_TEST_INTERNAL_[A-Za-z0-9_-]{12,80}$/.test(input.internalNoteMarker))invalidConfig();
 for(const key of ['workspaceId','deniedWorkspaceId','agentId','integrationId','machineTicketId','machinePublicMessageId','internalNoteId','publicMessageId'])if(!uuid(input[key]))invalidConfig();
 const account=(value:unknown):HostedAccount=>{
  if(!isObject(value)||!exact(value,['accountId','requesterId','productInstanceId','ticketId','serviceCode']))invalidConfig();
  for(const key of ['accountId','requesterId','productInstanceId','ticketId'])if(!uuid(value[key]))invalidConfig();
  if(typeof value.serviceCode!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.serviceCode))invalidConfig();
  return {...value} as HostedAccount;
 };
 const a=account(input.accountA),b=account(input.accountB);
 for(const key of ['accountId','requesterId','productInstanceId','ticketId'] as const)if(a[key]===b[key])invalidConfig();
 if(new Set([a.requesterId,b.requesterId,input.agentId,input.integrationId]).size!==4||input.workspaceId===input.deniedWorkspaceId
  ||new Set([a.ticketId,b.ticketId,input.machineTicketId]).size!==3||new Set([input.internalNoteId,input.publicMessageId,input.machinePublicMessageId]).size!==3)invalidConfig();
 return {...input,accountA:a,accountB:b} as HostedFixture;
}
function jwtPayload(token:string):ObjectValue|null {
 if(token.length>8192||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))return null;
 try{const p:unknown=JSON.parse(Buffer.from(token.split('.')[1]!,'base64url').toString('utf8'));return isObject(p)?p:null;}catch{return null;}
}
function credentials(input:unknown):HostedTokens {
 if(!isObject(input)||!exact(input,['requesterA','requesterB','agentA','machineA']))invalidConfig();
 if(!Object.values(input).every(x=>typeof x==='string')||new Set(Object.values(input)).size!==4)invalidConfig();
 for(const actor of ['requesterA','requesterB','agentA']){
  const p=jwtPayload(input[actor] as string);
  // A parsed claim is a rejection check, NEVER proof of authentication or authorization.
  if(!p||p.role!=='authenticated')invalidConfig();
 }
 if(!SHORT_SESSION_PATTERN.test(input.machineA as string))invalidConfig();
 return {...input} as HostedTokens;
}
const object=(v:unknown):ObjectValue=>{requireCheck(isObject(v));return v;};
function page(v:unknown):ObjectValue[] {
 const b=object(v);requireCheck(exact(b,['items','next_cursor'])&&Array.isArray(b.items)&&b.items.length<=100&&b.next_cursor===null,'fixture_missing');
 const items=b.items.map(object);requireCheck(new Set(items.map(i=>i.id??JSON.stringify(i))).size===items.length);
 return items;
}
function publicOnly(v:unknown,c:HostedFixture,capabilityDocument=false):void {
 const serialized=JSON.stringify(v);
 requireCheck(!serialized.includes(c.internalNoteMarker)&&!serialized.includes(c.internalNoteId),'privacy_violation');
 const visit=(x:unknown):void=>{
  if(Array.isArray(x)){for(const child of x)visit(child);return;}
  if(!isObject(x))return;
  for(const [key,child] of Object.entries(x)){
   if(capabilityDocument&&key==='internal_notes'&&typeof child==='boolean')continue;
   requireCheck(!['internal_notes','internal_note','internal_status','contract_snapshot','policy','key_hash','secret','authorization'].includes(key),'privacy_violation');
   visit(child);
  }
 };
 visit(v);
}
type Scenario={id:string;path:string;actor?:Actor|'invalid';workspace?:string;status:number;errorCode?:string;inspect?:(value:unknown)=>void;privateNote?:boolean};
function scenarios(c:HostedFixture):Scenario[] {
 const {accountA:a,accountB:b}=c;
 const machine={...a,ticketId:c.machineTicketId};
 const ticket=(x:HostedAccount)=>'/v1/tickets/'+x.ticketId;
 const identity=(actor:Actor)=>(v:unknown)=>{
  const value=object(v),isB=actor==='requesterB',account=isB?b:a,id=actor==='agentA'?c.agentId:actor==='machineA'?c.integrationId:account.requesterId;
  requireCheck(value.id===id&&value.kind===(actor==='machineA'?'integration':'human')&&value.workspace_id===c.workspaceId
   &&value.workspace_role===null&&Array.isArray(value.grants)&&value.grants.length===1);
  const grant=object(value.grants[0]);requireCheck(grant.account_id===account.accountId&&grant.role===(actor==='agentA'?'agent':'requester'));
  requireCheck(Array.isArray(value.scopes)&&value.scopes.includes('tickets:read')&&value.scopes.includes('contexts:resolve'));
  if(actor==='agentA')requireCheck(value.scopes.includes('notes:read'));
  requireCheck(Array.isArray(value.product_instance_ids));
  requireCheck(actor==='machineA'?value.product_instance_ids.length===1&&value.product_instance_ids[0]===a.productInstanceId:value.product_instance_ids.length===0);
 };
 const inspectTicket=(x:HostedAccount)=>(v:unknown)=>{
  const value=object(v);requireCheck(value.id===x.ticketId&&value.account_id===x.accountId&&value.product_instance_id===x.productInstanceId
   &&value.service_code===x.serviceCode&&Number.isSafeInteger(value.version)&&Number(value.version)>0,'fixture_missing');
 };
 const catalog=(x:HostedAccount)=>(v:unknown)=>{
  const items=page(v);requireCheck(items.length>0&&items.every(i=>i.account_id===x.accountId&&i.product_instance_id===x.productInstanceId
   &&i.service_code===x.serviceCode&&i.environment==='staging'),'fixture_missing');
 };
 const messages=(ticketId:string,messageId:string)=>(v:unknown)=>{
  const items=page(v);requireCheck(items.some(i=>i.id===messageId),'fixture_missing');
  requireCheck(items.every(i=>uuid(i.id)&&i.ticket_id===ticketId&&typeof i.body==='string'&&exact(i,['id','ticket_id','body','actor_type','created_at'])));
 };
 const read=(id:string,path:string,actor:Actor,inspect:Scenario['inspect']):Scenario=>({id,path,actor,status:200,inspect});
 const deny=(id:string,path:string,actor:Actor,status=404,errorCode='resource_not_found'):Scenario=>({id,path,actor,status,errorCode});
 return [
  {id:'public-config',path:'/v1/public-config',status:200,inspect:v=>{
   const b=object(v);requireCheck(exact(b,['supabase_url','publishable_key'])&&b.supabase_url===c.supabaseUrl&&typeof b.publishable_key==='string');
   requireCheck(/^sb_publishable_[A-Za-z0-9_-]+$/.test(b.publishable_key)||jwtPayload(b.publishable_key)?.role==='anon');
  }},
  {id:'capabilities',path:'/v1/capabilities',status:200,inspect:v=>{
   const b=object(v),caps=object(b.capabilities);requireCheck(b.api_version==='v1'&&b.release===RELEASE);
   for(const key of ['tickets','support_catalog','public_messages','internal_notes','ticket_timeline'])requireCheck(caps[key]===true);
  }},
  {id:'anonymous-me',path:'/v1/me',status:401,errorCode:'unauthorized'},
  {id:'invalid-session',path:'/v1/me',actor:'invalid',status:401,errorCode:'unauthorized'},
  ...(['requesterA','requesterB','agentA','machineA'] as const).map(actor=>read('identity-'+actor,'/v1/me',actor,identity(actor))),
  read('ticket-a',ticket(a),'requesterA',inspectTicket(a)),
  read('ticket-b',ticket(b),'requesterB',inspectTicket(b)),
  read('ticket-machine-a',ticket(machine),'machineA',inspectTicket(machine)),
  read('catalog-a','/v1/support-contexts?limit=100','requesterA',catalog(a)),
  read('catalog-b','/v1/support-contexts?limit=100','requesterB',catalog(b)),
  read('catalog-machine-a','/v1/support-contexts?limit=100','machineA',catalog(a)),
  {...read('internal-note-control',ticket(a)+'/notes?limit=100','agentA',v=>{
   const items=page(v);requireCheck(items.some(i=>i.id===c.internalNoteId&&i.ticket_id===a.ticketId&&i.body===c.internalNoteMarker),'fixture_missing');
  }),privateNote:true},
  read('public-messages',ticket(a)+'/messages?limit=100','requesterA',messages(a.ticketId,c.publicMessageId)),
  read('machine-public-messages',ticket(machine)+'/messages?limit=100','machineA',messages(machine.ticketId,c.machinePublicMessageId)),
  read('public-timeline',ticket(a)+'/timeline?limit=100','requesterA',v=>{
   const items=page(v);requireCheck(items.some(i=>i.type==='ticket.created'),'fixture_missing');
   for(const i of items){requireCheck(exact(i,['id','type','created_at','data'])&&uuid(i.id));const data=object(i.data);
    requireCheck(!Object.hasOwn(data,'reason')&&i.type!=='ticket.assignment_changed','privacy_violation');}
  }),
  deny('deny-notes-requester',ticket(a)+'/notes','requesterA',403,'forbidden'),
  deny('deny-notes-machine',ticket(machine)+'/notes','machineA',403,'forbidden'),
  deny('deny-ticket-a-to-b',ticket(b),'requesterA'),
  deny('deny-ticket-b-to-a',ticket(a),'requesterB'),
  deny('deny-ticket-machine-to-b',ticket(b),'machineA'),
  deny('deny-machine-to-human-author',ticket(a),'machineA'),
  deny('deny-human-to-machine-author',ticket(machine),'requesterA'),
  deny('deny-messages-a-to-b',ticket(b)+'/messages','requesterA'),
  deny('deny-timeline-a-to-b',ticket(b)+'/timeline','requesterA'),
  {...deny('deny-workspace','/v1/me','requesterA',403,'membership_required'),workspace:c.deniedWorkspaceId}
 ];
}
/** Only executes when both explicit execution and an exact origin confirmation are present. */
export async function runHostedReadAcceptance(input:unknown,tokenInput:unknown={},options:HostedOptions={}):Promise<HostedReport> {
 const c=configuration(input),plan=scenarios(c),started=new Date().toISOString();
 const report:HostedReport={schema:1,scope:'hosted-read-acceptance',run_id:randomUUID(),status:'planned',transport:'none',origin:c.origin,
  declared_deployment_commit:c.deploymentCommit,deployment_commit_verified:false,
  config_sha256:createHash('sha256').update(JSON.stringify(c)).digest('hex'),started_at:started,completed_at:started,
  platform_approved:false,operational:false,login_lifecycle_tested:false,m2m_lifecycle_tested:false,browser_tested:false,restore_tested:false,
  checks:plan.map(s=>({id:s.id,status:'not_run',code:'not_run',http_status:null,request_id:null}))};
 if(options.execute!==true)return report;
 if(options.confirmOrigin!==c.origin)invalidConfig();
 const tokens=credentials(tokenInput),send=options.fetcher??fetch;
 report.transport=options.fetcher?'injected':'https';report.status='passed';
 for(const [index,scenario] of plan.entries()){
  const check=report.checks[index]!;
  if(report.status!=='passed'){check.status='blocked';check.code='prerequisite_failed';continue;}
  const requestId=randomUUID();check.request_id=requestId;
  const signal=AbortSignal.timeout(5000);let response:Response|undefined;
  try{
   const headers:Record<string,string>={accept:'application/json','x-request-id':requestId};
   if(scenario.actor){headers.authorization='Bearer '+(scenario.actor==='invalid'?'hd_session_invalid':tokens[scenario.actor]);headers['x-workspace-id']=scenario.workspace??c.workspaceId;}
   try{response=await send(c.origin+scenario.path,{method:'GET',headers,signal,redirect:'error',credentials:'omit',cache:'no-store'});}catch{fail('http_unavailable');}
   check.http_status=response.status;
   const contentType=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
   requireCheck(!response.redirected&&response.status>=200&&!(response.status>=300&&response.status<400)
    &&contentType===(response.status>=400?'application/problem+json':'application/json')
    &&/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control')??'')
    &&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('x-request-id')===requestId,'unsafe_http_response');
   let body:unknown;try{body=await readIdentityResponse(response,signal);}catch{fail('invalid_json_response');}
   if(response.status===503&&isObject(body)&&body.code==='release_gate_closed')fail('release_gate_closed');
   if(!scenario.privateNote)publicOnly(body,c,scenario.id==='capabilities');
   requireCheck(response.status===scenario.status,'unexpected_status');
   if(scenario.errorCode){const b=object(body);requireCheck(b.code===scenario.errorCode&&b.status===scenario.status);}
   else scenario.inspect?.(body);
   check.status='passed';check.code='ok';
  }catch(error){
   const code=error instanceof CheckFailure?error.code:'contract_mismatch';
   check.code=code;check.status=code==='release_gate_closed'?'blocked':'failed';report.status=check.status;
  }finally{
   // Headers can be rejected before the bounded JSON reader takes ownership.
   // Do not leave an unread response holding transport resources; never await a broken cancel.
   try{if(response?.body&&!response.body.locked)void response.body.cancel().catch(()=>{});}catch{/* No provider details. */}
  }
 }
 report.completed_at=new Date().toISOString();return report;
}
