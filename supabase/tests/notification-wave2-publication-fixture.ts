/** Genuine operator in the owned disposable PG17 cluster. No provider/Auth writes. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {planSupportReviewPublication} from '../../src/application/support-review-publication.ts';import {buildSupportReviewPublicationSql} from '../../src/infrastructure/support-review-publication-sql.ts';
import {planNotificationWave2Publication} from '../../src/application/notification-wave2-publication.ts';import {buildNotificationWave2PublicationSql} from '../../src/infrastructure/notification-wave2-publication-sql.ts';
import {WAVE2_PUBLIC_TEMPLATES,WAVE2_INTERNAL_TEMPLATES,WAVE2_REVIEW_TEMPLATES} from '../../src/integrations/notifications/wave2-templates.ts';
export async function assertOwnedWave2Publication(suite:TestContext,operator:SqlPool,scope:{workspaceId:string;accountId:string;staffId:string;requesterId:string;workId:string},admissionPool:SqlPool){
 const {workspaceId:w,accountId:a,staffId:staff,requesterId:requester,workId}=scope;
 const execute=async(sql:string)=>{const c=await operator.connect();try{return await c.query(sql);}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}};
 const source=(await operator.query("select helpdesk_auth.hdn_cfg_record(v) as record from helpdesk_core.hdn_cfg_versions v where workspace_id=$1 and definition->>'service'='backup' order by version desc limit 1",[w])).rows[0]!.record as any;
 const registry=(await operator.query('select revision,document from helpdesk_auth.hdn_cfg_registries where workspace_id=$1',[w])).rows[0]!;
 const emails=(await operator.query('select p.id,u.email from helpdesk_auth.principals p join auth.users u on u.id=p.supabase_user_id where p.id=any($1::uuid[])',[[staff,requester]])).rows;
 const participantEmail=(id:string)=>String(emails.find(e=>e.id===id)!.email);
 const grantRevision=async(person:string,cap:string)=>Number((await operator.query('select coalesce(max(revision),0)::int as revision from helpdesk_auth.hdnr_grants where workspace_id=$1 and account_id=$2 and principal_id=$3 and capability=$4',[w,a,person,cap])).rows[0]!.revision);
 const raw={workspaceId:w,accountId:a,administratorId:staff,administratorEmail:participantEmail(staff),operatorName:'helpdesk_operator',requestId:randomUUID(),reason:'Owned transactional second wave publication',requesterId:requester,requesterEmail:participantEmail(requester),approverId:staff,approverEmail:participantEmail(staff),workIds:[workId],expiresAt:new Date(Date.now()+86400000).toISOString(),expectedCatalogRevision:Number((await operator.query('select revision from helpdesk_core.hdn_cfg_catalog where workspace_id=$1',[w])).rows[0]!.revision),expectedLocalRevision:Number((await operator.query('select revision from helpdesk_auth.cg_local_registries where workspace_id=$1',[w])).rows[0]!.revision),configuration:source,registry:registry.document,registryRevision:registry.revision,formId:source.artifacts.entries[0].form.id,expectedQueueRevision:Number((await operator.query('select coalesce(max(revision),0)::int as revision from helpdesk_integration.hdn_notification_queue_rosters where workspace_id=$1 and account_id=$2',[w,a])).rows[0]!.revision),expectedGrantRevisions:{formsRevise:await grantRevision(requester,'forms.revise'),approvalsRequest:await grantRevision(staff,'approvals.request'),approvalsDecide:await grantRevision(staff,'approvals.decide')}};
 const counts=async()=>{const result:any={};for(const table of ['helpdesk_auth.principals','helpdesk_auth.workspace_memberships','helpdesk_auth.account_grants','helpdesk_auth.cg_local_permissions','helpdesk_integration.outbox_events','helpdesk_integration.hdn_notification_routes','helpdesk_core.hdn_cfg_versions','helpdesk_core.hdnr_policies','helpdesk_core.hdnr_profiles','helpdesk_auth.hdnr_grants','helpdesk_auth.hdnr_rosters','helpdesk_integration.hdn_notification_queue_rosters','helpdesk_audit.audit_events'])result[table]=(await operator.query(`select count(*)::int as n from ${table}`)).rows[0]!.n;return result;};
 const before=await counts(),plan=planSupportReviewPublication(raw),command=JSON.parse(plan.values[0]),sql=buildSupportReviewPublicationSql(plan);
 await suite.test('stale preparation refuses all effects before publishing configuration or authority',async()=>{
  const stale=planSupportReviewPublication({...raw,requestId:randomUUID(),expectedLocalRevision:raw.expectedLocalRevision-1});await assert.rejects(execute(buildSupportReviewPublicationSql(stale)),{code:'HRP03'});assert.deepEqual(await counts(),before);
 });
 await suite.test('a suppressed authority append rolls back the configuration policy queue audit and all grants',async()=>{
  const child=command.childIds.formsRevise;
  await operator.query(`create function helpdesk_auth.hdn_wave2_recipe_fault() returns trigger language plpgsql set search_path='' as $$begin if NEW.request_id='${child}'::uuid then return null;end if;return NEW;end$$`);
  try{
   await operator.query('create trigger zzz_wave2_recipe_fault before insert on helpdesk_auth.hdnr_grants for each row execute function helpdesk_auth.hdn_wave2_recipe_fault()');
   await assert.rejects(execute(sql),{code:'HRP04'});assert.deepEqual(await counts(),before);
   assert.equal(Number((await operator.query('select revision from helpdesk_core.hdn_cfg_catalog where workspace_id=$1',[w])).rows[0]!.revision),raw.expectedCatalogRevision);
  }finally{await operator.query('drop trigger if exists zzz_wave2_recipe_fault on helpdesk_auth.hdnr_grants');await operator.query('drop function helpdesk_auth.hdn_wave2_recipe_fault()');}
 });
 await suite.test('delegated native recipe atomically appends profile policy exact staff queue and three bounded grants',async()=>{
  await execute(sql);const after=await counts();
  for(const table of ['helpdesk_auth.principals','helpdesk_auth.workspace_memberships','helpdesk_auth.account_grants','helpdesk_auth.cg_local_permissions','helpdesk_integration.outbox_events','helpdesk_integration.hdn_notification_routes'])assert.equal(after[table],before[table],table+' must remain untouched');
  for(const table of ['helpdesk_core.hdn_cfg_versions','helpdesk_core.hdnr_policies','helpdesk_core.hdnr_profiles','helpdesk_auth.hdnr_rosters','helpdesk_integration.hdn_notification_queue_rosters','helpdesk_audit.audit_events'])assert.equal(after[table],before[table]+1);
  assert.equal(after['helpdesk_auth.hdnr_grants'],before['helpdesk_auth.hdnr_grants']+3);
  const queue=(await operator.query('select member_ids,max_recipients from helpdesk_integration.hdn_notification_queue_rosters where workspace_id=$1 and account_id=$2 order by revision desc limit 1',[w,a])).rows[0]!;assert.deepEqual(queue.member_ids,[staff]);assert.equal(queue.max_recipients,1);
  const profile=(await operator.query('select required_for,configuration_version from helpdesk_core.hdnr_profiles where workspace_id=$1 and account_id=$2 and profile_version_id=$3',[w,a,command.profile.profileVersionId])).rows[0]!;assert.deepEqual(profile.required_for,[requester]);assert.equal(profile.configuration_version,2);
  assert.deepEqual((await operator.query('select helpdesk_auth.hdn_cfg_record(v) as record from helpdesk_core.hdn_cfg_versions v where workspace_id=$1 and id=$2 and version=1',[w,source.id])).rows[0]!.record,source);
  await execute(sql);assert.deepEqual(await counts(),after,'same delegated receipt replay cannot duplicate or renew authority');
 });
 await suite.test('each fixed notification group prepares dark activates and pauses with CAS and immutable replay',async()=>{
  const groups={public:WAVE2_PUBLIC_TEMPLATES,team:WAVE2_INTERNAL_TEMPLATES,review:WAVE2_REVIEW_TEMPLATES};
  const recipients=[staff,requester].sort();
  for(const group of ['public','team','review'] as const){
   for(const phase of ['prepare','activate','pause'] as const){
    const observed=await operator.query('select r.*,helpdesk_auth.hdn_workflow_iso(r.effective_after) as effective_after_text,t.sha256 as template_hash from helpdesk_integration.hdn_notification_routes r left join helpdesk_integration.hdn_notification_templates t on (t.id,t.version)=(r.template_id,r.template_version) where r.workspace_id=$1 and r.kind=any($2::text[]) and r.revision=(select max(x.revision) from helpdesk_integration.hdn_notification_routes x where x.workspace_id=r.workspace_id and x.kind=r.kind)',[w,groups[group].map(t=>t.kind)]);
    const expectedRoutes=groups[group].map(t=>{const r=observed.rows.find(r=>r.kind===t.kind);return r?{kind:t.kind,revision:Number(r.revision),audience:r.audience,templateId:r.template_id,templateVersion:r.template_version,templateHash:r.template_hash,effectiveAfter:r.effective_after===null?null:String(r.effective_after_text),recipientIds:r.recipient_ids}:{kind:t.kind,revision:0,audience:'none',templateId:null,templateVersion:null,templateHash:null,effectiveAfter:null,recipientIds:null};});
    const rawGroup={workspaceId:w,administratorId:staff,administratorEmail:participantEmail(staff),operatorName:'helpdesk_operator',requestId:randomUUID(),reason:'Owned fixed group '+group+' '+phase,group,phase,recipientIds:recipients,expiresAt:new Date(Date.now()+86400000).toISOString(),expectedRoutes};
    const prepared=planNotificationWave2Publication(rawGroup),statement=buildNotificationWave2PublicationSql(prepared);
    if(group==='public'&&phase==='pause'){
     const admission=await admissionPool.connect();let completed=false;let pending:Promise<unknown>|undefined;
     try{assert.equal((await admission.query('select current_user as who')).rows[0]!.who,'helpdesk_notification_worker');await admission.query('BEGIN');await admission.query("select pg_advisory_xact_lock(hashtextextended('helpdesk-notification-ledger-v1',0))");pending=execute(statement).finally(()=>{completed=true;});await new Promise(resolve=>setTimeout(resolve,200));assert.equal(completed,false,'pause must serialize after an in-flight provider admission');await admission.query('COMMIT');}
     finally{await admission.query('ROLLBACK');admission.release();if(pending)await pending;}
    }else await execute(statement);
    const count=await counts();await execute(statement);assert.deepEqual(await counts(),count);
    const actual=await operator.query('select audience,recipient_ids from helpdesk_integration.hdn_notification_routes r where workspace_id=$1 and kind=any($2::text[]) and revision=(select max(x.revision) from helpdesk_integration.hdn_notification_routes x where x.workspace_id=r.workspace_id and x.kind=r.kind)',[w,groups[group].map(t=>t.kind)]);
    assert.equal(actual.rows.length,groups[group].length);assert.ok(actual.rows.every(r=>phase==='activate'?r.audience!=='none':r.audience==='none'));assert.ok(actual.rows.every(r=>JSON.stringify(r.recipient_ids)===JSON.stringify(recipients)));
    await assert.rejects(execute(buildNotificationWave2PublicationSql(planNotificationWave2Publication({...rawGroup,requestId:randomUUID()}))),{code:'HNP03'});assert.deepEqual(await counts(),count);
   }
  }
 });
}
