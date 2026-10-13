/** Registered only from the existing fresh-PG17 rls.test.ts chain. No top-level
 * network/SQL and no hosted target. These scenarios are NOT executed by unit tests. */
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
import {assertLegacyTerminalUpdateAllowed} from '../../src/infrastructure/legacy-transition-guard.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import {createPostgresExecutionChecklistStore} from '../../src/infrastructure/execution-checklist-store.ts';
import {parseExecutionChecklistTemplate} from '../../src/domain/execution-checklist.ts';
export function registerExecutionChecklistSqlTests(adminPool:()=>SqlPool){test('HDN01b restricted PostgreSQL checklist marking',async t=>{
 // Variable dynamic imports retain the existing full-checkout prerequisites, not
 // substitutes. Import/setup failures are test failures, never skips or success.
 const targetPath='../../scripts/database-target.ts';const {validateDatabaseTestTargets}=await import(targetPath);
 const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
 assert.equal((await admin.query("select current_database() as db")).rows[0]?.db,'helpdesk_test');
 const install=await admin.connect();try{await install.query('BEGIN');await install.query("select set_config('app.hdn01b_candidate','disposable-pg17',true)");await install.query(await readFile(new URL('../candidates/hdn_execution_checklist.sql',import.meta.url),'utf8'));await install.query('COMMIT');}
 catch(e){await install.query('ROLLBACK');throw e;}finally{install.release();}
 const pgName='pg',pg=await import(pgName) as {Pool:new(o:Record<string,unknown>)=>SqlPool};
 const pool=new pg.Pool({connectionString:appUrl,max:3,connectionTimeoutMillis:5000});
 try{
  const appPath='../../src/application/helpdesk.ts',postgresPath='../../src/infrastructure/postgres.ts';
  const {HelpdeskService}=await import(appPath),{PostgresUnitOfWork,assertSafeDatabaseRole}=await import(postgresPath);await assertSafeDatabaseRole(pool);
  const w=randomUUID(),a=randomUUID(),product=randomUUID(),instance=randomUUID(),contract=randomUUID(),cv=randomUUID(),who=randomUUID(),customer=randomUUID(),conn=randomUUID(),binding=randomUUID();
  await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'HDN synthetic')",[w]);
  await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'HDN account')",[w,a]);
  await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'HDN product')",[w,product,product]);
  await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
  await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,product]);
  await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'HDN contract')",[w,contract]);
  await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,cv]);
  await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,product,instance,cv,randomUUID()]);
  const scopes=['tickets:read','tickets:write','notes:read','notes:write'];
  for(const [person,role] of [[who,'agent'],[customer,'requester']]){
   await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,randomUUID()]);
   await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[w,a,person,role]);
   await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,person,scopes,'HDN owned synthetic fixture',randomUUID()]);
  }
  const p:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'agent'}],scopes};
  const outsider:Principal={...p,id:customer,grants:[{accountId:a,role:'requester'}]};
  const service=new HelpdeskService(new PostgresUnitOfWork(pool)),tickets:Record<string,string>={},notes:Record<string,string>={};
  for(const name of ['A','C','AC','LEGACY','SAME_STATE']){
   tickets[name]=(await service.create(p,{accountId:a,productInstanceId:instance,serviceCode:'SUPPORT',subject:'HDN '+name,description:'Synthetic execution',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
   await admin.query("update helpdesk_core.tickets set assigned_to=$1,status='open',version=version+1,updated_at=clock_timestamp() where workspace_id=$2 and id=$3",[who,w,tickets[name]]);
   await service.addNote(p,tickets[name],'Synthetic execution statement',randomUUID(),randomUUID());
   notes[name]=String((await admin.query('select id from helpdesk_core.internal_notes where workspace_id=$1 and ticket_id=$2 order by created_at limit 1',[w,tickets[name]])).rows[0]?.id);
  }
  await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,conn,instance]);
  await admin.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'HDN-Tenant')",[w,a,binding,conn]);
  for(const name of ['A','C','AC','LEGACY','SAME_STATE']){
   const ids=name==='AC'?['A','C']:name==='LEGACY'||name==='SAME_STATE'?['A']:[name];
   await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,$5)',[w,a,tickets[name],binding,ids.length]);
   for(const x of ids)await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,a,tickets[name],x]);
   await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tickets[name]]);
  }
  for(const op of ['tickets.read','tickets.write','notes.read','notes.write']){
   await admin.query("insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,'HDN-1',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',1)",[w,a,binding,who,op]);
   await admin.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work','A')",[w,a,binding,who,op]);
   await admin.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and operation=$3',[w,binding,op]);
  }
  const template=parseExecutionChecklistTemplate({schema:1,id:'hdn-test',version:1,status:'published',items:[
   {id:'grupo',label:'Conferir grupo',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'},
   {id:'email',label:'Conferir preferências',required:true,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary'},
   {id:'risco',label:'Confirmar conferência sensível',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'sensitive'}]});
  await admin.query('insert into helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) values($1,$2,$3,$4,$5)',[w,template.id,1,requestHash(template),template]);
  for(const name of ['A','C','AC','SAME_STATE'])await admin.query("insert into helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id,profile_version_id,template_id,template_version,template_sha256) values($1,$2,$3,'HDN-P1',$4,1,$5)",[w,a,tickets[name],template.id,requestHash(template)]);
  const use=<T>(work:(s:ReturnType<typeof createPostgresExecutionChecklistStore>)=>Promise<T>,actor=p)=>runTransaction(pool,actor,c=>work(createPostgresExecutionChecklistStore(c)));
  const view=()=>use(s=>s.read(tickets.A!));const initial=await view(),tv=initial.context.ticketVersion;
  const command=(rev:number,item='grupo',extra:Record<string,unknown>={})=>({action:'mark' as const,itemId:item,status:'done' as const,expectedTicketVersion:tv,expectedChecklistRevision:rev,evidenceRefs:['note:'+notes.A],reason:null,acknowledgeRisk:false,...extra});
  const mark=(rev:number,key=randomUUID(),item='grupo',extra:Record<string,unknown>={})=>use(s=>s.mark(tickets.A!,command(rev,item,extra) as any,requestHash(command(rev,item,extra)),key,randomUUID()));
  await t.test('real restricted role passes readiness without table grants',async()=>{await use(s=>s.assertReady());await assert.rejects(runTransaction(pool,p,c=>c.query('select * from helpdesk_core.hdn_execution_snapshots')),{code:'42501'});});
  await t.test('requester and partial work coverage cannot read internal checklist',async()=>{await assert.rejects(use(s=>s.read(tickets.A!),outsider),{code:'checklist_forbidden'});for(const n of ['C','AC'])await assert.rejects(use(s=>s.read(tickets[n]!)),{code:'checklist_forbidden'});});
  await t.test('one mark atomically persists actor, snapshot, audit and receipt',async()=>{const key=randomUUID();const r=await mark(0,key) as any;assert.equal(r.receipt.actorId,who);assert.equal(r.receipt.checklistRevision,1);assert.equal(r.record.snapshot.entries[0].actorId,who);assert.equal((await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_audit where workspace_id=$1',[w])).rows[0]?.n,1);const replay=await mark(0,key) as any;assert.deepEqual(replay.receipt,r.receipt);assert.equal(replay.record,null);});
  // HDN01c: the test administrator simulates a corrupted snapshot. No production
  // permission is changed and no immutable note/audit is modified or erased.
  const corruptSnapshot=async(edit:(doc:any)=>Promise<void>|void)=>{
   const saved=(await admin.query('select document from helpdesk_core.hdn_execution_snapshots where workspace_id=$1 and ticket_id=$2 and ticket_version=$3',[w,tickets.A,tv])).rows[0]?.document;
   assert.ok(saved);const altered=structuredClone(saved);await edit(altered);
   await admin.query('update helpdesk_core.hdn_execution_snapshots set document=$1 where workspace_id=$2 and ticket_id=$3 and ticket_version=$4',[altered,w,tickets.A,tv]);
   try{await assert.rejects(use(s=>s.readExecutionChecklist(tickets.A!)),{code:'checklist_evidence_denied'});}
   finally{await admin.query('update helpdesk_core.hdn_execution_snapshots set document=$1 where workspace_id=$2 and ticket_id=$3 and ticket_version=$4',[saved,w,tickets.A,tv]);}
  };
  await t.test('resolution reader revalidates current private evidence with no new audit',async()=>{
   const before=(await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_audit where workspace_id=$1',[w])).rows;
   const r=await use(s=>s.readExecutionChecklist(tickets.A!)) as any;assert.equal(r.snapshot.revision,1);
   assert.deepEqual(Object.keys(r).sort(),['snapshot','template']);
   assert.deepEqual((await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_audit where workspace_id=$1',[w])).rows,before);
  });
  await t.test('missing referenced note cannot satisfy a previously marked item',async()=>{
   await corruptSnapshot(d=>{d.entries[0].evidenceRefs=['note:'+randomUUID()];});
  });
  await t.test('a referenced note from C never becomes evidence of A',async()=>{
   await corruptSnapshot(d=>{d.entries[0].evidenceRefs=['note:'+notes.C];});
  });
  await t.test('resolution evidence remains bound to its marking author',async()=>{
   await corruptSnapshot(d=>{d.entries[0].actorId=customer;});
  });
  await t.test('resolution denies a note newer than its marking by one microsecond',async()=>{
   const before=(await admin.query(`select to_char(created_at-interval '1 microsecond' AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at from helpdesk_core.internal_notes where workspace_id=$1 and id=$2`,[w,notes.A])).rows[0]?.at;
   assert.equal(typeof before,'string');await corruptSnapshot(d=>{d.entries[0].at=before;});
  });
  await t.test('new evidence reader also denies requester and A+C',async()=>{
   await assert.rejects(use(s=>s.readExecutionChecklist(tickets.A!),outsider),{code:'checklist_forbidden'});
   for(const name of ['C','AC'])await assert.rejects(use(s=>s.readExecutionChecklist(tickets[name]!)),{code:'checklist_forbidden'});
  });
  await t.test('resolution holds note row locks until its transaction finishes',async()=>{
   const reader=await pool.connect(),writer=await admin.connect();
   try{
    await reader.query('BEGIN');await reader.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true)",[w,who]);
    await createPostgresExecutionChecklistStore(reader).readExecutionChecklist(tickets.A!);
    await writer.query('BEGIN');await writer.query("set local lock_timeout='200ms'");
    await assert.rejects(writer.query('select id from helpdesk_core.internal_notes where workspace_id=$1 and id=$2 for update',[w,notes.A]),{code:'55P03'});
    await writer.query('ROLLBACK');await reader.query('COMMIT');
    await writer.query('BEGIN');await writer.query("set local lock_timeout='200ms'");
    assert.equal((await writer.query('select id from helpdesk_core.internal_notes where workspace_id=$1 and id=$2 for update',[w,notes.A])).rows.length,1);
   }finally{await writer.query('ROLLBACK');await reader.query('ROLLBACK');writer.release();reader.release();}
  });
  await t.test('old revision and forged caller attribution are denied',async()=>{await assert.rejects(mark(0),{code:'checklist_version_conflict'});await assert.rejects(runTransaction(pool,p,c=>c.query('select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5)',[tickets.A,{...command(1),actorId:customer},'a'.repeat(64),randomUUID(),randomUUID()])),{code:'HD006'});});
  await t.test('foreign note cannot qualify and no second snapshot revision is created',async()=>{await assert.rejects(mark(1,randomUUID(),'grupo',{evidenceRefs:['note:'+notes.C]}),{code:'checklist_evidence_denied'});assert.equal((await view()).snapshot?.revision,1);});
  await t.test('sensitive item requires acknowledgement and own note',async()=>{await assert.rejects(mark(1,randomUUID(),'risco'),{code:'checklist_evidence_denied'});const r=await mark(1,randomUUID(),'risco',{acknowledgeRisk:true}) as any;assert.equal(r.record.snapshot.entries.find((e:any)=>e.itemId==='risco').riskAcknowledgement.actorId,who);});
  await t.test('two concurrent writes from one revision produce one commit and one conflict',async()=>{const results=await Promise.allSettled([mark(2,randomUUID(),'email',{evidenceRefs:[]}),mark(2,randomUUID(),'email',{evidenceRefs:[]})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const rejected=results.find(x=>x.status==='rejected');assert.equal(rejected?.status==='rejected'&&rejected.reason.code,'checklist_version_conflict');assert.equal((await view()).snapshot?.revision,3);});
  // HDN-01g: no expectation below is a claim that this source has run in PG.
  await t.test('the original service cannot resolve a bound ticket even with a complete checklist',async()=>{
   const current=await view();assert.equal(current.snapshot?.entries.filter(e=>e.status==='done').length,3);
   const before=(await admin.query('select status,version from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,tickets.A])).rows;
   const events=(await admin.query('select count(*)::int as n from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2',[w,tickets.A])).rows;
   await assert.rejects(service.transition(p,tickets.A!,'resolved',tv,'HDN legacy completion must be refused',randomUUID(),randomUUID()),{code:'structured_workflow_required'});
   assert.deepEqual((await admin.query('select status,version from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,tickets.A])).rows,before);
   assert.deepEqual((await admin.query('select count(*)::int as n from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2',[w,tickets.A])).rows,events);
  });
  await t.test('the original store cannot directly close a bound open ticket',async()=>{
   await assert.rejects(new PostgresUnitOfWork(pool).run(p,async (store:any)=>{
    const ticket=await store.getTicket(tickets.A!,true);assert.ok(ticket);
    await store.updateTicket({...ticket,status:'closed',version:ticket.version+1,updatedAt:new Date().toISOString()},ticket.version);
   }),{code:'structured_workflow_required'});
   assert.equal((await view()).ticketStatus,'open');
  });
  await t.test('the legacy terminal helper refuses foreign resources and a foreign account',async()=>{
   for(const target of [tickets.C!,tickets.AC!])await assert.rejects(runTransaction(pool,p,c=>c.query(
    'select helpdesk_auth.hdn_legacy_terminal_update($1,$2,$3,$4,$5)',[w,a,target,'resolved',tv])),{code:'HD001'});
   await assert.rejects(runTransaction(pool,p,c=>c.query('select helpdesk_auth.hdn_legacy_terminal_update($1,$2,$3,$4,$5)',[w,randomUUID(),tickets.A,'resolved',tv])),{code:'HD001'});
  });
  await t.test('SQL legacy completion refusal remains sticky when application code catches it',async()=>{
   await assert.rejects(runTransaction(pool,p,async c=>{
    await c.query('select helpdesk_auth.hdn_legacy_terminal_update($1,$2,$3,$4,$5)',[w,a,tickets.A,'resolved',tv]).catch(e=>assert.equal((e as {code:string}).code,'HD008'));
   }),{code:'transaction_statement_failed'});
  });
  await t.test('unbound legacy tickets still resolve through the original service',async()=>{
   const old=await service.get(p,tickets.LEGACY!);
   const result=await service.transition(p,tickets.LEGACY!,'resolved',old.version,'Synthetic legacy resolution',randomUUID(),randomUUID());
   assert.equal(result.ticket.status,'resolved');assert.equal(result.ticket.version,old.version+1);
  });
  await t.test('a same-state message on a resolved bound ticket is not a new completion',async()=>{
   await admin.query("update helpdesk_core.tickets set status='resolved',version=version+1,updated_at=clock_timestamp() where workspace_id=$1 and id=$2",[w,tickets.SAME_STATE]);
   const before=await service.get(p,tickets.SAME_STATE!);
   await service.addMessage(p,tickets.SAME_STATE!,'Synthetic follow-up, not another completion',randomUUID(),randomUUID());
   const after=await service.get(p,tickets.SAME_STATE!);assert.equal(after.status,'resolved');assert.equal(after.version,before.version+1);
  });
  await t.test('reset clears current entry but retains its prior revision in immutable audit',async()=>{await mark(3,randomUUID(),'grupo',{status:'pending',evidenceRefs:[],reason:'Refazer conferência.'});const r=await view();assert.equal(r.snapshot?.entries.find(e=>e.itemId==='grupo')?.actorId,null);const arow=(await admin.query('select before_document from helpdesk_core.hdn_execution_audit where workspace_id=$1 and checklist_revision=4',[w])).rows[0]?.before_document as any;assert.equal(arow.entries.find((e:any)=>e.itemId==='grupo').status,'done');await assert.rejects(admin.query("update helpdesk_core.hdn_execution_audit set reason='erase' where workspace_id=$1",[w]),{code:'23514'});});
  await t.test('driver failure swallowed by caller still rolls a staged marking back',async()=>{await assert.rejects(runTransaction(pool,p,async c=>{const s=createPostgresExecutionChecklistStore(c);await s.mark(tickets.A!,command(4),'b'.repeat(64),randomUUID(),randomUUID());await c.query('select 1/0').catch(()=>{});}),{code:'transaction_statement_failed'});assert.equal((await view()).snapshot?.revision,4);});
  await t.test('caught local terminal-validation failure rolls back the marking, audit and receipt',async()=>{
   const counts=()=>admin.query(`select
    (select count(*) from helpdesk_core.hdn_execution_audit where workspace_id=$1) as audits,
    (select count(*) from helpdesk_core.hdn_execution_receipts where workspace_id=$1) as receipts`,[w]);
   const before=(await counts()).rows,key=randomUUID();
   await assert.rejects(runTransaction(pool,p,async c=>{
    await createPostgresExecutionChecklistStore(c).mark(tickets.A!,command(4),requestHash(command(4)),key,randomUUID());
    // Deliberately inconsistent expected version: the guard rejects locally,
    // AFTER a real staged SQL marking, without a PostgreSQL statement error.
    await assertLegacyTerminalUpdateAllowed(c,p,{id:tickets.A!,workspaceId:w,accountId:a,status:'resolved',version:tv+1,updatedAt:new Date().toISOString()},tv+1)
     .catch(e=>assert.equal(e.code,'legacy_transition_guard_unavailable'));
   }),{code:'transaction_validation_failed'});
   assert.equal((await view()).snapshot?.revision,4);
   assert.deepEqual((await counts()).rows,before);
   assert.equal(await use(s=>s.readReceipt(tickets.A!,key)),null);
  });

  // HDN-01i: driver envelope fault AFTER a successful real SQL mutation. This
  // tests local validation rollback, not PostgreSQL's automatic SQL-error abort.
  await t.test('caught invalid marking envelope cannot commit snapshot audit or receipt',async()=>{
   const current=await view(),key=randomUUID();const cmd=command(current.snapshot?.revision??0,'email',{evidenceRefs:[]});
   const counts=()=>admin.query(`select
    (select count(*) from helpdesk_core.hdn_execution_audit where workspace_id=$1) as audits,
    (select count(*) from helpdesk_core.hdn_execution_receipts where workspace_id=$1) as receipts`,[w]);
   const before=(await counts()).rows;let successfulWrites=0;
   const transport:SqlPool={
    async connect(){const physical=await pool.connect();return {
     async query(sql,values){
      const result=await physical.query(sql,values);
      if(sql==='select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5) as result'){
       assert.equal(result.command,'SELECT');assert.equal(result.rowCount,1);
       const saved=result.rows[0]?.result as {receipt?:{checklistRevision?:number}}|undefined;
       assert.equal(saved?.receipt?.checklistRevision,(current.snapshot?.revision??0)+1);
       successfulWrites++;
       // The persisted operation succeeded. Only its returned envelope is corrupt.
       return {...result,rows:[{...result.rows[0],unexpected:'synthetic-driver-field'}]};
      }
      return result;
     },release:error=>physical.release(error),
     ...(physical.on?{on:(event:'error',listener:(error:Error)=>void)=>physical.on!(event,listener)}:{}),
    };},query:async()=>assert.fail('No pool.query in the checklist transaction'),end:async()=>{},
   };
   await assert.rejects(runTransaction(transport,p,async client=>{
    await assert.rejects(createPostgresExecutionChecklistStore(client).mark(tickets.A!,cmd as any,requestHash(cmd),key,randomUUID()),{code:'checklist_store_invalid'});
   }),{code:'transaction_validation_failed'});
   assert.equal(successfulWrites,1); // Never pass by failing setup or the SQL write.
   assert.deepEqual((await view()).snapshot,current.snapshot);
   assert.deepEqual((await counts()).rows,before);
   assert.equal(await use(store=>store.readReceipt(tickets.A!,key)),null);
  });

  await t.test('current note permission revocation denies the helper as well',async()=>{await admin.query("update helpdesk_auth.account_grants set role='requester' where workspace_id=$1 and principal_id=$2",[w,who]);try{await assert.rejects(view(),{code:'checklist_forbidden'});}finally{await admin.query("update helpdesk_auth.account_grants set role='agent' where workspace_id=$1 and principal_id=$2",[w,who]);}});
  await t.test('all tables FORCE RLS and PUBLIC cannot execute candidate functions',async()=>{const rows=(await admin.query("select relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='helpdesk_core' and relname like 'hdn_execution_%' and relkind='r'")).rows;assert.equal(rows.length,5);assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));const acl=await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='helpdesk_auth' and p.proname like 'hdn_%' and a.grantee=0 and a.privilege_type='EXECUTE'");assert.equal(acl.rows.length,0);});
  await t.test('ticket revision change cannot inherit completed entries',async()=>{await admin.query('update helpdesk_core.tickets set version=version+1,updated_at=clock_timestamp() where workspace_id=$1 and id=$2',[w,tickets.A]);const r=await view();assert.equal(r.context.ticketVersion,tv+1);assert.equal(r.snapshot,null);assert.equal((await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_snapshots where workspace_id=$1 and ticket_version=$2',[w,tv])).rows[0]?.n,1);});
  // HDN01e: additional real-SQL scenarios; executed only by the guarded runner.
  const evidencePage=async(before:{id:string;at:string}|null=null)=>use(async store=>{
   const r=await store.read(tickets.A!);
   return store.queryEvidence({principalId:p.id,workspaceId:w,accountId:a,ticketId:tickets.A!,ticketVersion:r.context.ticketVersion,
    checklistRevision:r.snapshot?.revision??0,readAt:r.readAt},{expectedTicketVersion:r.context.ticketVersion,expectedChecklistRevision:r.snapshot?.revision??0,before});
  });
  await t.test('eligible note projection contains metadata only and does not mark or audit',async()=>{
   const before=await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_audit where workspace_id=$1',[w]);
   const page=await evidencePage();assert.ok(page.items.some(n=>n.id===notes.A));assert.ok(page.items.every(n=>Object.keys(n).sort().join(',')==='at,id'));
   assert.deepEqual((await admin.query('select count(*)::int as n from helpdesk_core.hdn_execution_audit where workspace_id=$1',[w])).rows,before.rows);
  });
  await t.test('metadata query still enforces RLS for a foreign or partially authorized resource',async()=>{
   const r=await view();for(const target of [tickets.C!,tickets.AC!]){
    const page=await use(store=>store.queryEvidence({principalId:p.id,workspaceId:w,accountId:a,ticketId:target,ticketVersion:r.context.ticketVersion,
     checklistRevision:r.snapshot?.revision??0,readAt:r.readAt},{expectedTicketVersion:r.context.ticketVersion,expectedChecklistRevision:r.snapshot?.revision??0,before:null}));
    assert.deepEqual(page.items,[]);
   }
  });
  await t.test('native metadata pagination preserves the full authorized order without duplicate notes',async()=>{
   for(let i=0;i<23;i++)await service.addNote(p,tickets.A!,'HDN selector synthetic evidence '+i,randomUUID(),randomUUID());
   const aPage=await evidencePage();assert.equal(aPage.items.length,20);assert.ok(aPage.next);
   const bPage=await evidencePage(aPage.next);assert.equal(bPage.next,null);
   const ids=[...aPage.items,...bPage.items].map(n=>n.id);
   const expected=(await admin.query('select id::text as id from helpdesk_core.internal_notes where workspace_id=$1 and account_id=$2 and ticket_id=$3 and actor_id=$4 order by created_at desc,id desc',[w,a,tickets.A,who])).rows.map(n=>n.id);
   assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
  });
  await t.test('removing current notes read scope blocks both selection entry and direct metadata',async()=>{
   const r=await view(),version=Number((await admin.query('select revision from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2',[w,who])).rows[0]?.revision);
   await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,$4,$5,$6)',[w,who,scopes.filter(s=>s!=='notes:read'),version,'HDN selector disposable revocation',randomUUID()]);
   try{
    await assert.rejects(evidencePage(),{code:'checklist_forbidden'});
    const page=await use(store=>store.queryEvidence({principalId:who,workspaceId:w,accountId:a,ticketId:tickets.A!,ticketVersion:r.context.ticketVersion,
     checklistRevision:r.snapshot?.revision??0,readAt:r.readAt},{expectedTicketVersion:r.context.ticketVersion,expectedChecklistRevision:r.snapshot?.revision??0,before:null}));
    assert.deepEqual(page.items,[]);
   }finally{await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,$4,$5,$6)',[w,who,scopes,version+1,'HDN selector restore fixture scope',randomUUID()]);}
  });
 }finally{await pool.end();}
 });}
