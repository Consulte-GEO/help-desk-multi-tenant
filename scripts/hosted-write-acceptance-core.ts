/** Explicit acceptance client. No automatic retry, provisioning, cleanup or release approval. */
import {randomUUID} from 'node:crypto';
import {canonicalJson,requestHash} from '../src/domain/canonical.ts';
import {readIdentityResponse} from '../src/infrastructure/auth-response.ts';
import {runHostedReadAcceptance} from './hosted-acceptance-core.ts';
import type {HostedFixture,HostedTokens,HostedReport} from './hosted-acceptance-core.ts';

type JsonObject=Record<string,unknown>;
export type HostedWriteFixture={schema:1;readFixture:HostedFixture;executionId:string;coverageId:string;includeMachineWrites?:boolean};
type MachineKey='create'|'message'|'deny-account'|'deny-product'|'deny-note'|'deny-priority'|'cannot-write-human'|'cannot-write-machine';
type MachineResult={keys:Record<MachineKey,string>;resources:{ticket_id:string|null;message_id:string|null}};
export type WriteOptions={execute?:boolean;allowTicketMutations?:boolean;confirmOrigin?:string;confirmConfigSha256?:string;fetcher?:typeof fetch};
type Code='ok'|'not_run'|'prerequisite_failed'|'release_gate_closed'|'http_unavailable'|'unsafe_http_response'|'invalid_json_response'|'contract_mismatch'|'unexpected_status'|'privacy_violation'|'idempotency_expired';
type Outcome='not_applicable'|'not_attempted'|'unknown'|'confirmed'|'rejected';
export type WriteCheck={id:string;status:'not_run'|'passed'|'failed'|'blocked';code:Code;request_id:string|null;http_status:number|null;idempotency_key:string|null;outcome:Outcome;replayed:boolean|null};
export type WriteReport={schema:1;scope:'hosted-write-acceptance';run_id:string;execution_id:string;origin:string;config_sha256:string;
 declared_deployment_commit:string;deployment_commit_verified:false;status:'planned'|'passed'|'failed'|'blocked';transport:'none'|'injected'|'https';
 started_at:string;completed_at:string;platform_approved:false;operational:false;postgres_tested:false;atomicity_verified:false;
 contract_snapshot_verified:false;outbox_delivery_tested:false;browser_tested:false;restore_tested:false;
 machine?:MachineResult;keys:{create:string;message:string;priority:string;stale:string};resources:{ticket_id:string|null;message_id:string|null};preflight:HostedReport;checks:WriteCheck[]};
class CheckFailure extends Error {readonly code:Code;constructor(code:Code){super('Verificação de gravação não aprovada.');this.code=code;}}
const isObject=(v:unknown):v is JsonObject=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const exact=(v:JsonObject,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function requireCheck(ok:unknown,code:Code='contract_mismatch'):asserts ok {if(!ok)throw new CheckFailure(code);}
function object(v:unknown):JsonObject {requireCheck(isObject(v));return v;}
function invalid():never {throw Error('Configuração ou confirmação de gravação inválida.');}
const steps=['write-scope-requester','write-scope-agent','resolve-coverage','create-ticket','replay-ticket','conflict-ticket',
 'create-message','replay-message','conflict-message','update-priority','replay-priority','stale-version',
 'historical-create-replay','final-ticket','final-messages','final-timeline','isolation-new-ticket','unique-ticket'] as const;
const machineSteps=['machine-write-scope','machine-resolve-coverage','machine-create-ticket','machine-replay-ticket','machine-conflict-ticket',
 'machine-create-message','machine-replay-message','machine-conflict-message','machine-deny-account','machine-deny-product','machine-deny-note',
 'machine-deny-priority','machine-cannot-write-human','requester-cannot-write-machine','machine-historical-create-replay','machine-final-ticket',
 'machine-final-messages','machine-final-timeline','machine-isolation-requester','machine-isolation-account-b','machine-unique-ticket',
 'machine-post-denials-notes','machine-post-denials-human-ticket','machine-post-denials-human-messages','machine-post-denials-human-timeline'] as const;
type Step=typeof steps[number]|typeof machineSteps[number];
type Key=keyof WriteReport['keys'];
const mutationKeys:Partial<Record<Step,Key>>={'create-ticket':'create','replay-ticket':'create','conflict-ticket':'create','create-message':'message',
 'replay-message':'message','conflict-message':'message','update-priority':'priority','replay-priority':'priority','stale-version':'stale','historical-create-replay':'create'};
const machineMutationKeys:Partial<Record<Step,MachineKey>>={'machine-create-ticket':'create','machine-replay-ticket':'create','machine-conflict-ticket':'create',
 'machine-create-message':'message','machine-replay-message':'message','machine-conflict-message':'message','machine-deny-account':'deny-account',
 'machine-deny-product':'deny-product','machine-deny-note':'deny-note','machine-deny-priority':'deny-priority',
 'machine-cannot-write-human':'cannot-write-human','requester-cannot-write-machine':'cannot-write-machine','machine-historical-create-replay':'create'};
const ticketFields=['id','account_id','product_instance_id','service_code','subject','description','status','priority','version','coverage_id','contract_version_id','created_at','updated_at'];
function publicSafety(value:unknown,c:HostedFixture):void {
 const text=JSON.stringify(value);requireCheck(!text.includes(c.internalNoteMarker)&&!text.includes(c.internalNoteId),'privacy_violation');
 const visit=(v:unknown):void=>{if(Array.isArray(v)){v.forEach(visit);return;}if(!isObject(v))return;
  for(const [k,item] of Object.entries(v)){requireCheck(!['internal_notes','internal_note','policy','contract_snapshot','key_hash','secret','authorization'].includes(k),'privacy_violation');visit(item);}};
 visit(value);
}
function page(value:unknown):JsonObject[]{const b=object(value);requireCheck(exact(b,['items','next_cursor'])&&Array.isArray(b.items)&&b.items.length<=100&&b.next_cursor===null);
 const items=b.items.map(object);requireCheck(new Set(items.map(x=>x.id)).size===items.length&&items.every(x=>uuid(x.id)));return items;}

export async function runHostedWriteAcceptance(input:unknown,tokenInput:unknown={},options:WriteOptions={}):Promise<WriteReport>{
 if(!isObject(input)||!exact(input,['schema','readFixture','executionId','coverageId',...(Object.hasOwn(input,'includeMachineWrites')?['includeMachineWrites']:[])])
  ||input.schema!==1||!uuid(input.executionId)||!uuid(input.coverageId)
  ||Object.hasOwn(input,'includeMachineWrites')&&typeof input.includeMachineWrites!=='boolean')invalid();
 // Copy before any await: configuration and token aliases cannot redirect a running operation.
 let c:HostedWriteFixture;try{c=structuredClone(input) as HostedWriteFixture;}catch{invalid();}
 const preflight=await runHostedReadAcceptance(c.readFixture);
 const configHash=requestHash(c),started=new Date().toISOString(),prefix='hd-accept-write:'+c.executionId+':';
 const keys={create:prefix+'create',message:prefix+'message',priority:prefix+'priority',stale:prefix+'stale'};
 // Additional mutation intents are planned only by explicit configuration, hence a new confirmation hash.
 const machineResult:MachineResult|undefined=c.includeMachineWrites?{
  keys:{create:prefix+'machine:create',message:prefix+'machine:message','deny-account':prefix+'machine:deny-account',
   'deny-product':prefix+'machine:deny-product','deny-note':prefix+'machine:deny-note','deny-priority':prefix+'machine:deny-priority',
   'cannot-write-human':prefix+'machine:cannot-write-human','cannot-write-machine':prefix+'machine:cannot-write-machine'},
  resources:{ticket_id:null,message_id:null}}:undefined;
 const flow:readonly Step[]=machineResult?[steps[0],steps[1],machineSteps[0],steps[2],machineSteps[1],...steps.slice(3),...machineSteps.slice(2)]:steps;
 const keyFor=(id:Step):string|null=>mutationKeys[id]?keys[mutationKeys[id]!]:machineMutationKeys[id]?machineResult!.keys[machineMutationKeys[id]!]:null;
 const report:WriteReport={schema:1,scope:'hosted-write-acceptance',run_id:randomUUID(),execution_id:c.executionId,origin:c.readFixture.origin,config_sha256:configHash,
  declared_deployment_commit:c.readFixture.deploymentCommit,deployment_commit_verified:false,status:'planned',transport:'none',started_at:started,completed_at:started,
  platform_approved:false,operational:false,postgres_tested:false,atomicity_verified:false,contract_snapshot_verified:false,outbox_delivery_tested:false,browser_tested:false,restore_tested:false,
  keys,...(machineResult?{machine:machineResult}:{}),resources:{ticket_id:null,message_id:null},preflight,checks:flow.map(id=>({id,status:'not_run',code:'not_run',request_id:null,http_status:null,
   idempotency_key:keyFor(id),outcome:keyFor(id)?'not_attempted':'not_applicable',replayed:null}))};
 if(options.execute!==true)return report;
 if(options.allowTicketMutations!==true||options.confirmOrigin!==c.readFixture.origin||options.confirmConfigSha256!==configHash||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')invalid();
 let tokens:HostedTokens;try{tokens=structuredClone(tokenInput) as HostedTokens;}catch{invalid();}
 const fetcher=options.fetcher;
 report.preflight=await runHostedReadAcceptance(c.readFixture,tokens,{execute:true,confirmOrigin:c.readFixture.origin,...(fetcher?{fetcher}:{})});
 report.transport=fetcher?'injected':'https';
 if(report.preflight.status!=='passed'){
  report.status=report.preflight.status==='blocked'?'blocked':'failed';
  for(const check of report.checks){check.status='blocked';check.code='prerequisite_failed';}
  report.completed_at=new Date().toISOString();return report;
 }
 report.status='passed';const send=fetcher??fetch,a=c.readFixture.accountA;
 const context={account_id:a.accountId,product_instance_id:a.productInstanceId,service_code:a.serviceCode};
 const subject='[ACEITACAO HELPDESK] '+c.executionId,description='Registro sintético de aceitação de gravação. Execução '+c.executionId;
 const createBody={...context,coverage_id:c.coverageId,subject,description,priority:'normal'};
 const messageBody={body:'Mensagem sintética de aceitação. Execução '+c.executionId};
 const priorityBody={priority:'high',reason:'Aceitação técnica sintética '+c.executionId};
 let ticketId='',messageId='',contractVersionId='',createdReceipt='',messageReceipt='',priorityReceipt='';
 // Snapshots are process-local observations, never copied to the report or used as authorization.
 const humanBeforeMachine:{ticket:string|null;messages:string|null;timeline:string|null}={ticket:null,messages:null,timeline:null};
 const unchangedHuman=(kind:keyof typeof humanBeforeMachine,value:unknown,capture:boolean)=>{
  if(!machineResult)return;
  const serialized=canonicalJson(value);
  if(capture)humanBeforeMachine[kind]=serialized;
  else requireCheck(humanBeforeMachine[kind]!==null&&humanBeforeMachine[kind]===serialized);
 };
 const ticketPath=()=>'/v1/tickets/'+ticketId;
 const inspectTicket=(value:unknown,version:number,priority:string,operator=false):JsonObject=>{
  const b=object(value);requireCheck(exact(b,operator?[...ticketFields,'internal_status','assignment']:ticketFields));
  requireCheck(uuid(b.id)&&b.account_id===a.accountId&&b.product_instance_id===a.productInstanceId&&b.service_code===a.serviceCode&&b.subject===subject&&b.description===description
   &&b.status==='received'&&b.version===version&&b.priority===priority&&b.coverage_id===c.coverageId&&b.contract_version_id===contractVersionId
   &&typeof b.created_at==='string'&&Number.isFinite(Date.parse(b.created_at))&&typeof b.updated_at==='string'&&Number.isFinite(Date.parse(b.updated_at)));
  requireCheck(![a.ticketId,c.readFixture.accountB.ticketId,c.readFixture.machineTicketId].includes(b.id));
  if(ticketId)requireCheck(b.id===ticketId);if(operator)requireCheck(b.internal_status==='new'&&isObject(b.assignment));return b;
 };
 const inspectMessage=(value:unknown):JsonObject=>{const b=object(value);requireCheck(exact(b,['id','ticket_id','body','actor_type','created_at'])&&uuid(b.id)&&b.ticket_id===ticketId&&b.body===messageBody.body&&b.actor_type==='customer'&&typeof b.created_at==='string'&&Number.isFinite(Date.parse(b.created_at)));
  if(messageId)requireCheck(b.id===messageId);return b;};
 type RequestPlan={method?:'GET'|'POST'|'PATCH';path:string;actor?:keyof HostedTokens;body?:unknown;match?:string;statuses?:number[];error?:string;inspect:(v:unknown,res:Response,check:WriteCheck)=>void};
 const receipt=(b:unknown,res:Response,check:WriteCheck,kind:'ticket'|'message'|'priority',replayOnly=false)=>{
  const flag=res.headers.get('idempotency-replayed');requireCheck(flag==='true'||flag==='false','unsafe_http_response');
  if(kind==='priority')requireCheck(res.status===200);else requireCheck((res.status===201&&flag==='false')||(res.status===200&&flag==='true'),'unsafe_http_response');
  if(replayOnly)requireCheck(res.status===200&&flag==='true','unsafe_http_response');
  if(kind==='ticket'){
   const dto=inspectTicket(b,1,'normal');requireCheck(res.headers.get('etag')==='"1"'&&res.headers.get('location')==='/v1/tickets/'+dto.id,'unsafe_http_response');
   const serialized=canonicalJson(dto);if(createdReceipt)requireCheck(serialized===createdReceipt);else{createdReceipt=serialized;ticketId=dto.id as string;report.resources.ticket_id=ticketId;}
  }else if(kind==='message'){
   const dto=inspectMessage(b),serialized=canonicalJson(dto);if(messageReceipt)requireCheck(serialized===messageReceipt);else{messageReceipt=serialized;messageId=dto.id as string;report.resources.message_id=messageId;}
  }else{
   const dto=inspectTicket(b,3,'high',true);requireCheck(res.headers.get('etag')==='"3"','unsafe_http_response');const serialized=canonicalJson(dto);
   if(priorityReceipt)requireCheck(serialized===priorityReceipt);else priorityReceipt=serialized;
  }
  check.replayed=flag==='true';
 };
 const inspectCoverage=(v:unknown):string=>{
    const b=object(v);requireCheck(exact(b,['status','candidates'])&&(b.status==='resolved'||b.status==='ambiguous')&&Array.isArray(b.candidates)&&b.candidates.length>0&&b.candidates.length<=100);
    const candidates=b.candidates.map(object);requireCheck((b.status==='resolved'?candidates.length===1:candidates.length>1)&&new Set(candidates.map(x=>x.coverage_id)).size===candidates.length);
    for(const x of candidates)requireCheck(exact(x,['coverage_id','contract_id','contract_version_id','contract_version','valid_until'])&&uuid(x.coverage_id)&&uuid(x.contract_id)&&uuid(x.contract_version_id)&&Number.isSafeInteger(x.contract_version)&&Number(x.contract_version)>0&&(x.valid_until===null||typeof x.valid_until==='string'&&Number.isFinite(Date.parse(x.valid_until))));
    const chosen=candidates.find(x=>x.coverage_id===c.coverageId);requireCheck(chosen);return chosen.contract_version_id as string;
 };
 const machineState={ticketId:'',messageId:'',createdReceipt:'',messageReceipt:'',subject:subject+' M2M',
  description:'Registro sintético de integração. Execução '+c.executionId,messageBody:{body:'Mensagem sintética M2M. Execução '+c.executionId}};
 const machinePath=()=>'/v1/tickets/'+machineState.ticketId;
 const machineBody={...createBody,subject:machineState.subject,description:machineState.description};
 const inspectMachineTicket=(value:unknown,version:number):JsonObject=>{
  const b=object(value);requireCheck(exact(b,ticketFields)&&uuid(b.id)&&b.account_id===a.accountId&&b.product_instance_id===a.productInstanceId
   &&b.service_code===a.serviceCode&&b.subject===machineState.subject&&b.description===machineState.description&&b.status==='received'
   &&b.priority==='normal'&&b.version===version&&b.coverage_id===c.coverageId&&b.contract_version_id===contractVersionId
   &&typeof b.created_at==='string'&&Number.isFinite(Date.parse(b.created_at))&&typeof b.updated_at==='string'&&Number.isFinite(Date.parse(b.updated_at)));
  requireCheck(![a.ticketId,c.readFixture.accountB.ticketId,c.readFixture.machineTicketId,ticketId].includes(b.id));
  if(machineState.ticketId)requireCheck(b.id===machineState.ticketId);return b;
 };
 const inspectMachineMessage=(value:unknown):JsonObject=>{
  const b=object(value);requireCheck(exact(b,['id','ticket_id','body','actor_type','created_at'])&&uuid(b.id)&&b.ticket_id===machineState.ticketId
   &&b.body===machineState.messageBody.body&&b.actor_type==='integration'&&typeof b.created_at==='string'&&Number.isFinite(Date.parse(b.created_at)));
  if(machineState.messageId)requireCheck(b.id===machineState.messageId);return b;
 };
 const machineReceipt=(value:unknown,res:Response,check:WriteCheck,kind:'ticket'|'message',replayOnly=false)=>{
  const flag=res.headers.get('idempotency-replayed');
  requireCheck((res.status===201&&flag==='false')||(res.status===200&&flag==='true'),'unsafe_http_response');
  if(replayOnly)requireCheck(res.status===200&&flag==='true','unsafe_http_response');
  const b=kind==='ticket'?inspectMachineTicket(value,1):inspectMachineMessage(value),serialized=canonicalJson(b);
  if(kind==='ticket'){
   requireCheck(res.headers.get('etag')==='"1"'&&res.headers.get('location')==='/v1/tickets/'+b.id,'unsafe_http_response');
   if(machineState.createdReceipt)requireCheck(serialized===machineState.createdReceipt);
   else{machineState.createdReceipt=serialized;machineState.ticketId=b.id as string;machineResult!.resources.ticket_id=machineState.ticketId;}
  }else{
   if(machineState.messageReceipt)requireCheck(serialized===machineState.messageReceipt);
   else{machineState.messageReceipt=serialized;machineState.messageId=b.id as string;machineResult!.resources.message_id=machineState.messageId;}
  }
  check.replayed=flag==='true';
 };
 const plan=(id:Step):RequestPlan=>{
  switch(id){
   case 'machine-write-scope':return {path:'/v1/me',actor:'machineA',inspect:v=>{
    const b=object(v),scopes=b.scopes;requireCheck(b.id===c.readFixture.integrationId&&b.kind==='integration'&&b.workspace_id===c.readFixture.workspaceId&&b.workspace_role===null
     &&Array.isArray(scopes)&&['contexts:resolve','tickets:read','tickets:write'].every(scope=>scopes.includes(scope))
     &&Array.isArray(b.product_instance_ids)&&b.product_instance_ids.length===1&&b.product_instance_ids[0]===a.productInstanceId
     &&Array.isArray(b.grants)&&b.grants.length===1);
    const g=object(b.grants[0]);requireCheck(g.account_id===a.accountId&&g.role==='requester');
   }};
   case 'machine-resolve-coverage':return {method:'POST',path:'/v1/contexts/resolve',actor:'machineA',body:context,inspect:v=>{requireCheck(inspectCoverage(v)===contractVersionId);}};
   case 'machine-create-ticket':case 'machine-replay-ticket':case 'machine-historical-create-replay':return {method:'POST',path:'/v1/tickets',actor:'machineA',body:machineBody,
    statuses:id==='machine-create-ticket'?[200,201]:[200],inspect:(v,r,ch)=>machineReceipt(v,r,ch,'ticket',id!=='machine-create-ticket')};
   case 'machine-conflict-ticket':return {method:'POST',path:'/v1/tickets',actor:'machineA',body:{...machineBody,subject:machineState.subject+' conflito'},statuses:[409],error:'idempotency_conflict',inspect:()=>{}};
   case 'machine-create-message':case 'machine-replay-message':return {method:'POST',path:machinePath()+'/messages',actor:'machineA',body:machineState.messageBody,
    statuses:id==='machine-create-message'?[200,201]:[200],inspect:(v,r,ch)=>machineReceipt(v,r,ch,'message',id==='machine-replay-message')};
   case 'machine-conflict-message':return {method:'POST',path:machinePath()+'/messages',actor:'machineA',body:{body:machineState.messageBody.body+' conflito'},statuses:[409],error:'idempotency_conflict',inspect:()=>{}};
   case 'machine-deny-account':case 'machine-deny-product':return {method:'POST',path:'/v1/tickets',actor:'machineA',
    body:{...machineBody,...(id==='machine-deny-account'?{account_id:c.readFixture.accountB.accountId}:{product_instance_id:c.readFixture.accountB.productInstanceId})},
    statuses:[404],error:'resource_not_found',inspect:()=>{}};
   case 'machine-deny-note':return {method:'POST',path:machinePath()+'/notes',actor:'machineA',body:{body:'Tentativa sintética de nota M2M proibida.'},statuses:[403],error:'forbidden',inspect:()=>{}};
   case 'machine-deny-priority':return {method:'PATCH',path:machinePath(),actor:'machineA',body:priorityBody,match:'"2"',statuses:[403],error:'forbidden',inspect:()=>{}};
   case 'machine-cannot-write-human':return {method:'POST',path:ticketPath()+'/messages',actor:'machineA',body:machineState.messageBody,statuses:[404],error:'resource_not_found',inspect:()=>{}};
   case 'requester-cannot-write-machine':return {method:'POST',path:machinePath()+'/messages',actor:'requesterA',body:messageBody,statuses:[404],error:'resource_not_found',inspect:()=>{}};
   case 'machine-final-ticket':return {path:machinePath(),actor:'machineA',inspect:(v,r)=>{const {available_actions,...dto}=object(v);requireCheck(isObject(available_actions));inspectMachineTicket(dto,2);requireCheck(r.headers.get('etag')==='"2"','unsafe_http_response');}};
   case 'machine-final-messages':return {path:machinePath()+'/messages?limit=100',actor:'machineA',inspect:v=>{const items=page(v);requireCheck(items.length===1&&canonicalJson(inspectMachineMessage(items[0]))===machineState.messageReceipt);}};
   case 'machine-final-timeline':return {path:machinePath()+'/timeline?limit=100',actor:'machineA',inspect:v=>{
    const items=page(v);requireCheck(items.length===2&&items.every(x=>exact(x,['id','type','created_at','data'])&&exact(object(x.data),[]))
     &&['ticket.created','message.created'].every(t=>items.filter(x=>x.type===t).length===1));
   }};
   case 'machine-post-denials-notes':return {path:machinePath()+'/notes?limit=100',actor:'agentA',inspect:v=>{requireCheck(page(v).length===0);}};
   case 'machine-isolation-requester':case 'machine-isolation-account-b':return {path:machinePath(),actor:id==='machine-isolation-requester'?'requesterA':'requesterB',statuses:[404],error:'resource_not_found',inspect:()=>{}};
   case 'machine-unique-ticket':return {path:'/v1/tickets?account_id='+a.accountId+'&q='+encodeURIComponent(c.executionId)+'&limit=100',actor:'machineA',inspect:v=>{const items=page(v);requireCheck(items.length===1);inspectMachineTicket(items[0],2);}};
   case 'write-scope-requester':case 'write-scope-agent':return {path:'/v1/me',actor:id==='write-scope-agent'?'agentA':'requesterA',inspect:v=>{
    const b=object(v);requireCheck(b.id===(id==='write-scope-agent'?c.readFixture.agentId:a.requesterId)&&b.workspace_id===c.readFixture.workspaceId&&b.kind==='human'&&b.workspace_role===null
     &&Array.isArray(b.scopes)&&b.scopes.includes('tickets:write')&&b.scopes.includes('tickets:read')&&b.scopes.includes('contexts:resolve')
     &&Array.isArray(b.grants)&&b.grants.length===1);
    const g=object(b.grants[0]);requireCheck(g.account_id===a.accountId&&g.role===(id==='write-scope-agent'?'agent':'requester'));
   }};
   case 'resolve-coverage':return {method:'POST',path:'/v1/contexts/resolve',body:context,inspect:v=>{contractVersionId=inspectCoverage(v);}};
   case 'create-ticket':case 'replay-ticket':case 'historical-create-replay':return {method:'POST',path:'/v1/tickets',body:createBody,statuses:id==='create-ticket'?[200,201]:[200],inspect:(v,r,ch)=>receipt(v,r,ch,'ticket',id!=='create-ticket')};
   case 'conflict-ticket':return {method:'POST',path:'/v1/tickets',body:{...createBody,subject:subject+' conflito'},statuses:[409],error:'idempotency_conflict',inspect:()=>{}};
   case 'create-message':case 'replay-message':return {method:'POST',path:ticketPath()+'/messages',body:messageBody,statuses:id==='create-message'?[200,201]:[200],inspect:(v,r,ch)=>receipt(v,r,ch,'message',id==='replay-message')};
   case 'conflict-message':return {method:'POST',path:ticketPath()+'/messages',body:{body:messageBody.body+' conflito'},statuses:[409],error:'idempotency_conflict',inspect:()=>{}};
   case 'update-priority':case 'replay-priority':return {method:'PATCH',path:ticketPath(),actor:'agentA',body:priorityBody,match:'"2"',inspect:(v,r,ch)=>receipt(v,r,ch,'priority',id==='replay-priority')};
   case 'stale-version':return {method:'PATCH',path:ticketPath(),actor:'agentA',body:{...priorityBody,priority:'low'},match:'"2"',statuses:[412],error:'version_conflict',inspect:()=>{}};
   case 'final-ticket':case 'machine-post-denials-human-ticket':return {path:ticketPath(),inspect:(v,r)=>{const {available_actions,...dto}=object(v);requireCheck(isObject(available_actions));inspectTicket(dto,3,'high');requireCheck(r.headers.get('etag')==='"3"','unsafe_http_response');unchangedHuman('ticket',dto,id==='final-ticket');}};
   case 'final-messages':case 'machine-post-denials-human-messages':return {path:ticketPath()+'/messages?limit=100',inspect:v=>{const items=page(v);requireCheck(items.length===1);requireCheck(canonicalJson(inspectMessage(items[0]))===messageReceipt);unchangedHuman('messages',items,id==='final-messages');}};
   case 'final-timeline':case 'machine-post-denials-human-timeline':return {path:ticketPath()+'/timeline?limit=100',inspect:v=>{
    const items=page(v);requireCheck(items.length===3&&items.every(x=>exact(x,['id','type','created_at','data'])));
    requireCheck(['ticket.created','message.created','ticket.priority_changed'].every(t=>items.filter(x=>x.type===t).length===1));
    for(const x of items){const data=object(x.data);if(x.type==='ticket.priority_changed')requireCheck(exact(data,['from','to','version'])&&data.from==='normal'&&data.to==='high'&&data.version===3);else requireCheck(exact(data,[]));}
    unchangedHuman('timeline',items,id==='final-timeline');
   }};
   case 'isolation-new-ticket':return {path:ticketPath(),actor:'requesterB',statuses:[404],error:'resource_not_found',inspect:()=>{}};
   case 'unique-ticket':return {path:'/v1/tickets?account_id='+a.accountId+'&q='+encodeURIComponent(c.executionId)+'&limit=100',inspect:v=>{const items=page(v);requireCheck(items.length===1);inspectTicket(items[0],3,'high');}};
  }
 };
 for(const [index,id] of flow.entries()){
  const check=report.checks[index]!;
  if(report.status!=='passed'){check.status='blocked';check.code='prerequisite_failed';continue;}
  const req=plan(id),requestId=randomUUID(),signal=AbortSignal.timeout(5000);check.request_id=requestId;
  const headers:Record<string,string>={accept:'application/json','x-request-id':requestId,'x-workspace-id':c.readFixture.workspaceId,authorization:'Bearer '+tokens[req.actor??'requesterA']};
  if(req.body!==undefined)headers['content-type']='application/json';if(req.match)headers['if-match']=req.match;
  if(check.idempotency_key){headers['idempotency-key']=check.idempotency_key;check.outcome='unknown';}
  let res:Response|undefined;
  try{
   try{res=await send(c.readFixture.origin+req.path,{method:req.method??'GET',headers,...(req.body!==undefined?{body:JSON.stringify(req.body)}:{}),signal,redirect:'error',credentials:'omit',cache:'no-store'});}catch{throw new CheckFailure('http_unavailable');}
   check.http_status=res.status;
   const contentType=res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
   requireCheck(!res.redirected&&res.status>=200&&!(res.status>=300&&res.status<400)&&contentType===(res.status>=400?'application/problem+json':'application/json')
    &&/(?:^|,)\s*no-store\s*(?:,|$)/i.test(res.headers.get('cache-control')??'')&&res.headers.get('x-content-type-options')==='nosniff'&&res.headers.get('x-request-id')===requestId,'unsafe_http_response');
   let body:unknown;try{body=await readIdentityResponse(res,signal);}catch{throw new CheckFailure('invalid_json_response');}
   publicSafety(body,c.readFixture);
   if(res.status===409&&isObject(body)&&body.status===409&&body.code==='idempotency_expired')throw new CheckFailure('idempotency_expired');
   if(res.status===503&&isObject(body)&&body.code==='release_gate_closed')throw new CheckFailure('release_gate_closed');
   requireCheck((req.statuses??[200]).includes(res.status),'unexpected_status');
   if(req.error){const b=object(body);requireCheck(b.status===res.status&&b.code===req.error);}
   req.inspect(body,res,check);check.status='passed';check.code='ok';
   if(check.idempotency_key)check.outcome=req.error?'rejected':'confirmed';
  }catch(error){check.code=error instanceof CheckFailure?error.code:'contract_mismatch';check.status=check.code==='release_gate_closed'?'blocked':'failed';report.status=check.status;}
  finally{try{if(res?.body&&!res.body.locked)void res.body.cancel().catch(()=>{});}catch{/* Never print provider data. */}}
 }
 report.completed_at=new Date().toISOString();return report;
}
