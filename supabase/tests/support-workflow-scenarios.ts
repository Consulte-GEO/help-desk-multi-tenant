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
  const installer=await admin.connect();
  try{
   await installer.query('BEGIN');
   await installer.query("select set_config('app.hdn_workflow_candidate','disposable-pg17',true)");
   await installer.query(await readFile(new URL('../candidates/hdn_support_workflow.sql',import.meta.url),'utf8'));
   await installer.query('COMMIT');
  }catch(error){await installer.query('ROLLBACK');throw error;}finally{installer.release();}
  const pgName='pg',pg=await import(pgName) as {Pool:new(o:Record<string,unknown>)=>SqlPool};
  const pool=new pg.Pool({connectionString:appUrl,max:4,connectionTimeoutMillis:5000});
  try{
   const appPath='../../src/application/helpdesk.ts',postgresPath='../../src/infrastructure/postgres.ts';
   const {HelpdeskService}=await import(appPath),{PostgresUnitOfWork,assertSafeDatabaseRole}=await import(postgresPath);
   await assertSafeDatabaseRole(pool);
   const w=randomUUID(),a=randomUUID(),product=randomUUID(),instance=randomUUID(),contract=randomUUID(),cv=randomUUID(),who=randomUUID(),customer=randomUUID(),conn=randomUUID(),binding=randomUUID();
   await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'M02 synthetic')",[w]);
   await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'M02 account')",[w,a]);
   await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'M02 product')",[w,product,product]);
   await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
   await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,product]);
   await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'M02 contract')",[w,contract]);
   await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,cv]);
   await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,product,instance,cv,randomUUID()]);
   const scopes=['tickets:read','tickets:write','notes:read','notes:write'];
   for(const [person,role] of [[who,'agent'],[customer,'requester']]){
    await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,randomUUID()]);
    await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[w,a,person,role]);
    await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,person,scopes,'M02 owned fixture only',randomUUID()]);
   }
   const p:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'agent'}],scopes};
   const outsider:Principal={...p,id:customer,grants:[{accountId:a,role:'requester'}]};
   const service=new HelpdeskService(new PostgresUnitOfWork(pool));
   await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,conn,instance]);
   await admin.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'M02-Tenant')",[w,a,binding,conn]);
   for(const op of ['tickets.read','tickets.write','notes.read','notes.write']){
    await admin.query("insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,'M02-A1',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',1)",[w,a,binding,who,op]);
    await admin.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work','A')",[w,a,binding,who,op]);
    await admin.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and operation=$3',[w,binding,op]);
    await admin.query(`insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count)
     select workspace_id,account_id,binding_id,principal_id,operation,revision,'M02-B1',source_revision,$5,as_of,expires_at,expected_count
     from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and principal_id=$3 and operation=$4`,[w,binding,who,op,'a'.repeat(64)]);
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
   const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:3_600_000_000n,timeoutMs:5000,authority:{async readAccess(q){
    const g=(await admin.query(`select source_revision as rev,
     to_char(as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as start,
     to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as finish
     from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and principal_id=$3 and operation=$4 and active`,[w,binding,p.id,q.operation])).rows[0];
    if(!g)return null;
    return {principal:structuredClone(p),operation:q.operation,binding:{id:binding,accountId:a,workspaceId:w,connectionId:conn,tenantId:'M02-Tenant',revision:'M02-B1',active:true},manifestFingerprint:'a'.repeat(64),accessRevision:g.rev,asOf:g.start,expiresAt:g.finish,resources:refs};
   }}});
   async function createTicket(works=['A'],complete=false){
    const created=await service.create(p,{accountId:a,productInstanceId:instance,serviceCode:'SUPPORT',subject:'M02 user request',description:'Synthetic request',priority:'normal'},randomUUID(),randomUUID());
    const tid=created.ticket.id,current=await service.get(p,tid);
    const claimed=await service.changeAssignment(p,tid,'claim',current.version,'M02 fixture claim',randomUUID(),randomUUID());
    await service.transition(p,tid,'open',claimed.ticket.version,'M02 fixture start',randomUUID(),randomUUID());
    await service.addNote(p,tid,'M02 internal execution declaration',randomUUID(),randomUUID());
    const note=String((await admin.query('select id from helpdesk_core.internal_notes where workspace_id=$1 and ticket_id=$2',[w,tid])).rows[0]?.id);
    await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,$5)',[w,a,tid,binding,works.length]);
    for(const x of works)await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,a,tid,x]);
    await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tid]);
    await admin.query('insert into helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id,profile_version_id,template_id,template_version,template_sha256) values($1,$2,$3,$4,$5,1,$6)',[w,a,tid,profile.versionId,template.id,reference.sha256]);
    await admin.query("insert into helpdesk_core.hdn_workflow_state(workspace_id,account_id,ticket_id,profile_version_id,approval,last_event_at) select workspace_id,account_id,id,$3,'not_required',updated_at from helpdesk_core.tickets where workspace_id=$1 and id=$2",[w,tid,profile.versionId]);
    if(complete)await runTransaction(pool,p,async c=>{const s=createPostgresExecutionChecklistStore(c),r=await s.read(tid);const cmd={action:'mark' as const,itemId:'conferir',status:'done' as const,expectedTicketVersion:r.context.ticketVersion,expectedChecklistRevision:0,evidenceRefs:['note:'+note],reason:null,acknowledgeRisk:false};await s.mark(tid,cmd,requestHash(cmd),randomUUID(),randomUUID());});
    return tid as string;
   }
   const current=async(tid:string)=>runTransaction(pool,p,c=>createPostgresSupportWorkflowStore(c,p).readTicket(tid));
   async function resolve(tid:string,key=randomUUID(),usedPool=pool){
    const before=await current(tid);assert.ok(before);
    const at=await sqlNow(),flow=createDurablePostgresSupportWorkflow({pool:usedPool,resolver,clock:()=>at});
    return flow.execute(p,tid,refs,{action:'resolve',expectedVersion:before.version,body:'Execução confirmada pela equipe.'},key,randomUUID());
   }
   const counts=async(tid:string)=>(await admin.query(`select
    (select count(*) from helpdesk_audit.hdn_workflow_commits where workspace_id=$1 and ticket_id=$2) as ledger,
    (select count(*) from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2) as events,
    (select count(*) from helpdesk_integration.outbox_events where workspace_id=$1 and ticket_id=$2) as outbox,
    (select count(*) from helpdesk_audit.write_effects where workspace_id=$1 and ticket_id=$2) as effects`,[w,tid])).rows;
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
