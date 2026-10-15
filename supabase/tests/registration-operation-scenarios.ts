import {assertSchemaCompatibility,assertDatabaseSecurity} from '../../tests/helpers/qualified-v024.ts';
/** Genuine NOSUPER operator publication of registration DATA on the qualified 0.24 catalogue. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import {DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/consultegeo-v024-security-contract.ts';
import {assertSafeDatabaseRole,createBorrowedPostgresUnitOfWork} from '../../src/infrastructure/postgres.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {planConsulteGeoInitialOperation} from '../../src/application/consultegeo-initial-operation.ts';
import {planConsulteGeoRegistrationOperation} from '../../src/application/consultegeo-registration-operation.ts';
import {buildConsulteGeoRegistrationSql} from '../../src/infrastructure/consultegeo-registration-sql.ts';
import {canonicalJson,requestHash} from '../../src/domain/canonical.ts';import {validateFormValues} from '../../shared/form-rules.js';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {createConsulteGeoRequestCatalog} from '../../src/application/consultegeo-request-catalog.ts';
import {createFormDraftService} from '../../src/application/form-draft.ts';import {createSupportIntake} from '../../src/application/support-intake.ts';
import {createPostgresConsulteGeoIntakeStore,createPostgresConsulteGeoDraftDirectory} from '../../src/infrastructure/consultegeo-intake-store.ts';

export function registerRegistrationOperationSqlTests(operatorPool:()=>SqlPool,controlPool:()=>SqlPool,appPool:()=>SqlPool){
 test('registration operator publication and native conditional opening on the complete seventeen-migration installation',async suite=>{
  const operator=operatorPool(),control=controlPool(),app=appPool();
  assert.equal((await control.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  const identity=async()=>assert.deepEqual((await operator.query('select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls from pg_roles where rolname=current_user')).rows,[{current_user:'helpdesk_operator',session_user:'helpdesk_operator',rolsuper:false,rolcreaterole:true,rolbypassrls:true}]);
  const ready=async()=>{await identity();await assertSafeDatabaseRole(app);await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);};
  await ready();
  // Owned provider fixture only: the operator reads verified sponsorship, without an Auth/MFA session.
  const createdAuth=!(await control.query("select to_regclass('auth.users') as users")).rows[0]?.users;
  if(createdAuth){await control.query('create schema if not exists auth');await control.query('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz)');}
  const hadUsage=(await control.query("select has_schema_privilege('helpdesk_operator','auth','USAGE') as allowed")).rows[0]?.allowed===true;
  const hadSelect=(await control.query("select has_table_privilege('helpdesk_operator','auth.users','SELECT') as allowed")).rows[0]?.allowed===true;
  await control.query('grant usage on schema auth to helpdesk_operator');await control.query('grant select on auth.users to helpdesk_operator');
  const state=async()=>Promise.all(DATABASE_SECURITY_CONTRACT.tables.map(async table=>({table:table.name,rows:(await control.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table.name} t`)).rows[0]?.rows})));
  const fixture=async()=>{
   const w=randomUUID(),who=randomUUID(),user=randomUUID(),email='registration-'+user+'@example.invalid';
   await operator.query("insert into helpdesk_core.workspaces(id,name) values($1,'Owned registration operation')",[w]);
   await operator.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[who,user]);
   await operator.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[w,who]);
   await control.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())',[user,email]);
   await operator.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'],0,'Owned registration scopes',$3)",[w,who,randomUUID()]);
   const initial={workspaceId:w,administratorId:who,administratorEmail:email,requestId:randomUUID(),accountId:randomUUID(),accountName:'Owned registration client',workId:randomUUID(),workName:'Owned registration work',productId:randomUUID(),productInstanceId:randomUUID(),connectionId:randomUUID(),bindingId:randomUUID(),contractId:randomUUID(),contractVersionId:randomUUID(),configurationIds:[randomUUID(),randomUUID(),randomUUID()],coverageIds:[randomUUID(),randomUUID(),randomUUID()],calendar:{startDate:new Date(Date.now()-86400000).toISOString().slice(0,10),endDate:new Date(Date.now()+180*86400000).toISOString().slice(0,10),holidays:[]},reason:'Owned explicit initial operation before registration'};
   const initialPlan=planConsulteGeoInitialOperation(initial),receipt=(await operator.query(initialPlan.sql,[...initialPlan.values])).rows[0]?.receipt as Record<string,unknown>;
   assert.equal(receipt.assurance,'operator-delegation');assert.equal(receipt.recordedBy,'helpdesk_operator');
   const {configurationIds,coverageIds,...sameTarget}=initial,input={...sameTarget,requestId:randomUUID(),configurationId:randomUUID(),coverageId:randomUUID(),reason:'Owned explicit registration publication'},plan=planConsulteGeoRegistrationOperation(input);
   const p:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:'admin',grants:[{accountId:initial.accountId,role:'agent'}],scopes:['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']};
   return {input,plan,p,user,initialPlan};
  };
  const sqlFor=(command:Record<string,any>)=>buildConsulteGeoRegistrationSql({executesDatabase:false,values:[canonicalJson(command),requestHash(command)]});
  const reapprove=(c:Record<string,any>)=>{const {approvalHash,local,localHash,...approval}=c;c.approvalHash=requestHash(approval);c.local.reason=c.reason+' Configuração '+c.configurationId+'/v1 SHA256 '+c.configuration.contentHash+' aprovação '+c.approvalHash;c.localHash=requestHash(c.local);return c;};
  const refuses=async(statement:string,code:string,pool=operator)=>{const before=await state(),uncommitted=statement.replace(/\nCOMMIT;\nSELECT /,'\nSELECT ');assert.notEqual(uncommitted,statement);try{await assert.rejects(()=>pool.query(uncommitted),{code});}finally{await pool.query('ROLLBACK');assert.deepEqual(await state(),before);await identity();}};
  const persisted=async(w:string)=>(await control.query(`select
   (select count(*)::int from helpdesk_core.hdn_cfg_versions where workspace_id=$1) configurations,
   (select count(*)::int from helpdesk_core.hdn_workflow_profiles where workspace_id=$1) workflows,
   (select count(*)::int from helpdesk_core.hdn_execution_templates where workspace_id=$1) checklists,
   (select revision from helpdesk_core.hdn_cfg_catalog where workspace_id=$1) catalogue,
   (select revision from helpdesk_auth.cg_local_registries where workspace_id=$1) registry,
   (select count(*)::int from helpdesk_audit.cg_local_receipts where workspace_id=$1) local_receipts,
   (select count(*)::int from helpdesk_audit.hdn_cfg_commits where workspace_id=$1) mfa_commits`,[w])).rows[0];
  const unchangedBusiness=async(w:string)=>Promise.all(['helpdesk_core.tickets','helpdesk_core.ticket_events','helpdesk_core.hdni_protocol_counters','helpdesk_core.hdni_snapshots','helpdesk_audit.hdni_receipts','helpdesk_core.hdn_execution_bindings','helpdesk_integration.outbox_events','helpdesk_audit.cg_initial_receipts','helpdesk_core.accounts','helpdesk_core.product_instances','helpdesk_core.support_contracts','helpdesk_core.contract_versions'].map(async table=>({table,rows:(await control.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table} t where workspace_id=$1`,[w])).rows[0]?.rows})));
  const localTargets=async(w:string)=>Promise.all(['helpdesk_auth.cg_local_accounts','helpdesk_auth.cg_local_works','helpdesk_auth.cg_local_permissions'].map(async table=>({table,rows:(await control.query(`select coalesce(jsonb_agg(to_jsonb(t)-'registry_revision' order by (to_jsonb(t)-'registry_revision')::text),'[]'::jsonb) as rows from ${table} t where workspace_id=$1`,[w])).rows[0]?.rows})));
  const runtime=async(f:Awaited<ReturnType<typeof fixture>>)=>{const source=createPostgresLocalConsulteGeoSourcePorts(app),contexts=await source.readRequestContexts(f.p,new AbortController().signal);assert.equal(contexts.length,1);assert.equal(contexts[0]?.accountName,f.input.accountName);const refs=[contexts[0]!.works[0]!.ref],options={pool:app,resolver:source.resolver,createStore:createPostgresConsulteGeoIntakeStore,directory:createPostgresConsulteGeoDraftDirectory(app),draftTtlSeconds:600};return {refs,options,catalog:createConsulteGeoRequestCatalog(options),drafts:createFormDraftService(options),intake:createSupportIntake(options)};};
  const open=async(f:Awaited<ReturnType<typeof fixture>>,service:string,action:string,answers:Record<string,unknown>)=>{
   const r=await runtime(f),catalog=await r.catalog.read(f.p,{service,refs:r.refs});assert.equal(catalog.configurations.length,1);const entry=catalog.configurations[0]!.entries.find(e=>e.action===action);assert.ok(entry);
   const draft=await r.drafts.saveFormDraft(f.p,{id:randomUUID(),accountId:f.input.accountId,refs:r.refs,formId:entry.form.id,formVersion:1,answers},0),q={draftId:draft.id,expectedDraftRevision:1,subject:'Owned '+service+' '+action,description:'Owned native registration qualification',coverageId:null},before=await state(),preview=await r.intake.previewSupportRequest(f.p,q);
   assert.deepEqual(await state(),before,'Preview must allocate no protocol, ticket, receipt or outbox');
   const key=randomUUID(),input={...q,previewHash:preview.previewHash},result=await r.intake.createSupportRequest(f.p,input,key,randomUUID());
   assert.equal(result.formId,entry.form.id);assert.equal(result.notification,'pending');assert.equal((await r.drafts.readFormDraft(f.p,draft.id)).status,'committed');
   const saved=await state();assert.deepEqual(await r.intake.createSupportRequest(f.p,input,key,randomUUID()),{...result,replayed:true});assert.deepEqual(await state(),saved);
   return {result,entry,answers};
  };
  try{
   await suite.test('ordinary application identity cannot execute the private registration recipe or read its receipt',async()=>{const f=await fixture();await refuses(buildConsulteGeoRegistrationSql(f.plan),'42501',app);await assert.rejects(()=>app.query('select * from helpdesk_audit.cg_local_receipts'),{code:'42501'});});
   await suite.test('unverified current delegating sponsor refuses without publication or local registry effects',async()=>{const f=await fixture();await control.query('update auth.users set email_confirmed_at=null where id=$1',[f.user]);try{await refuses(buildConsulteGeoRegistrationSql(f.plan),'CGR01');}finally{await control.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[f.user]);}});
   await suite.test('forged approval and expanded local work scope refuse even with recomputed transport hashes',async()=>{const f=await fixture(),approval=JSON.parse(f.plan.values[0]),scope=JSON.parse(f.plan.values[0]);approval.approvalHash='a'.repeat(64);await refuses(sqlFor(approval),'CGR01');scope.local.permissions[0].workIds=[randomUUID()];scope.localHash=requestHash(scope.local);await refuses(sqlFor(scope),'CGR01');});
   await suite.test('native configuration compilation rejects altered artifacts after all canonical approval hashes are recomputed',async()=>{const f=await fixture(),c=JSON.parse(f.plan.values[0]);c.configuration.artifacts.entries[0].sla.firstResponseMicros='1';c.configuration.contentHash=requestHash({definition:c.configuration.definition,artifacts:c.configuration.artifacts});await refuses(sqlFor(reapprove(c)),'CGR01');});
   for(const mode of ['suppress','failure'] as const)await suite.test(mode+' of the immutable local receipt rolls back configuration, coverage, workflows, checklist and registry writes',async()=>{
    const f=await fixture(),saved=await state();let fn=false,trigger=false;
    try{
     await operator.query(`create function helpdesk_auth.cg_registration_fault_probe() returns trigger language plpgsql set search_path='' as $$begin if NEW.workspace_id::text=TG_ARGV[0] and NEW.request_id::text=TG_ARGV[1] then ${mode==='suppress'?'return null;':"raise exception 'Owned registration insertion failure' using errcode='P0001';"}end if;return NEW;end$$`);fn=true;
     await operator.query(`create trigger cg_registration_fault_probe before insert on helpdesk_audit.cg_local_receipts for each row execute function helpdesk_auth.cg_registration_fault_probe('${f.p.workspaceId}','${f.input.requestId}')`);trigger=true;
     await refuses(buildConsulteGeoRegistrationSql(f.plan),mode==='suppress'?'CGR04':'P0001');assert.deepEqual(await state(),saved);
    }finally{if(trigger)await operator.query('drop trigger cg_registration_fault_probe on helpdesk_audit.cg_local_receipts');if(fn)await operator.query('drop function helpdesk_auth.cg_registration_fault_probe()');}
    await ready();assert.deepEqual(await state(),saved);
    await operator.query(buildConsulteGeoRegistrationSql(f.plan));assert.deepEqual(await persisted(f.p.workspaceId),{configurations:4,workflows:11,checklists:11,catalogue:2,registry:2,local_receipts:2,mfa_commits:0});
   });
   const live=await fixture(),oldQuestion=await open(live,'questions','request',{details:'Owned pre-existing question before registration publication'});
   const savedBusiness=await unchangedBusiness(live.p.workspaceId),savedTargets=await localTargets(live.p.workspaceId),beforePublication=await persisted(live.p.workspaceId),command=JSON.parse(live.plan.values[0]);
   await suite.test('genuine owner publishes exactly one approved registration profile and five compiled workflow/checklist pairs without changing earlier business effects',async()=>{
    assert.deepEqual(beforePublication,{configurations:3,workflows:6,checklists:6,catalogue:1,registry:1,local_receipts:1,mfa_commits:0});
    assert.deepEqual((await operator.query('select helpdesk_auth.hdn_cfg_compile($1,$2) as artifacts',[command.configuration.definition,command.registry])).rows[0]?.artifacts,command.configuration.artifacts);
    await identity();await operator.query(buildConsulteGeoRegistrationSql(live.plan));await identity();
    assert.deepEqual(await unchangedBusiness(live.p.workspaceId),savedBusiness);assert.deepEqual(await localTargets(live.p.workspaceId),savedTargets);assert.deepEqual(await persisted(live.p.workspaceId),{configurations:4,workflows:11,checklists:11,catalogue:2,registry:2,local_receipts:2,mfa_commits:0});
    const receipt=(await control.query('select recorded_by,reason,command_hash,registry_revision from helpdesk_audit.cg_local_receipts where workspace_id=$1 and request_id=$2',[live.p.workspaceId,live.input.requestId])).rows[0];
    assert.deepEqual(receipt,{recorded_by:'helpdesk_operator',reason:command.local.reason,command_hash:command.localHash,registry_revision:2});assert.ok(String(receipt.reason).includes(command.configuration.contentHash));assert.ok(String(receipt.reason).includes(command.approvalHash));await ready();
   });
   await suite.test('identical publication replay preserves every row; changed approval under the same request refuses',async()=>{const saved=await state();await operator.query(buildConsulteGeoRegistrationSql(live.plan));assert.deepEqual(await state(),saved);const changed=JSON.parse(live.plan.values[0]);changed.reason='Owned divergent approval';await refuses(sqlFor(reapprove(changed)),'CGR02');await assert.rejects(()=>operator.query('update helpdesk_audit.cg_local_receipts set reason=reason where workspace_id=$1 and request_id=$2',[live.p.workspaceId,live.input.requestId]),{code:'23514'});assert.deepEqual(await state(),saved);});
   await suite.test('publication replay refuses disabled coverage and preserves the disabled row without repairing it',async()=>{await operator.query('update helpdesk_core.coverages set enabled=false where workspace_id=$1 and id=$2',[live.p.workspaceId,live.input.coverageId]);try{await refuses(buildConsulteGeoRegistrationSql(live.plan),'CGR04');assert.equal((await control.query('select enabled from helpdesk_core.coverages where workspace_id=$1 and id=$2',[live.p.workspaceId,live.input.coverageId])).rows[0]?.enabled,false);}finally{await operator.query('update helpdesk_core.coverages set enabled=true where workspace_id=$1 and id=$2',[live.p.workspaceId,live.input.coverageId]);}});
   await suite.test('earlier question remains readable through the real restricted reader after local revision advances with identical scopes',async()=>{await runTransaction(app,live.p,async client=>{const service=new HelpdeskService(createBorrowedPostgresUnitOfWork(client,live.p,{consulteGeoLocal:true,localCollection:true})),detail=await service.get(live.p,oldQuestion.result.ticketId);assert.equal(detail.consulteGeo?.protocol,'CG-10001');assert.equal(detail.serviceCode,'questions');});});
   await suite.test('conditional hidden user fields refuse in the actual published draft path and missing mix requirements block preview',async()=>{
    const r=await runtime(live),catalog=await r.catalog.read(live.p,{service:'user_access',refs:r.refs}),form=catalog.configurations[0]!.entries.find(e=>e.action==='include')!.form,mix={registration_kind:'mix',mix_type:'concrete',mix_fck:'30',mix_aggregate:'brita_1',mix_slump:'12',mix_tolerance:'2',mix_supplier:'Owned declared plant',details:'Owned complete mix declaration'},id=randomUUID(),saved=await state();
    assert.equal(validateFormValues(form,mix).valid,true);await assert.rejects(()=>r.drafts.saveFormDraft(live.p,{id,accountId:live.input.accountId,refs:r.refs,formId:form.id,formVersion:1,answers:{...mix,person_email:'hidden@example.invalid'}},0),{code:'invalid_form_values'});assert.deepEqual(await state(),saved);
    const draft=await r.drafts.saveFormDraft(live.p,{id,accountId:live.input.accountId,refs:r.refs,formId:form.id,formVersion:1,answers:{...mix,mix_fck:''}},0),incomplete=await state();await assert.rejects(()=>r.intake.previewSupportRequest(live.p,{draftId:draft.id,expectedDraftRevision:1,subject:'Owned incomplete registration',description:'Missing required FCK',coverageId:null}),{code:'invalid_form_values'});assert.deepEqual(await state(),incomplete);assert.equal((await r.drafts.readFormDraft(live.p,draft.id)).status,'editing');
   });
   const samples:Record<string,Record<string,unknown>>={user:{person_name:'Owned declared person',person_email:'person@example.invalid',requested_group:'Owned operator group'},mix:{mix_type:'concrete',mix_fck:'30',mix_aggregate:'brita_1',mix_slump:'12',mix_tolerance:'2',mix_supplier:'Owned declared plant'},plant:{plant_name:'Owned declared plant'},laboratory:{laboratory_name:'Owned declared laboratory'},block:{block_name:'Owned block',block_supplier:'Owned manufacturer',block_strength:'8'},ceramic:{ceramic_name:'Owned ceramic',ceramic_supplier:'Owned manufacturer'},cable:{cable_name:'Owned cable',cable_supplier:'Owned manufacturer',cable_diameter:'12.7'},supplier:{supplier_name:'Owned supplier',supplier_document:'12345678000190'}};
   let sequence=10001;
   for(const [kind,fields] of Object.entries(samples))await suite.test('published '+kind+' registration passes real source, draft, preview, opening and immutable replay',async()=>{
    const opened=await open(live,'user_access','include',{registration_kind:kind,...fields,details:'Owned native '+kind+' registration declaration'}),result=opened.result;assert.equal(result.protocol,'CG-'+ ++sequence);
    const rows=(await control.query(`select t.service_code,s.document,r.result,b.profile_version_id,
     (select count(*)::int from helpdesk_integration.outbox_events o where o.workspace_id=t.workspace_id and o.ticket_id=t.id) outbox
     from helpdesk_core.tickets t join helpdesk_core.hdni_snapshots s on s.workspace_id=t.workspace_id and s.ticket_id=t.id join helpdesk_audit.hdni_receipts r on r.workspace_id=t.workspace_id and r.ticket_id=t.id join helpdesk_core.hdn_execution_bindings b on b.workspace_id=t.workspace_id and b.ticket_id=t.id where t.workspace_id=$1 and t.id=$2`,[live.p.workspaceId,result.ticketId])).rows;
    assert.equal(rows.length,1);const row=rows[0]!,snapshot=row.document as Record<string,any>,bundle=snapshot.bundle;assert.equal(row.service_code,'user_access');assert.equal(row.profile_version_id,result.profileVersionId);assert.equal(row.outbox,1);assert.equal((row.result as Record<string,unknown>).protocol,result.protocol);assert.deepEqual(bundle.form.answers,opened.answers);assert.equal(bundle.workflow.profileVersionId,result.profileVersionId);assert.deepEqual(snapshot.receipt,row.result);assert.equal(snapshot.profile.workflow.versionId,result.profileVersionId);
   });
   await suite.test('work access release uses the existing fifth action with a manual beneficiary and actual selected work',async()=>{const opened=await open(live,'user_access','grant_work_access',{beneficiary:'declared-person@example.invalid',requested_group:'Owned requested operator group',details:'Owned explicit work access declaration'});assert.equal(opened.result.protocol,'CG-'+ ++sequence);});
   await suite.test('data-only registration leaves the complete qualified security catalogue and genuine operator profile unchanged',ready);
  }finally{
   await operator.query('ROLLBACK');await app.query('ROLLBACK');
   if(!hadSelect)await control.query('revoke select on auth.users from helpdesk_operator');if(!hadUsage)await control.query('revoke usage on schema auth from helpdesk_operator');
   await ready();
  }
 });
}
