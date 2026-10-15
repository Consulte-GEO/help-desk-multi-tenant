/** Owned PG17 only. Genuine app transactions; synthetic Auth is confined to this fixture. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import {createAuthentication,assertAdministrativeAssurance} from '../../src/infrastructure/authentication.ts';
import {createConsulteGeoConfigurationAdministration} from '../../src/application/consultegeo-configuration.ts';
import {createPostgresConsulteGeoConfigurationStore} from '../../src/infrastructure/consultegeo-configuration-store.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {createPostgresConsulteGeoIntakeStore,createPostgresConsulteGeoDraftDirectory} from '../../src/infrastructure/consultegeo-intake-store.ts';
import {createConsulteGeoRequestCatalog} from '../../src/application/consultegeo-request-catalog.ts';
import {createFormDraftService} from '../../src/application/form-draft.ts';import {createSupportIntake} from '../../src/application/support-intake.ts';
import {requestHash,secretHash} from '../../src/domain/canonical.ts';
import {assertOwnedPendingOpeningFaults} from './notification-wave2-opening-faults.ts';
import {createSupportReview} from '../../src/application/support-review.ts';
import {createPostgresSupportReviewStore} from '../../src/infrastructure/support-review-store.ts';
import type {ExternalResourceRef} from '../../src/domain/external-resource.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
export async function assertOwnedWave2ApprovalOpening(suite:TestContext,operator:SqlPool,app:SqlPool,input:{agent:Principal;customer:Principal;staffAuth:string;workId:string;oldTicketId:string;formId:string}){
 const {agent,customer,staffAuth,workId,oldTicketId,formId}=input,w=agent.workspaceId,a=customer.grants[0]!.accountId;
 await suite.test('a new published form and immutable policy create a genuine pending-approval ticket without altering earlier tickets',async openingSuite=>{
  assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  const configurationSponsor=randomUUID();
  await operator.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[configurationSponsor,randomUUID()]);
  for(const capability of ['forms.read','forms.write','forms.publish'])await operator.query("insert into helpdesk_auth.hdn_cfg_capabilities values($1,$2,$3,$4,1,'Owned explicit configuration qualification policy','WAVE2-NATIVE',$5,null,true)",[randomUUID(),w,agent.id,capability,configurationSponsor]);
  // This mirrors the existing native configuration suite: only the provider is
  // synthetic. Actual application role, capability store, publication and CAS run.
  const auth=createAuthentication({query:async()=>({rows:[{principal:agent}],rowCount:1}),connect:async()=>{throw Error('Unexpected fixture authentication connection');},end:async()=>{}},{supabaseUrl:'https://auth.example.invalid',publishableKey:'synthetic'},async()=>Response.json({id:staffAuth,factors:[{id:randomUUID(),status:'verified',factor_type:'totp'}]}));
  const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:staffAuth,aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
  const request=new Request('https://helpdesk.example.invalid/v1/admin/consultegeo/configurations',{headers:{authorization:'Bearer '+token,'x-workspace-id':w}});
  const administration=createConsulteGeoConfigurationAdministration({store:createPostgresConsulteGeoConfigurationStore(app)});
  const revision=async()=>Number((await operator.query('select revision from helpdesk_core.hdn_cfg_catalog where workspace_id=$1',[w])).rows[0]!.revision);
  const original=(await operator.query("select id,version,revision from helpdesk_core.hdn_cfg_versions where workspace_id=$1 and status='published' and exists(select 1 from jsonb_array_elements(artifacts->'entries') e where e->'form'->>'id'=$2)",[w,formId])).rows[0]!;
  const run=(command:unknown)=>auth.withAdministrativeAssurance(request,(person,proof)=>administration.execute(person,proof,command,randomUUID()));
  const restored=await run({action:'restore',id:original.id,version:original.version,expectedRevision:await revision(),expectedEntityRevision:original.revision,reason:'Owned new version for initial approval policy'});
  const published=await run({action:'publish',id:original.id,version:restored.record.version,expectedRevision:await revision(),expectedEntityRevision:restored.record.revision,reason:'Owned approval form publication'});
  const record=published.record,entry=record.artifacts!.entries.find(e=>e.form.id===formId)!;
  assert.equal(entry.form.version,2);
  const policy={versionId:'cg_initial_approval_v1',status:'published',selfApprovalAllowed:false,sensitive:true,onApproved:'open',onRejected:'waiting_customer',challengeTtlSeconds:300};
  await operator.query(`insert into helpdesk_core.hdnr_policies(workspace_id,account_id,version_id,document,sha256,request_id,reason) values($1,$2,$3,$4,$5,$6,'Owned exact initial approval policy')`,[w,a,policy.versionId,policy,requestHash(policy),randomUUID()]);
  await operator.query(`insert into helpdesk_core.hdnr_profiles(workspace_id,account_id,profile_version_id,configuration_id,configuration_version,configuration_hash,form_id,form_version,schema_hash,policy_version_id,required_for,work_ids,request_id,reason)
   values($1,$2,$3,$4,$5,$6,$7,$5,$8,$9,$10::uuid[],$11::text[],$12,'Owned separately published approval profile')`,[w,a,entry.workflow.versionId,record.id,record.version,record.contentHash,formId,requestHash(entry.form),policy.versionId,[customer.id],[workId],randomUUID()]);
  const source=createPostgresLocalConsulteGeoSourcePorts(app),contexts=await source.readRequestContexts(customer,new AbortController().signal),refs=[contexts[0]!.works[0]!.ref];
  const diagnose=async<T>(work:()=>Promise<T>)=>{try{return await work();}catch(error){const e=error as {code?:string;where?:string;routine?:string;constraint?:string};suite.diagnostic(JSON.stringify({fixture:'owned-review-intake',code:e.code,functions:e.where?.split('\n').filter(line=>line.startsWith('PL/pgSQL function ')).join('\n').slice(0,2000),routine:e.routine,constraint:e.constraint}));throw error;}};
  const traced:SqlPool={query:(sql,values)=>diagnose(()=>app.query(sql,values)),end:()=>app.end(),async connect(){const client=await app.connect();return {query:(sql,values)=>diagnose(()=>client.query(sql,values)),release:error=>client.release(error),on:client.on?.bind(client)};}};
  const options={pool:traced,resolver:source.resolver,createStore:createPostgresConsulteGeoIntakeStore,directory:createPostgresConsulteGeoDraftDirectory(traced),draftTtlSeconds:600};
  const catalog=await createConsulteGeoRequestCatalog(options).read(customer,{service:'questions',refs});
  assert.ok(catalog.configurations.some(c=>c.entries.some(e=>e.form.id===formId&&e.form.version===2)));
  const draft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:a,refs,formId,formVersion:2,answers:{details:'Owned pending approval details, never mailed'}},0);
  const intake=createSupportIntake(options),query={draftId:draft.id,expectedDraftRevision:1,subject:'Owned pending approval acceptance',description:'Approval must precede work',coverageId:null},preview=await intake.previewSupportRequest(customer,query);
  const opened=await intake.createSupportRequest(customer,{...query,previewHash:preview.previewHash},randomUUID(),randomUUID());
  const result=(await operator.query(`select t.status,s.approval,s.profile_version_id from helpdesk_core.tickets t join helpdesk_core.hdn_workflow_state s on(s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) where t.workspace_id=$1 and t.id=$2`,[w,opened.ticketId])).rows[0]!;
  assert.equal(result.status,'triage','native opening still ignores the published approval profile');assert.equal(result.approval,'pending');assert.equal(result.profile_version_id,entry.workflow.versionId);
  const receipt=(await operator.query('select event_id from helpdesk_audit.hdni_receipts where workspace_id=$1 and ticket_id=$2',[w,opened.ticketId])).rows[0]!;
  const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.event_id])).rows[0]!.result as any;
  assert.equal(facts.source.type,'support.created');assert.equal(facts.requesterId,customer.id);
  assert.doesNotMatch(JSON.stringify(facts),/Owned pending approval details|Approval must precede work|body|answers/);
  const old=(await operator.query("select document->'profile'->'approvalRequired' as required,document->'bundle'->'workflow'->>'approval' as approval from helpdesk_core.hdni_snapshots where workspace_id=$1 and ticket_id=$2",[w,oldTicketId])).rows[0]!;
  assert.deepEqual(old,{required:false,approval:'not_required'});
  await assertOwnedPendingOpeningFaults(openingSuite,operator,{customer,accountId:a,refs,formId,drafts:createFormDraftService(options),intake});
  await openingSuite.test('the actual review application creates one pinned approval invitation and replays its own receipt',async invitationSuite=>{
   for(const capability of ['approvals.request','approvals.decide'])await operator.query(`insert into helpdesk_auth.hdnr_grants(workspace_id,account_id,principal_id,capability,revision,active,work_ids,expires_at,request_id,reason)
    values($1,$2,$3,$4,1,true,$5::text[],clock_timestamp()+interval '10 minutes',$6,'Owned explicit approval capability')`,[w,a,agent.id,capability,[workId],randomUUID()]);
   await operator.query(`insert into helpdesk_auth.hdnr_rosters(workspace_id,account_id,profile_version_id,revision,approver_id,active,work_ids,expires_at,request_id,reason)
    values($1,$2,$3,1,$4,true,$5::text[],clock_timestamp()+interval '10 minutes',$6,'Owned exact separate approver')`,[w,a,entry.workflow.versionId,agent.id,[workId],randomUUID()]);
   const review=createSupportReview({pool:traced,resolver:source.resolver,createStore:createPostgresSupportReviewStore,assertStepUp:assertAdministrativeAssurance,directory:{async locateTicket(person,id,signal){const value=await source.directory.readTicketResources(person,id,signal??new AbortController().signal);return value as {accountId:string;refs:readonly ExternalResourceRef[]}|null;}}});
   const key=randomUUID(),requestId=randomUUID();
   const invite=()=>auth.withAdministrativeAssurance(request,(person,proof)=>review.requestApproval(person,opened.ticketId,1,key,requestId,proof));
   const created=await invite();assert.equal(created.ticketId,opened.ticketId);assert.equal(created.actorId,agent.id);assert.equal(created.formRevision,1);assert.equal(created.replayed,false);
   const replayed=await invite();assert.equal(replayed.invitationId,created.invitationId);assert.equal(replayed.replayed,true);
   const row=(await operator.query('select document from helpdesk_core.hdnr_invitations where workspace_id=$1 and id=$2',[w,created.invitationId])).rows[0]!.document as any;
   assert.equal(row.approverId,agent.id);assert.notEqual(row.approverId,customer.id);assert.equal(row.status,'pending');assert.equal(row.challenge,null);
   assert.doesNotMatch(JSON.stringify(row),/hd_approval_|Owned pending approval details|Approval must precede work/);
   await assert.rejects(review.prepareApproval(agent,opened.ticketId,created.invitationId,1,randomUUID()),{code:'review_step_up_required'});
   assert.equal((await operator.query('select count(*)::int as n from helpdesk_audit.hdnr_challenges where invitation_id=$1',[created.invitationId])).rows[0]!.n,0);
   await assert.rejects(runTransaction(app,customer,c=>c.query('select helpdesk_auth.hdnr_invitation($1)',[created.invitationId])),{code:'HDR01'});
   const prepared=await auth.withAdministrativeAssurance(request,(person,proof)=>review.prepareApproval(person,opened.ticketId,created.invitationId,1,randomUUID(),proof));
   assert.equal(prepared.decisionApplied,false);assert.equal(prepared.generation,1);assert.match(prepared.token,/^hd_approval_[A-Za-z0-9_-]{43}$/);
   const current=(await operator.query('select document from helpdesk_core.hdnr_invitations where id=$1',[created.invitationId])).rows[0]!.document as any;
   assert.equal(current.challenge.hash,secretHash(prepared.token));assert.equal(current.challenge.generation,1);assert.doesNotMatch(JSON.stringify(current),/hd_approval_/);
   assert.equal((await operator.query('select version from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,opened.ticketId])).rows[0]!.version,1,'preparing or reading an invitation must not apply a decision');
   const next={...current,challenge:{...current.challenge,generation:2}};
   await assert.rejects(runTransaction(app,agent,c=>c.query('select helpdesk_auth.hdnr_challenge($1,$2)',[next,0])),{code:'HDR02'});
   assert.equal((await operator.query('select count(*)::int as n from helpdesk_audit.hdnr_challenges where invitation_id=$1',[created.invitationId])).rows[0]!.n,1);
   const decision={ticketId:opened.ticketId,invitationId:created.invitationId,expectedVersion:1,expectedFormRevision:1,token:prepared.token,decision:'reject',reason:'Owned correction requested; keep justification out of mail'};
   const decisionKey=randomUUID(),decisionRequest=randomUUID(),decide=()=>auth.withAdministrativeAssurance(request,(person,proof)=>review.decideApproval(person,decision,decisionKey,decisionRequest,proof));
   const rejected=await decide();assert.equal(rejected.version,2);assert.equal(rejected.decision,'reject');assert.equal(rejected.replayed,false);
   const replayedDecision=await decide();assert.equal(replayedDecision.eventId,rejected.eventId);assert.equal(replayedDecision.replayed,true);
   const state=(await operator.query(`select t.status,s.approval from helpdesk_core.tickets t join helpdesk_core.hdn_workflow_state s on(s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) where t.workspace_id=$1 and t.id=$2`,[w,opened.ticketId])).rows[0]!;
   assert.deepEqual(state,{status:'waiting_customer',approval:'pending'});
   const decisionReceipt=(await operator.query("select bundle from helpdesk_audit.hdnr_receipts where workspace_id=$1 and actor_id=$2 and intent_key=$3",[w,agent.id,decisionKey])).rows[0]!.bundle as any;
   assert.equal(decisionReceipt.decision.originPermissionGranted,false);assert.equal(decisionReceipt.decision.originExecution,'not_requested');assert.doesNotMatch(JSON.stringify(decisionReceipt),/hd_approval_/);
   await invitationSuite.test('approval rejects a wrong token and authorizes only the Help Desk state without changing GEO access',async()=>{
    const draft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:a,refs,formId,formVersion:2,answers:{details:'Owned separate approval acceptance'}},0);
    const command={draftId:draft.id,expectedDraftRevision:1,subject:'Owned approved request',description:'Approval never grants external access',coverageId:null},preview=await intake.previewSupportRequest(customer,command);
    const openedApproval=await intake.createSupportRequest(customer,{...command,previewHash:preview.previewHash},randomUUID(),randomUUID());
    const invited=await auth.withAdministrativeAssurance(request,(person,proof)=>review.requestApproval(person,openedApproval.ticketId,1,randomUUID(),randomUUID(),proof));
    const challenge=await auth.withAdministrativeAssurance(request,(person,proof)=>review.prepareApproval(person,openedApproval.ticketId,invited.invitationId,1,randomUUID(),proof));
    const approval={ticketId:openedApproval.ticketId,invitationId:invited.invitationId,expectedVersion:1,expectedFormRevision:1,token:challenge.token,decision:'approve',reason:'Owned manual external action remains separate'};
    const before=(await operator.query('select revision,decision_hash from helpdesk_auth.cg_local_registries where workspace_id=$1',[w])).rows[0];
    await assert.rejects(review.decideApproval(agent,approval,randomUUID(),randomUUID()),{code:'review_step_up_required'});
    await assert.rejects(auth.withAdministrativeAssurance(request,(person,proof)=>review.decideApproval(person,{...approval,token:'hd_approval_'+Buffer.alloc(32,1).toString('base64url')},randomUUID(),randomUUID(),proof)),{code:'approval_unavailable'});
    const approved=await auth.withAdministrativeAssurance(request,(person,proof)=>review.decideApproval(person,approval,randomUUID(),randomUUID(),proof));assert.equal(approved.decision,'approve');assert.equal(approved.version,2);
    const current=(await operator.query(`select t.status,s.approval from helpdesk_core.tickets t join helpdesk_core.hdn_workflow_state s on(s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) where t.workspace_id=$1 and t.id=$2`,[w,openedApproval.ticketId])).rows[0];assert.deepEqual(current,{status:'open',approval:'approved'});
    assert.deepEqual((await operator.query('select revision,decision_hash from helpdesk_auth.cg_local_registries where workspace_id=$1',[w])).rows[0],before);
    await assert.rejects(auth.withAdministrativeAssurance(request,(person,proof)=>review.decideApproval(person,approval,randomUUID(),randomUUID(),proof)),{code:'approval_revision_changed'});
    assert.equal((await operator.query('select count(*)::int as n from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2',[w,openedApproval.ticketId])).rows[0]!.n,2);
   });
  });
 });
}
