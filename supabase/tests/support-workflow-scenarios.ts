import {assertPromotedM05Module} from './m05-promoted-module.ts';
/** M02: only registered by the existing fresh, owned PG17 runner after HDN.
 * No top-level connection, no hosted target, no skip/fallback to memory.
 * New scenarios are WRITTEN, not certified by their presence in this file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Principal} from '../../src/domain/model.ts';
import type {SqlClient,SqlPool} from '../../src/infrastructure/sql.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import {parseExecutionChecklistTemplate} from '../../src/domain/execution-checklist.ts';
import {createPostgresExecutionChecklistStore} from '../../src/infrastructure/execution-checklist-store.ts';
import {createPostgresSupportWorkflowStore,createDurablePostgresSupportWorkflow} from '../../src/infrastructure/support-workflow-store.ts';
import {createResourceAccessResolver} from '../../src/application/resource-access.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';

export function registerSupportWorkflowSqlTests(adminPool:()=>SqlPool){
 test('M02 durable support workflow on restricted PostgreSQL',async suite=>{
  const targets='../../scripts/database-target.ts';
  const {validateDatabaseTestTargets}=await import(targets);
  const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
  assert.equal((await admin.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  await assertPromotedM05Module(admin,'helpdesk_auth.hdn_commit_support_workflow(uuid,jsonb)');
  const pgName='pg',pg=await import(pgName) as {Pool:new(o:Record<string,unknown>)=>SqlPool};
  const pool=new pg.Pool({connectionString:appUrl,max:4,connectionTimeoutMillis:5000});
  try{
   const appPath='../../src/application/helpdesk.ts',postgresPath='../../src/infrastructure/postgres.ts';
   const {HelpdeskService}=await import(appPath),{PostgresUnitOfWork,assertSafeDatabaseRole}=await import(postgresPath);
   await assertSafeDatabaseRole(pool);
   const w=randomUUID(),a=randomUUID(),product=randomUUID(),instance=randomUUID(),contract=randomUUID(),cv=randomUUID(),who=randomUUID(),customer=randomUUID(),analyst=randomUUID(),conn=randomUUID(),binding=randomUUID();
   await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'M02 synthetic')",[w]);
   await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'M02 account')",[w,a]);
   await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'M02 product')",[w,product,product]);
   await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
   await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,product]);
   await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'M02 contract')",[w,contract]);
   await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,cv]);
   await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,product,instance,cv,randomUUID()]);
   const scopes=['tickets:read','tickets:write','notes:read','notes:write'];
   for(const [person,role] of [[who,'agent'],[customer,'requester'],[analyst,'agent']]){
    await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,randomUUID()]);
    await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[w,a,person,role]);
    await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,person,scopes,'M02 owned fixture only',randomUUID()]);
   }
   const p:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'agent'}],scopes};
   const outsider:Principal={...p,id:customer,grants:[{accountId:a,role:'requester'}]};
   const colleague:Principal={...p,id:analyst};
   const service=new HelpdeskService(new PostgresUnitOfWork(pool));
   // Existing tickets are prepared before the source protects this product. Once
   // the connection exists, the generic INSERT is intentionally denied; do not
   // bypass its policy to simulate the still-pending scoped intake/publisher.
   const existing=new Map<string,{tid:string;note:string}[]>();
   for(const [owner,state,count] of [[p,'open',40],[p,'new',4],[outsider,'open',4]] as const){
    const queue:{tid:string;note:string}[]=[];existing.set(owner.id+':'+state,queue);
    for(let i=0;i<count;i++){
     const created=await service.create(owner,{accountId:a,productInstanceId:instance,serviceCode:'SUPPORT',subject:'M02 existing request',description:'Owned synthetic history',priority:'normal'},randomUUID(),randomUUID());
     const tid=created.ticket.id,claimed=await service.changeAssignment(p,tid,'claim',created.ticket.version,'Owned fixture claim',randomUUID(),randomUUID());
     if(state==='open')await service.transition(p,tid,'open',claimed.ticket.version,'Owned fixture start',randomUUID(),randomUUID());
     const note=await service.addNote(p,tid,'Synthetic execution declaration',randomUUID(),randomUUID());queue.push({tid,note:note.note.id});
    }
   }
   await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,conn,instance]);
   await admin.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'M02-Tenant')",[w,a,binding,conn]);
   for(const op of ['tickets.read','tickets.write','notes.read','notes.write'])for(const person of [who,customer,analyst]){
    await admin.query("insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,'M02-A1',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',1)",[w,a,binding,person,op]);
    await admin.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work','A')",[w,a,binding,person,op]);
    await admin.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and operation=$3 and principal_id=$4',[w,binding,op,person]);
    await admin.query(`insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count)
     select workspace_id,account_id,binding_id,principal_id,operation,revision,'M02-B1',source_revision,$5,as_of,expires_at,expected_count
     from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and principal_id=$3 and operation=$4`,[w,binding,person,op,'a'.repeat(64)]);
   }
   const template=parseExecutionChecklistTemplate({schema:1,id:'M02-checklist',version:1,status:'published',items:[{id:'conferir',label:'Conferência sintética',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'}]});
   const reference={id:template.id,version:1,sha256:requestHash(template)};
   const profile={versionId:'M02-P1',status:'published',reopenWindowMicros:'604800000000',executionChecklist:reference};
   await admin.query('insert into helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) values($1,$2,1,$3,$4)',[w,template.id,reference.sha256,template]);
   await admin.query('insert into helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) values($1,$2,$3)',[w,profile.versionId,profile]);
   const sqlNow=async()=>String((await admin.query("select to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as at")).rows[0]?.at);
   const refs=[{connectionId:conn,tenantId:'M02-Tenant',type:'work',id:'A'}];
   // Synthetic source authority bound to real persisted fixture observations. It
   // is not a Novo GEO adapter and is never mounted in the product runtime.
   const makeResolver=(principal:Principal)=>createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:3_600_000_000n,timeoutMs:5000,authority:{async readAccess(q){
    const g=(await admin.query(`select source_revision as rev,
     to_char(as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as start,
     to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as finish
     from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and principal_id=$3 and operation=$4 and active`,[w,binding,principal.id,q.operation])).rows[0];
    if(!g)return null;
    return {principal:structuredClone(principal),operation:q.operation,binding:{id:binding,accountId:a,workspaceId:w,connectionId:conn,tenantId:'M02-Tenant',revision:'M02-B1',active:true},manifestFingerprint:'a'.repeat(64),accessRevision:g.rev,asOf:g.start,expiresAt:g.finish,resources:refs};
   }}});
   const resolver=makeResolver(p);
   async function createTicket(works=['A'],complete=false,owner=p,initialStatus='open',definition=profile){
    const prepared=existing.get(owner.id+':'+initialStatus)?.shift();assert.ok(prepared,'Owned existing ticket fixture exhausted');const {tid,note}=prepared;
    await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,$5)',[w,a,tid,binding,works.length]);
    for(const x of works)await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,a,tid,x]);
    await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tid]);
    await admin.query('insert into helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id,profile_version_id,template_id,template_version,template_sha256) values($1,$2,$3,$4,$5,1,$6)',[w,a,tid,definition.versionId,template.id,reference.sha256]);
    await admin.query("insert into helpdesk_core.hdn_workflow_state(workspace_id,account_id,ticket_id,profile_version_id,approval,last_event_at) select workspace_id,account_id,id,$3,'not_required',updated_at from helpdesk_core.tickets where workspace_id=$1 and id=$2",[w,tid,definition.versionId]);
    if(complete)await runTransaction(pool,p,async c=>{const s=createPostgresExecutionChecklistStore(c),r=await s.read(tid);const cmd={action:'mark' as const,itemId:'conferir',status:'done' as const,expectedTicketVersion:r.context.ticketVersion,expectedChecklistRevision:0,evidenceRefs:['note:'+note],reason:null,acknowledgeRisk:false};await s.mark(tid,cmd,requestHash(cmd),randomUUID(),randomUUID());});
    return tid as string;
   }
   const current=async(tid:string)=>runTransaction(pool,p,c=>createPostgresSupportWorkflowStore(c,p).readTicket(tid));
   async function resolve(tid:string,key=randomUUID(),usedPool=pool){
    const before=await current(tid);assert.ok(before);
    const at=await sqlNow(),flow=createDurablePostgresSupportWorkflow({pool:usedPool,resolver,clock:()=>at});
    return flow.execute(p,tid,refs,{action:'resolve',expectedVersion:before.version,body:'Execução confirmada pela equipe.'},key,randomUUID());
   }
   async function command(tid:string,action:Record<string,unknown>,principal=p,key=randomUUID()){
    const before=await runTransaction(pool,principal,c=>createPostgresSupportWorkflowStore(c,principal).readTicket(tid));assert.ok(before);
    const flow=createDurablePostgresSupportWorkflow({pool,resolver:makeResolver(principal),clock:()=>new Date().toISOString()});
    return flow.execute(principal,tid,refs,{...action,expectedVersion:before.version},key,randomUUID());
   }
   const counts=async(tid:string)=>(await admin.query(`select
    (select count(*) from helpdesk_audit.hdn_workflow_commits where workspace_id=$1 and ticket_id=$2) as ledger,
    (select count(*) from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2) as events,
    (select count(*) from helpdesk_integration.outbox_events where workspace_id=$1 and ticket_id=$2) as outbox,
    (select count(*) from helpdesk_audit.write_effects where workspace_id=$1 and ticket_id=$2) as effects`,[w,tid])).rows;

   await suite.test('M03 triage and start persist their semantic command with one core event',async()=>{const tid=await createTicket(['A'],false,p,'new');await command(tid,{action:'triage'});const r=await command(tid,{action:'start'});assert.equal(r.status,'open');assert.equal((await admin.query('select count(*) as n from helpdesk_audit.hdn_workflow_commits where ticket_id=$1',[tid])).rows[0]?.n,'2');});
   await suite.test('M03 customer return resumes work and preserves the responsible analyst',async()=>{const tid=await createTicket(['A'],false,outsider);await command(tid,{action:'request_customer',body:'Complete os dados.'});const r=await command(tid,{action:'customer_reply',body:'Dados complementados.'},outsider);assert.equal(r.status,'open');assert.equal((await current(tid))?.assignedTo,who);const event=(await admin.query('select public_event from helpdesk_audit.hdn_workflow_commits where event_id=$1',[r.eventId])).rows[0]?.public_event as any;assert.equal(event.body,'Dados complementados.');assert.equal(event.actorKind,'customer');});
   await suite.test('M03 reply and handoff keep public response separate from the private reason',async()=>{const tid=await createTicket();await command(tid,{action:'reply',body:'Recebemos os dados.'});const r=await command(tid,{action:'handoff',target:'internal',reason:'Diagnóstico privado'});assert.equal(r.status,'waiting_internal');const row=(await admin.query('select public_event,audit from helpdesk_audit.hdn_workflow_commits where event_id=$1',[r.eventId])).rows[0] as any;assert.equal(row.public_event.body,undefined);assert.equal(row.audit.reason,'Diagnóstico privado');});
   await suite.test('M03 resolved close and closed reopening preserve solution and history',async()=>{const tid=await createTicket(['A'],true);await resolve(tid);await command(tid,{action:'close'});const r=await command(tid,{action:'reopen',reason:'Problema voltou.'});assert.equal(r.status,'open');assert.equal((await current(tid))?.resolution,'Execução confirmada pela equipe.');});
   await suite.test('M03 transfer requires a live fully scoped colleague and generates no outbox',async()=>{const tid=await createTicket(),before=await counts(tid);const r=await command(tid,{action:'transfer',targetPrincipalId:analyst,reason:'Especialista da equipe'});assert.equal((await current(tid))?.assignedTo,analyst);const after=await counts(tid);assert.equal((after[0] as any).outbox,(before[0] as any).outbox);const event=(await admin.query('select type,customer_visible,data from helpdesk_core.ticket_events where id=$1',[r.eventId])).rows[0] as any;assert.equal(event.type,'ticket.assignment_changed');assert.equal(event.customer_visible,false);assert.equal(event.data.action,'transfer');});
   await suite.test('M03 requester target and missing colleague scope are refused without partial effects',async()=>{const tid=await createTicket(),before=await counts(tid);await assert.rejects(command(tid,{action:'transfer',targetPrincipalId:customer,reason:'Não é operador'}),{code:'workflow_assignee_denied'});assert.deepEqual(await counts(tid),before);await assert.rejects(command(tid,{action:'transfer',targetPrincipalId:randomUUID(),reason:'Pessoa inexistente'}),{code:'workflow_assignee_denied'});assert.deepEqual(await counts(tid),before);});
   await suite.test('M03 old public message path cannot bypass structured approval or state',async()=>{const tid=await createTicket(),before=await counts(tid);await assert.rejects(service.addMessage(p,tid,'Bypass antigo',randomUUID(),randomUUID()));assert.deepEqual(await counts(tid),before);});
   await suite.test('M03 forged approval GUC cannot insert a public message directly',async()=>{const tid=await createTicket(),before=await counts(tid);await assert.rejects(runTransaction(pool,p,async c=>{await c.query("select set_config('app.workflow_approved','true',true)");await c.query("insert into helpdesk_core.ticket_messages(id,workspace_id,account_id,ticket_id,actor_id,actor_type,body) values($1,$2,$3,$4,$5,'human_agent','Bypass direto')",[randomUUID(),w,a,tid,who]);}));assert.deepEqual(await counts(tid),before);});
   await suite.test('M03 requester cannot answer a colleague ticket even with the same work grant',async()=>{const tid=await createTicket(),before=await counts(tid);await assert.rejects(command(tid,{action:'customer_reply',body:'Dados de terceiro'},outsider));assert.deepEqual(await counts(tid),before);});
   await suite.test('M03 pending approval blocks the structured and old reply paths',async()=>{const tid=await createTicket();await admin.query("update helpdesk_core.hdn_workflow_state set approval='pending' where ticket_id=$1",[tid]);const before=await counts(tid);await assert.rejects(command(tid,{action:'reply',body:'Resposta prematura'}),{code:'workflow_approval_required'});await assert.rejects(service.addMessage(p,tid,'Resposta antiga',randomUUID(),randomUUID()));assert.deepEqual(await counts(tid),before);});
   await suite.test('M03 backdated direct reopening cannot bypass the database clock expiry',async()=>{const zero={...profile,versionId:'M03-zero-window',reopenWindowMicros:'0'};await admin.query('insert into helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) values($1,$2,$3)',[w,zero.versionId,zero]);const tid=await createTicket(['A'],true,p,'open',zero);await resolve(tid);await command(tid,{action:'close'});const old=await current(tid);assert.ok(old?.closedAt);const cmd={action:'reopen',expectedVersion:old.version,reason:'Fora da janela'},before=await counts(tid),at=old.closedAt,eventId=randomUUID(),requestId=randomUUID();const result={ticketId:tid,workspaceId:w,accountId:a,actorId:who,profileVersionId:zero.versionId,version:old.version+1,status:'open',eventId,replayed:false};const audit={id:eventId,workspaceId:w,ticketId:tid,actorId:who,requestId,at,action:'reopen',reason:cmd.reason,from:'closed',to:'open',version:old.version+1};const payload={schema:1,profileVersionId:zero.versionId,command:cmd,at,requestId,eventId,key:randomUUID(),hash:requestHash({workspaceId:w,actorId:who,ticketId:tid,command:cmd}),audit,receipt:result};await assert.rejects(runTransaction(pool,p,c=>c.query('select helpdesk_auth.hdn_commit_support_workflow($1,$2)',[tid,payload])),{code:'HDW10'});assert.deepEqual(await counts(tid),before);assert.equal((await current(tid))?.status,'closed');});
   await suite.test('M03 a workspace agent without an account operator grant cannot receive transfer',async()=>{const tid=await createTicket();await admin.query("update helpdesk_auth.account_grants set role='account_manager' where workspace_id=$1 and account_id=$2 and principal_id=$3",[w,a,analyst]);await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[w,analyst]);const before=await counts(tid);try{await assert.rejects(command(tid,{action:'transfer',targetPrincipalId:analyst,reason:'Não opera esta conta'}),{code:'workflow_assignee_denied'});assert.deepEqual(await counts(tid),before);}finally{await admin.query('delete from helpdesk_auth.workspace_memberships where workspace_id=$1 and principal_id=$2',[w,analyst]);await admin.query("update helpdesk_auth.account_grants set role='agent' where workspace_id=$1 and account_id=$2 and principal_id=$3",[w,a,analyst]);}});
   await suite.test('M03 cancellation records the reason privately without resolving the ticket',async()=>{const tid=await createTicket(),r=await command(tid,{action:'cancel',reason:'Solicitação duplicada'});assert.equal(r.status,'cancelled');assert.equal((await current(tid))?.resolution,null);});
   await suite.test('writer and workflow commit with core event effect outbox and bound receipt',async()=>{
    const tid=await createTicket(['A'],true),r=await resolve(tid);
    const saved=await current(tid);assert.equal(saved?.status,'resolved');assert.equal(saved?.resolution,'Execução confirmada pela equipe.');assert.equal(saved?.version,r.version);
    const joined=(await admin.query(`select c.result,c.public_event,c.audit from helpdesk_audit.hdn_workflow_commits c
     join helpdesk_core.ticket_events e on (e.workspace_id,e.id)=(c.workspace_id,c.event_id)
     join helpdesk_integration.outbox_events o on (o.workspace_id,o.id)=(e.workspace_id,e.id)
     join helpdesk_audit.write_effects f on (f.workspace_id,f.event_id)=(e.workspace_id,e.id)
     where c.workspace_id=$1 and c.ticket_id=$2 and f.transaction_id=c.transaction_id`,[w,tid])).rows;
    assert.equal(joined.length,1);assert.deepEqual(joined[0]?.result,r);assert.equal((joined[0]?.public_event as any).body,saved?.resolution);
   });
   await suite.test('raw terminal update cannot bypass a complete checklist',async()=>{
    const tid=await createTicket(['A'],true);const before=await current(tid);
    await assert.rejects(runTransaction(pool,p,c=>c.query("update helpdesk_core.tickets set status='resolved',version=version+1,updated_at=clock_timestamp() where workspace_id=$1 and id=$2",[w,tid])),{code:'HDW03'});
    assert.deepEqual(await current(tid),before);
   });
   await suite.test('GUC claiming approval does not manufacture a private transaction permit',async()=>{
    const tid=await createTicket(['A'],true);
    await assert.rejects(runTransaction(pool,p,async c=>{await c.query("select set_config('app.workflow_approved','true',true)");await c.query("update helpdesk_core.tickets set status='resolved',version=version+1,updated_at=clock_timestamp() where workspace_id=$1 and id=$2",[w,tid]);}),{code:'HDW03'});
   });
   await suite.test('missing required mark refuses resolution without partial effects',async()=>{
    const tid=await createTicket(),before=await counts(tid);await assert.rejects(resolve(tid),{code:'workflow_checklist_required'});assert.deepEqual(await counts(tid),before);assert.equal((await current(tid))?.status,'open');
   });
   await suite.test('current requester C and A+C are denied by private workflow helper',async()=>{
    const tid=await createTicket();await assert.rejects(runTransaction(pool,outsider,c=>createPostgresSupportWorkflowStore(c,outsider).readTicket(tid)),{code:'workflow_forbidden'});
    for(const works of [['C'],['A','C']]){const other=await createTicket(works);await assert.rejects(current(other),{code:'workflow_forbidden'});}
   });
   await suite.test('concurrent resolution of one revision commits at most once',async()=>{
    const tid=await createTicket(['A'],true),before=await current(tid);assert.ok(before);const at=await sqlNow(),flow=createDurablePostgresSupportWorkflow({pool,resolver,clock:()=>at});
    const command={action:'resolve',expectedVersion:before.version,body:'Conferido.'};
    const results=await Promise.allSettled([flow.execute(p,tid,refs,command,randomUUID(),randomUUID()),flow.execute(p,tid,refs,command,randomUUID(),randomUUID())]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.equal(Number((await counts(tid))[0]?.ledger),1);
   });
   await suite.test('same command replays the original receipt and no new public event',async()=>{
    const tid=await createTicket(['A'],true),before=await current(tid);assert.ok(before);const at=await sqlNow(),flow=createDurablePostgresSupportWorkflow({pool,resolver,clock:()=>at}),key=randomUUID(),cmd={action:'resolve',expectedVersion:before.version,body:'Executado.'};
    const first=await flow.execute(p,tid,refs,cmd,key,randomUUID()),saved=await counts(tid),second=await flow.execute(p,tid,refs,cmd,key,randomUUID());
    assert.deepEqual(second,{...first,replayed:true});assert.deepEqual(await counts(tid),saved);
   });
   await suite.test('same idempotency key with different body is a conflict',async()=>{
    const tid=await createTicket(['A'],true),before=await current(tid);assert.ok(before);const at=await sqlNow(),flow=createDurablePostgresSupportWorkflow({pool,resolver,clock:()=>at}),key=randomUUID(),cmd={action:'resolve',expectedVersion:before.version,body:'Texto A'};
    await flow.execute(p,tid,refs,cmd,key,randomUUID());await assert.rejects(flow.execute(p,tid,refs,{...cmd,body:'Texto B'},key,randomUUID()),{code:'workflow_idempotency_conflict'});
   });
   await suite.test('SQL validates intent digest rather than trusting hash supplied by caller',async()=>{
    const tid=await createTicket(['A'],true),before=await current(tid);assert.ok(before);
    const payload={schema:1,profileVersionId:profile.versionId,command:{action:'resolve',expectedVersion:before.version,body:'Texto'},at:await sqlNow(),requestId:randomUUID(),eventId:randomUUID(),key:randomUUID(),hash:'0'.repeat(64),audit:{},receipt:{}};
    await assert.rejects(runTransaction(pool,p,c=>c.query('select helpdesk_auth.hdn_commit_support_workflow($1,$2)',[tid,payload])),{code:'HDW05'});
   });
   await suite.test('private ledger rejects direct app reads and writes',async()=>{
    await assert.rejects(runTransaction(pool,p,c=>c.query('select * from helpdesk_audit.hdn_workflow_commits')),{code:'42501'});
    await assert.rejects(runTransaction(pool,p,c=>c.query('delete from helpdesk_audit.hdn_workflow_commits')),{code:'42501'});
   });
   await suite.test('public core outbox never receives resolution body audit or checklist notes',async()=>{
    const tid=await createTicket(['A'],true),r=await resolve(tid);
    const o=(await admin.query('select payload from helpdesk_integration.outbox_events where workspace_id=$1 and id=$2',[w,r.eventId])).rows[0]?.payload as any;
    assert.deepEqual(Object.keys(o.data).sort(),['ticket_id','version']);assert.equal(JSON.stringify(o).includes('Execução'),false);assert.equal(JSON.stringify(o).includes('executionChecklist'),false);
   });
   await suite.test('suppressed core outbox rolls back workflow state audit receipt and core effects',async()=>{
    const tid=await createTicket(['A'],true),before=await current(tid),prior=await counts(tid);
    await admin.query(`create function helpdesk_auth.m02_test_suppress_outbox() returns trigger language plpgsql as $$begin if NEW.workspace_id::text=TG_ARGV[0] then return null;end if;return NEW;end$$`);
    await admin.query(`create trigger z_m02_test_suppress_outbox before insert on helpdesk_integration.outbox_events for each row execute function helpdesk_auth.m02_test_suppress_outbox('${w}')`);
    try{await assert.rejects(resolve(tid));assert.deepEqual(await current(tid),before);assert.deepEqual(await counts(tid),prior);}
    finally{await admin.query('drop trigger z_m02_test_suppress_outbox on helpdesk_integration.outbox_events');await admin.query('drop function helpdesk_auth.m02_test_suppress_outbox()');}
   });
   await suite.test('successful SQL with corrupted acknowledgement cannot commit after caught validation',async()=>{
    const tid=await createTicket(['A'],true),prior=await current(tid),before=await counts(tid);let executed=0;
    const faulty:SqlPool={async connect(){const c=await pool.connect();return {async query(sql,values){const r=await c.query(sql,values);if(sql.includes('hdn_commit_support_workflow')){assert.equal(r.command,'SELECT');assert.ok((r.rows[0]?.result as any)?.eventId);executed++;return {...r,rows:[{result:{invalid:true}}]};}return r;},release:e=>c.release(e),...(c.on?{on:(event:'error',listener:(e:Error)=>void)=>c.on!(event,listener)}:{})};},query:async()=>assert.fail('No pool.query'),end:async()=>{}};
    await assert.rejects(resolve(tid,randomUUID(),faulty));assert.equal(executed,1);assert.deepEqual(await current(tid),prior);assert.deepEqual(await counts(tid),before);
   });
   await suite.test('JSON canonical subset agrees with application hash on real Unicode and timestamps',async()=>{
    for(const value of [{schema:1,text:'Conferência 🏗️ "A"\n',array:[true,false,null,123]},profile,{at:'2026-10-13T12:00:00.123000Z',id:randomUUID()}]){
     assert.equal((await admin.query('select helpdesk_auth.hdn_workflow_digest($1) as hash',[value])).rows[0]?.hash,requestHash(value));
    }
   });
   await suite.test('published profile and committed receipt remain immutable',async()=>{
    const tid=await createTicket(['A'],true);await resolve(tid);
    await assert.rejects(admin.query("update helpdesk_core.hdn_workflow_profiles set document=document||'{\"reopenWindowMicros\":\"0\"}'::jsonb where workspace_id=$1",[w]),{code:'23514'});
    await assert.rejects(admin.query('delete from helpdesk_audit.hdn_workflow_commits where workspace_id=$1 and ticket_id=$2',[w,tid]),{code:'23514'});
    await assert.rejects(admin.query("update helpdesk_core.hdn_workflow_state set last_event_at=last_event_at-interval '1 second' where workspace_id=$1 and ticket_id=$2",[w,tid]),{code:'23514'});
    await assert.rejects(admin.query('delete from helpdesk_core.hdn_workflow_state where workspace_id=$1 and ticket_id=$2',[w,tid]),{code:'23514'});
   });
  }finally{await pool.end();}
 });
}
