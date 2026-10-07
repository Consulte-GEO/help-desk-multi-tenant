/** Registered by rls.test.ts after its fresh-local-database guard. Never a standalone runner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {runHostedWriteAcceptance} from '../../scripts/hosted-write-acceptance-core.ts';
import type {HostedWriteFixture,WriteReport} from '../../scripts/hosted-write-acceptance-core.ts';
import type {HostedFixture,HostedTokens} from '../../scripts/hosted-acceptance-core.ts';
import {createHttpHandler} from '../../src/http/handler.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {createAuthentication} from '../../src/infrastructure/authentication.ts';
import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import {withControlTransactions} from '../../src/infrastructure/transaction.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {secretHash,canonicalJson} from '../../src/domain/canonical.ts';
import {readWorkspaceEffects,assertNoWorkspaceEffects,effectCollections,assertReceiptMatchesWrite} from '../../tests/fixtures/postgres-acceptance-effects.ts';
import type {EffectSnapshot,EffectRow} from '../../tests/fixtures/postgres-acceptance-effects.ts';

type FixtureContext={admin:SqlPool;app:SqlPool};
type Actor=keyof HostedTokens;
type AcceptedMutation={key:string;requestId:string;actorId:string;kind:string;ticketId:string;expectedReceipt:EffectRow};
function ok(value:unknown,message:string):asserts value {assert.ok(value,message);}
const rowsFor=(rows:EffectRow[],ticketId:string)=>rows.filter(r=>r.ticket_id===ticketId);
const jsonEqual=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const jwt=(uid:string)=>`${Buffer.from('{"alg":"TEST"}').toString('base64url')}.${Buffer.from(JSON.stringify({role:'authenticated',sub:uid})).toString('base64url')}.synthetic`;

async function fixture({admin,app}:FixtureContext){
 // Re-check opt-in and loopback targets before the first fixture write; credentials are not logged.
 validateDatabaseTestTargets(process.env);
 await assertSafeDatabaseRole(app);
 const account=()=>({accountId:randomUUID(),requesterId:randomUUID(),productInstanceId:randomUUID(),ticketId:randomUUID(),serviceCode:'SUPPORT'});
 const config:HostedFixture={schema:1,environment:'production',origin:'https://'+'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app',
  supabaseUrl:'https://'+'a'.repeat(20)+'.supabase.co',deploymentCommit:'b'.repeat(40),workspaceId:randomUUID(),deniedWorkspaceId:randomUUID(),
  agentId:randomUUID(),integrationId:randomUUID(),accountA:account(),accountB:account(),machineTicketId:randomUUID(),machinePublicMessageId:randomUUID(),
  internalNoteId:randomUUID(),internalNoteMarker:'HD_TEST_INTERNAL_'+randomBytes(12).toString('hex'),publicMessageId:randomUUID()};
 const a=config.accountA,b=config.accountB,w=config.workspaceId;
 const authIds={requesterA:randomUUID(),requesterB:randomUUID(),agentA:randomUUID()};
 const tokens:HostedTokens={requesterA:jwt(authIds.requesterA),requesterB:jwt(authIds.requesterB),agentA:jwt(authIds.agentA),machineA:''};
 const principalIds:Record<Actor,string>={requesterA:a.requesterId,requesterB:b.requesterId,agentA:config.agentId,machineA:config.integrationId};
 const scopes=['contexts:resolve','tickets:read','tickets:write'];
 await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'SQL acceptance workspace')",[w]);
 const contracts:{id:string;versionId:string;coverageId:string;policy:Record<string,unknown>}[]=[];
 for(const [index,current] of [a,b].entries()){
  const productId=randomUUID(),contract={id:randomUUID(),versionId:randomUUID(),coverageId:randomUUID(),policy:{acceptance:'private-snapshot',index}};
  contracts.push(contract);
  await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'Synthetic account')",[w,current.accountId]);
  await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'Synthetic product')",[w,productId,'TEST'+index]);
  await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'production')",[w,productId,current.productInstanceId]);
  await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,productId]);
  await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Synthetic contract')",[w,contract.id]);
  await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01T00:00:00Z',$4::jsonb)",[w,contract.id,contract.versionId,JSON.stringify(contract.policy)]);
  await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,current.accountId,productId,current.productInstanceId,contract.versionId,contract.coverageId]);
 }
 for(const actor of ['requesterA','requesterB','agentA'] as const){
  const principalId=principalIds[actor],accountId=actor==='requesterB'?b.accountId:a.accountId;
  await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[principalId,authIds[actor]]);
  await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[w,accountId,principalId,actor==='agentA'?'agent':'requester']);
  await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,principalId,actor==='agentA'?[...scopes,'notes:read','notes:write']:scopes,'Synthetic SQL acceptance',randomUUID()]);
 }
 const connectionId=randomUUID(),credentialId=randomUUID(),key='hd_key_'+randomBytes(32).toString('base64url');
 await admin.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[config.integrationId]);
 await admin.query('insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)',[w,connectionId,a.productInstanceId,config.integrationId]);
 await admin.query("insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,'synthetic-origin')",[w,connectionId,a.accountId]);
 await admin.query('insert into helpdesk_auth.integration_credentials(id,workspace_id,connection_id,key_hash) values($1,$2,$3,$4)',[credentialId,w,connectionId,secretHash(key)]);
 const identityProvider:typeof fetch=async(input,init)=>{
  const request=new Request(input,init);
  ok(request.url===config.supabaseUrl+'/auth/v1/user'&&request.method==='GET','Unexpected synthetic provider request.');
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  const actor=(['requesterA','requesterB','agentA'] as const).find(name=>tokens[name]===token);
  return new Response(JSON.stringify(actor?{id:authIds[actor]}:{}),{status:actor?200:401,headers:{'content-type':'application/json'}});
 };
 // Human provider is synthetic. All membership and machine-session resolution is real SQL.
 const auth=createAuthentication(withControlTransactions(app),{supabaseUrl:config.supabaseUrl,publishableKey:'sb_publishable_synthetic'},identityProvider);
 tokens.machineA=(await auth.exchangeToken(key)).access_token;
 const asActor=(actor:Actor)=>auth.authenticate(new Request(config.origin+'/v1/me',{headers:{authorization:'Bearer '+tokens[actor],'x-workspace-id':w}}));
 const service=new HelpdeskService(new PostgresUnitOfWork(app));
 for(const [index,current] of [a,b].entries()){
  current.ticketId=(await service.create(await asActor(index===0?'requesterA':'requesterB'),{accountId:current.accountId,productInstanceId:current.productInstanceId,serviceCode:'SUPPORT',subject:'Synthetic prerequisite '+index,description:'Fixture only',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
 }
 config.machineTicketId=(await service.create(await asActor('machineA'),{accountId:a.accountId,productInstanceId:a.productInstanceId,serviceCode:'SUPPORT',subject:'Synthetic machine prerequisite',description:'Fixture only',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
 const agent=await asActor('agentA');
 config.machinePublicMessageId=(await service.addMessage(agent,config.machineTicketId,'Synthetic public prerequisite',randomUUID(),randomUUID())).message.id;
 config.publicMessageId=(await service.addMessage(agent,a.ticketId,'Synthetic public prerequisite',randomUUID(),randomUUID())).message.id;
 config.internalNoteId=(await service.addNote(agent,a.ticketId,config.internalNoteMarker,randomUUID(),randomUUID())).note.id;
 const handler=createHttpHandler({service,authenticate:auth.authenticate,revokeSession:auth.revokeSession,
  publicConfig:{supabaseUrl:config.supabaseUrl,publishableKey:'sb_publishable_synthetic'}});
 const write:HostedWriteFixture={schema:1,readFixture:config,executionId:randomUUID(),coverageId:contracts[0]!.coverageId,includeMachineWrites:true};
 const plan=await runHostedWriteAcceptance(write),accepted:AcceptedMutation[]=[],observations={unchanged:0};
 const baseline=await readWorkspaceEffects(admin,w);
 const send:typeof fetch=async(input,init)=>{
  const req=new Request(input,init),requestCopy=req.clone();
  try{
   const before=await readWorkspaceEffects(admin,w),response=await handler(req);
   const after=await readWorkspaceEffects(admin,w),idempotencyKey=req.headers.get('idempotency-key');
   if(req.method==='GET'||!idempotencyKey||response.status>=400||response.headers.get('idempotency-replayed')==='true'){
    assertNoWorkspaceEffects(before,after);observations.unchanged++;
   }else{
    ok(response.status>=200&&response.status<300,'Unexpected mutating response.');
    const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
    const actor=(Object.keys(tokens) as Actor[]).find(name=>tokens[name]===token);ok(actor,'Unknown test actor.');
    const result=await response.clone().json() as Record<string,unknown>,path=new URL(req.url).pathname;
    const kind=path==='/v1/tickets'?'ticket.created':path.endsWith('/messages')?'message.created':'ticket.priority_changed';
    const ticketId=kind==='message.created'?result.ticket_id:result.id;
    ok(typeof ticketId==='string'&&idempotencyKey!==null,'Invalid acceptance mutation result.');
    const expectedReceipt=await assertReceiptMatchesWrite(after,requestCopy,principalIds[actor],String(result.id));
    accepted.push({key:idempotencyKey,requestId:req.headers.get('x-request-id')!,actorId:principalIds[actor],kind,ticketId,expectedReceipt});
   }
   return response;
  }finally{try{if(requestCopy.body&&!requestCopy.body.locked)void requestCopy.body.cancel().catch(()=>{});}catch{/* Test-only cleanup must not expose request data. */}}
 };
 const run=(fetcher:typeof fetch=send)=>runHostedWriteAcceptance(write,tokens,{execute:true,allowTicketMutations:true,confirmOrigin:config.origin,confirmConfigSha256:plan.config_sha256,fetcher});
 return {config,contracts,tokens,write,plan,baseline,accepted,observations,send,run,read:()=>readWorkspaceEffects(admin,w),
  dispose:()=>auth.revokeSession(tokens.machineA)};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
function approved(report:WriteReport):void {
 ok(report.status==='passed','SQL-backed acceptance did not pass: '+report.checks.filter(c=>c.status==='failed').map(c=>c.id+':'+c.code).join(','));
 ok(report.preflight.checks.length===28&&report.preflight.checks.every(c=>c.status==='passed'),'Read prerequisites incomplete.');
 ok(report.checks.length===43&&report.checks.every(c=>c.status==='passed'),'Write acceptance incomplete.');
 // HTTP reports do not gain database/platform attestations through injected test transport.
 ok(report.transport==='injected'&&!report.postgres_tested&&!report.atomicity_verified&&!report.platform_approved&&!report.operational,'Invalid promotion of HTTP evidence.');
}
export async function correlate(f:Pick<Fixture,'read'|'baseline'|'accepted'|'config'|'contracts'>,report:Pick<WriteReport,'resources'|'machine'>){
 const current=await f.read(),newTicketIds=[report.resources.ticket_id,report.machine?.resources.ticket_id];
 ok(newTicketIds.every(id=>typeof id==='string')&&new Set(newTicketIds).size===2,'Expected two distinct new tickets.');
 const added:Partial<EffectSnapshot>={};
 for(const collection of effectCollections){
  const oldRows=new Set(f.baseline[collection].map(canonicalJson));
  ok(f.baseline[collection].every(row=>current[collection].some(value=>jsonEqual(value,row))),'A prerequisite row changed.');
  added[collection]=current[collection].filter(row=>!oldRows.has(canonicalJson(row)));
 }
 const delta=added as EffectSnapshot;
 for(const [collection,count] of Object.entries({tickets:2,messages:2,notes:0,events:5,outbox:5,receipts:5,audit:0,effects:5}))
  ok(delta[collection as keyof EffectSnapshot].length===count,'Unexpected count for '+collection+'.');
 ok(f.accepted.length===5,'Expected exactly five first executions, excluding all replays.');
 ok(new Set(delta.effects.map(r=>r.transaction_id)).size===5,'Expected five independently committed effect transactions.');
 for(const [index,ticketId] of newTicketIds.entries()){
  const human=index===0,ticket=delta.tickets.find(r=>r.id===ticketId);ok(ticket,'Missing created ticket.');
  const actorId=human?f.config.accountA.requesterId:f.config.integrationId,contract=f.contracts[0]!;
  ok(ticket.created_by===actorId&&ticket.account_id===f.config.accountA.accountId&&ticket.product_instance_id===f.config.accountA.productInstanceId
   &&ticket.version===(human?3:2)&&ticket.priority===(human?'high':'normal')&&ticket.status==='new'&&ticket.coverage_id===contract.coverageId
   &&ticket.contract_version_id===contract.versionId&&jsonEqual(ticket.contract_snapshot,{contractId:contract.id,version:1,policy:contract.policy}),'Invalid private ticket or contract snapshot.');
  const messages=rowsFor(delta.messages,ticketId as string);ok(messages.length===1,'Unexpected conversation count.');
  ok(messages[0]!.actor_id===actorId&&messages[0]!.actor_type===(human?'customer':'integration'),'Message actor differs from authenticated actor.');
 }
 for(const mutation of f.accepted){
  const matches=delta.receipts.filter(r=>r.key===mutation.key&&r.principal_id===mutation.actorId);ok(matches.length===1,'Missing or duplicated receipt.');
  const receipt=matches[0]!;
  ok(jsonEqual(receipt,mutation.expectedReceipt),'Private receipt differs from the verified first write.');
  const operation=mutation.kind==='ticket.created'?'tickets.create':mutation.kind==='message.created'?`messages.create:${mutation.ticketId}`:`priority.change:${mutation.ticketId}`;
  ok(receipt.operation===operation,'Unexpected receipt namespace.');
  const result=receipt.result as Record<string,unknown>,version=mutation.kind==='ticket.created'?1:mutation.kind==='message.created'?2:3;
  ok(result&&typeof result==='object'&&(mutation.kind==='message.created'?result.ticketId===mutation.ticketId:result.id===mutation.ticketId&&result.version===version),'Historical receipt was changed.');
  const effects=delta.effects.filter(r=>r.ticket_id===mutation.ticketId&&r.kind===mutation.kind&&r.actor_id===mutation.actorId);ok(effects.length===1,'Missing or duplicated write effect.');
  const effect=effects[0]!,event=delta.events.find(r=>r.id===effect.event_id),outbox=delta.outbox.find(r=>r.id===effect.event_id);
  ok(effect.applied===true&&effect.ticket_version===version&&event&&outbox,'Incomplete committed effect.');
  ok(event!.ticket_id===mutation.ticketId&&event!.actor_id===mutation.actorId&&event!.type===mutation.kind&&event!.customer_visible===true,'Effect/event mismatch.');
  const payload=outbox!.payload as Record<string,unknown>;
  const eventData=event!.data as Record<string,unknown>,{reason,...publicEffectData}=eventData;
  ok(jsonEqual(publicEffectData,effect.expected_data),'Event differs from recorded write.');
  if(mutation.kind==='message.created')ok(effect.source_id===result.id&&eventData.messageId===result.id,'Message/effect source mismatch.');
  else ok(effect.source_id===null,'Unexpected non-message source.');
  ok(outbox!.ticket_id===mutation.ticketId&&outbox!.type===mutation.kind&&outbox!.request_id===mutation.requestId&&outbox!.dispatched_at===null
   &&payload&&payload.id===event!.id&&jsonEqual(payload.data,{ticket_id:mutation.ticketId,version}),'Outbox/request correlation mismatch.');
  const {time,...minimalPayload}=payload;
  ok(jsonEqual(minimalPayload,{specversion:'1.0',id:event!.id,source:'helpdesk/workspaces/'+f.config.workspaceId,
   type:'com.helpdesk.'+mutation.kind+'.v1',subject:'tickets/'+mutation.ticketId,datacontenttype:'application/json',
   data:{ticket_id:mutation.ticketId,version}}),'Outbox payload contains unexpected data.');
  ok(typeof time==='string'&&Number.isFinite(Date.parse(time))&&Date.parse(time)===Date.parse(String(event!.created_at)),'Outbox/event time mismatch.');
  ok(!canonicalJson(outbox).includes(f.config.internalNoteMarker),'Private note reached outbox.');
 }
 return current;
}

export function registerHostedAcceptanceSqlTests(context:()=>FixtureContext):void {
 test('M1-R17 HTTP acceptance uses restricted PostgreSQL auth and correlates five committed effects; full rerun adds nothing',async()=>{
  const f=await fixture(context());
  try{
   const report=await f.run();approved(report);const first=await correlate(f,report);
   approved(await f.run());assertNoWorkspaceEffects(first,await f.read());
   ok(f.accepted.length===5&&f.observations.unchanged>60,'No-effect controls were not exercised.');
  }finally{await f.dispose();}
 });
 for(const loss of ['create','message','priority','machine:create','machine:message'])test(`M1-R17 lost HTTP response after ${loss} recovers from PostgreSQL receipts without a second effect`,async()=>{
  const f=await fixture(context());let lost=false;
  try{
   const lossKey='hd-accept-write:'+f.write.executionId+':'+loss;
   const interrupted=await f.run(async(input,init)=>{
    const req=new Request(input,init),response=await f.send(req);
    if(!lost&&req.headers.get('idempotency-key')===lossKey&&response.status<300&&response.headers.get('idempotency-replayed')==='false'){
     lost=true;await response.body?.cancel();throw Error('Synthetic lost HTTP acknowledgement after committed handler.');
    }
    return response;
   });
   ok(lost&&interrupted.status==='failed','Lost response scenario did not execute.');
   const failed=interrupted.checks.findIndex(c=>c.status==='failed');ok(failed>=0&&interrupted.checks[failed]!.outcome==='unknown','Unconfirmed HTTP result was not preserved.');
   ok(interrupted.checks.slice(failed+1).every(c=>c.status==='blocked'),'Writes continued after unknown outcome.');
   const report=await f.run();approved(report);await correlate(f,report);
  }finally{await f.dispose();}
 });
}
