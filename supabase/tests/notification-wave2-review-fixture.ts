/** Owned PG17 only. Genuine app transactions; synthetic Auth is confined to this fixture. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import {createAuthentication} from '../../src/infrastructure/authentication.ts';
import {createConsulteGeoConfigurationAdministration} from '../../src/application/consultegeo-configuration.ts';
import {createPostgresConsulteGeoConfigurationStore} from '../../src/infrastructure/consultegeo-configuration-store.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {createPostgresConsulteGeoIntakeStore,createPostgresConsulteGeoDraftDirectory} from '../../src/infrastructure/consultegeo-intake-store.ts';
import {createConsulteGeoRequestCatalog} from '../../src/application/consultegeo-request-catalog.ts';
import {createFormDraftService} from '../../src/application/form-draft.ts';import {createSupportIntake} from '../../src/application/support-intake.ts';
import {requestHash} from '../../src/domain/canonical.ts';
export async function assertOwnedWave2ApprovalOpening(suite:TestContext,operator:SqlPool,app:SqlPool,input:{agent:Principal;customer:Principal;staffAuth:string;workId:string;oldTicketId:string;formId:string}){
 const {agent,customer,staffAuth,workId,oldTicketId,formId}=input,w=agent.workspaceId,a=customer.grants[0]!.accountId;
 await suite.test('a new published form and immutable policy create a genuine pending-approval ticket without altering earlier tickets',async()=>{
  assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
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
  const options={pool:app,resolver:source.resolver,createStore:createPostgresConsulteGeoIntakeStore,directory:createPostgresConsulteGeoDraftDirectory(app),draftTtlSeconds:600};
  const catalog=await createConsulteGeoRequestCatalog(options).read(customer,{service:'questions',refs});
  assert.ok(catalog.configurations.some(c=>c.entries.some(e=>e.form.id===formId&&e.form.version===2)));
  const draft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:a,refs,formId,formVersion:2,answers:{details:'Owned pending approval details, never mailed'}},0);
  const intake=createSupportIntake(options),query={draftId:draft.id,expectedDraftRevision:1,subject:'Owned pending approval acceptance',description:'Approval must precede work',coverageId:null},preview=await intake.previewSupportRequest(customer,query);
  const opened=await intake.createSupportRequest(customer,{...query,previewHash:preview.previewHash},randomUUID(),randomUUID());
  const result=(await operator.query(`select t.status,s.approval,s.profile_version_id from helpdesk_core.tickets t join helpdesk_core.hdn_workflow_state s on(s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) where t.workspace_id=$1 and t.id=$2`,[w,opened.ticketId])).rows[0]!;
  assert.equal(result.status,'triage','native opening still ignores the published approval profile');assert.equal(result.approval,'pending');assert.equal(result.profile_version_id,entry.workflow.versionId);
  const old=(await operator.query("select document->'profile'->'approvalRequired' as required,document->'bundle'->'workflow'->>'approval' as approval from helpdesk_core.hdni_snapshots where workspace_id=$1 and ticket_id=$2",[w,oldTicketId])).rows[0]!;
  assert.deepEqual(old,{required:false,approval:'not_required'});
 });
}
