import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import {planConsulteGeoInitialOperation} from '../../src/application/consultegeo-initial-operation.ts';
import {planConsulteGeoLocalProvisioning} from '../../src/application/consultegeo-local-provisioning.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {createConsulteGeoRequestCatalog} from '../../src/application/consultegeo-request-catalog.ts';
import {createFormDraftService} from '../../src/application/form-draft.ts';import {createSupportIntake} from '../../src/application/support-intake.ts';
import {createPostgresConsulteGeoIntakeStore,createPostgresConsulteGeoDraftDirectory} from '../../src/infrastructure/consultegeo-intake-store.ts';
import {createDurablePostgresSupportWorkflow} from '../../src/infrastructure/support-workflow-store.ts';
import {createOwnedWave2AudienceFixture} from './notification-wave2-audience-fixture.ts';
import {assertOwnedWave2ApprovalOpening} from './notification-wave2-review-fixture.ts';
import {WAVE2_PUBLIC_TEMPLATES} from '../../src/integrations/notifications/wave2-templates.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import {assertOwnedWave2Publication} from './notification-wave2-publication-fixture.ts';
/** Final journey in an owned disposable cluster. Real ordinary app sessions see the
 * committed candidate. Schema/upgrade readiness remains a separate release gate. */
export function registerWave2JourneySqlTests(operatorPool:()=>SqlPool,controlPool:()=>SqlPool,appPool:()=>SqlPool){
 test('wave2 private projection follows genuine opening transfer and customer reply commits',async suite=>{
  const operator=operatorPool(),control=controlPool(),app=appPool();
  assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  assert.equal((await operator.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.25.0','Use the actual eighteenth migration, never reapply candidate bodies');
  const hadAuth=Boolean((await control.query("select to_regclass('auth.users') as users")).rows[0]?.users);
  if(!hadAuth){await control.query('create schema if not exists auth');await control.query('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz)');}
  await control.query('grant usage on schema auth to helpdesk_operator');
  // Synthetic Auth belongs to control, unlike the qualified real operator.
  // SELECT FOR SHARE needs UPDATE on at least one column; no normal role gains it.
  await control.query('grant select,update(email) on auth.users to helpdesk_operator');
  assert.equal((await control.query("select has_table_privilege('helpdesk_notification_worker','auth.users','SELECT,UPDATE') as allowed")).rows[0]!.allowed,false);
  const w=randomUUID(),staff=randomUUID(),staffAuth=randomUUID(),requester=randomUUID(),requesterAuth=randomUUID();
  const email='wave2-staff-'+staffAuth+'@example.invalid';
  await operator.query("insert into helpdesk_core.workspaces(id,name) values($1,'Owned wave2 acceptance')",[w]);
  for(const [person,user,address] of [[staff,staffAuth,email],[requester,requesterAuth,'wave2-requester-'+requesterAuth+'@example.invalid']]){
   await operator.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,user]);
   await control.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp()-interval '1 second')",[user,address]);
  }
  await operator.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[w,staff]);
  await operator.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'],0,'Owned staff scope qualification',$3)",[w,staff,randomUUID()]);
  const input={workspaceId:w,administratorId:staff,administratorEmail:email,requestId:randomUUID(),accountId:randomUUID(),accountName:'Owned wave2 account',workId:randomUUID(),workName:'Owned wave2 work',productId:randomUUID(),productInstanceId:randomUUID(),connectionId:randomUUID(),bindingId:randomUUID(),contractId:randomUUID(),contractVersionId:randomUUID(),configurationIds:[randomUUID(),randomUUID(),randomUUID()],coverageIds:[randomUUID(),randomUUID(),randomUUID()],calendar:{startDate:new Date(Date.now()-86400000).toISOString().slice(0,10),endDate:new Date(Date.now()+180*86400000).toISOString().slice(0,10),holidays:[]},reason:'Owned native acceptance of wave2 projections'};
  const initial=planConsulteGeoInitialOperation(input);await operator.query(initial.sql,[...initial.values]);
  await operator.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'requester')",[w,input.accountId,requester]);
  await operator.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read','tickets:write'],0,'Owned requester scope qualification',$3)",[w,requester,randomUUID()]);
  const local=JSON.parse(initial.values[0] as string).local;
  const extended=planConsulteGeoLocalProvisioning({workspaceId:w,expectedRegistryRevision:1,requestId:randomUUID(),reason:'Owned requester access for native wave2 journey',accounts:local.accounts,works:local.works,permissions:[...local.permissions,...['tickets.read','tickets.write'].map(operation=>({accountId:input.accountId,principalId:requester,role:'requester',operation,active:true,workIds:[input.workId]}))]});
  await operator.query(extended.sql,[...extended.values]);
  const customer:Principal={id:requester,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:input.accountId,role:'requester'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
  const agent:Principal={...customer,id:staff,workspaceRole:'admin',grants:[{accountId:input.accountId,role:'agent'}],scopes:['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']};
  const audience=await createOwnedWave2AudienceFixture(suite,operator,control,{workspaceId:w,accountId:input.accountId,staffId:staff,requesterId:requester,unprepared:true});
  const source=createPostgresLocalConsulteGeoSourcePorts(app),contexts=await source.readRequestContexts(customer,new AbortController().signal),refs=[contexts[0]!.works[0]!.ref];
  const options={pool:app,resolver:source.resolver,createStore:createPostgresConsulteGeoIntakeStore,directory:createPostgresConsulteGeoDraftDirectory(app),draftTtlSeconds:600};
  const catalog=await createConsulteGeoRequestCatalog(options).read(customer,{service:'questions',refs}),entry=catalog.configurations[0]!.entries[0]!;
  const darkDraft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:input.accountId,refs,formId:entry.form.id,formVersion:1,answers:{details:'Owned dark promotion interval'}},0);
  const darkIntake=createSupportIntake(options),darkQuery={draftId:darkDraft.id,expectedDraftRevision:1,subject:'Owned dark deployment interval',description:'A new group must not stop the existing worker',coverageId:null},darkPreview=await darkIntake.previewSupportRequest(customer,darkQuery),darkOpened=await darkIntake.createSupportRequest(customer,{...darkQuery,previewHash:darkPreview.previewHash},randomUUID(),randomUUID());
  await suite.test('an unprepared new group seals no recipients and does not prevent claiming an existing first-wave intent',async()=>{
   const root=(await operator.query('select id from helpdesk_integration.outbox_events where workspace_id=$1 and ticket_id=$2',[w,darkOpened.ticketId])).rows[0]!;
   const legacy=await audience.materialize(String(root.id));assert.equal(legacy.records.length,1);assert.equal(legacy.records[0]!.intent.kind,'support.created');
   const at=String((await operator.query('select helpdesk_auth.hdn_workflow_iso(clock_timestamp()) as at')).rows[0]!.at);
   const plans=await audience.store.materializePending(at,1);assert.equal(plans.length,1);assert.equal(plans[0]!.state,'no_recipients');
   const claimed=await audience.claimFor(legacy.records[0]!.intent.id);assert.equal((await audience.authorize(claimed)).decision,'allowed');
  });
  await audience.prepare();
  const draft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:input.accountId,refs,formId:entry.form.id,formVersion:1,answers:{details:'Owned native details; never included in email'}},0);
  const intake=createSupportIntake(options),q={draftId:draft.id,expectedDraftRevision:1,subject:'Owned wave2 qualification',description:'Private source isolation probe',coverageId:null},preview=await intake.previewSupportRequest(customer,q),opened=await intake.createSupportRequest(customer,{...q,previewHash:preview.previewHash},randomUUID(),randomUUID());
  const rows=async(kind:string)=>(await operator.query('select * from helpdesk_integration.hdn_notification_private_sources where workspace_id=$1 and ticket_id=$2 and kind=$3',[w,opened.ticketId,kind])).rows;
  await suite.test('one opening creates one minimal private queue source in its genuine request transaction',async()=>{
   const queue=await rows('internal.queue_created');assert.equal(queue.length,1,'opening queue projection is missing');assert.equal(queue[0]!.source_version,1);assert.equal(queue[0]!.assigned_principal_id,null);
   const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[queue[0]!.id])).rows[0]!.result as any;
   assert.equal(facts.source.type,'internal.queue_created');assert.equal(facts.requesterId,requester);assert.equal(facts.protocol,opened.protocol);assert.doesNotMatch(JSON.stringify(facts),/Private source isolation probe|Owned native details|body|notes/);
  });
  let queueClaim:Awaited<ReturnType<typeof audience.claim>>;
  await suite.test('worker enumerates the private source and materializes only the qualified explicit staff member',async()=>{
   const queue=(await rows('internal.queue_created'))[0]!;
   assert.deepEqual((await audience.worker.query('select helpdesk_auth.hdn_notification_sources(1) as ids')).rows[0]!.ids,[queue.id]);
   const saved=await audience.materialize(String(queue.id));assert.deepEqual(saved.records.map(r=>r.intent.recipientId),[staff]);assert.equal(saved.records[0]!.intent.kind,'internal.queue_created');
   queueClaim=await audience.claim();assert.equal(queueClaim.intent.recipientId,staff);const proof=await audience.authorize(queueClaim);assert.equal(proof.decision,'allowed');assert.equal(proof.address,email);
  });
  await suite.test('already queued delivery loses authority when its current published route pauses or excludes the recipient',async()=>{
   const kind='internal.queue_created';
   const original=(await operator.query('select * from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind=$2 order by revision desc limit 1',[w,kind])).rows[0]!;
   const publish=async(audienceName:string,people:string[])=>operator.query(`insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids)
    select workspace_id,kind,revision+1,$3,$4,$5,$6,$7,$8::uuid[] from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind=$2 order by revision desc limit 1`,[w,kind,audienceName,audienceName==='none'?null:original.template_id,audienceName==='none'?null:original.template_version,original.expires_at,original.effective_after,people]);
   for(const [name,people] of [['none',[staff,requester]],['queue',[requester]]] as const){
    await publish(name,[...people]);
    try{const denied=await audience.authorize(queueClaim);assert.equal(denied.decision,'revoked');assert.equal(denied.address,null);}
    finally{await publish('queue',[staff,requester].sort());}
    assert.equal((await audience.authorize(queueClaim)).decision,'allowed');
   }
  });
  await suite.test('current local publication rechecks the exact work and permission before releasing a queued address',async()=>{
   const canonical=JSON.parse(extended.values[0] as string);let registryRevision=2;
   const publish=async(overrides:{works?:typeof canonical.works;permissions?:typeof canonical.permissions})=>{
    const plan=planConsulteGeoLocalProvisioning({workspaceId:w,expectedRegistryRevision:registryRevision,requestId:randomUUID(),reason:'Owned queued recipient revocation qualification',accounts:canonical.accounts,works:overrides.works??canonical.works,permissions:overrides.permissions??canonical.permissions});
    await operator.query(plan.sql,[...plan.values]);registryRevision++;
   };
   const deniedStates=[
    {works:canonical.works.map((work:any)=>({...work,active:false}))},
    {permissions:canonical.permissions.map((permission:any)=>permission.principalId===staff&&permission.operation==='tickets.write'?{...permission,active:false}:permission)},
    {permissions:canonical.permissions.map((permission:any)=>permission.principalId===staff&&permission.operation==='tickets.write'?{...permission,workIds:[]}:permission)},
   ];
   for(const state of deniedStates){
    await publish(state);
    try{const denied=await audience.authorize(queueClaim);assert.equal(denied.decision,'revoked');assert.equal(denied.address,null);}
    finally{await publish({});}
    assert.equal((await audience.authorize(queueClaim)).decision,'allowed');
   }
  });
  const flow=createDurablePostgresSupportWorkflow({pool:app,resolver:source.resolver});
  let receipt=await flow.execute(agent,opened.ticketId,refs,{action:'start',expectedVersion:1},randomUUID(),randomUUID());
  await suite.test('staff start has its own qualified public kind',async()=>{const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.transition');assert.equal(facts.wave2Eligible,true);});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'transfer',expectedVersion:receipt.version,targetPrincipalId:staff,reason:'Owned assignment qualification'},randomUUID(),randomUUID());
  await suite.test('transfer emits one private assignment projection and never a public assignment outbox',async()=>{const assigned=await rows('internal.assignment_changed');assert.equal(assigned.length,1);assert.equal(assigned[0]!.assigned_principal_id,staff);assert.equal(assigned[0]!.parent_event_id,receipt.eventId);assert.equal((await operator.query('select count(*)::int as n from helpdesk_integration.outbox_events where id=$1',[receipt.eventId])).rows[0]!.n,0);});
  await suite.test('queued new-ticket notice is revoked after the ticket is assigned',async()=>{assert.ok(queueClaim);const proof=await audience.authorize(queueClaim);assert.equal(proof.decision,'revoked');assert.equal(proof.address,null);});
  await suite.test('assignment intent stays bound to the actual staff recipient',async()=>{const source=(await rows('internal.assignment_changed'))[0]!;const saved=await audience.materialize(String(source.id));assert.deepEqual(saved.records.map(r=>r.intent.recipientId),[staff]);assert.equal(saved.records[0]!.intent.kind,'internal.assignment_changed');});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'reply',expectedVersion:receipt.version,body:'Owned public answer excluded from mail'},randomUUID(),randomUUID());
  await suite.test('ordinary reply no longer becomes a request for customer information',async()=>{const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.reply');assert.doesNotMatch(JSON.stringify(facts),/Owned public answer|body/);});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'request_customer',expectedVersion:receipt.version,body:'Owned customer information request'},randomUUID(),randomUUID());
  receipt=await flow.execute(customer,opened.ticketId,refs,{action:'customer_reply',expectedVersion:receipt.version,body:'Owned requester return excluded from mail'},randomUUID(),randomUUID());
  await suite.test('customer reply pins the actual responsible staff and keeps conversation private',async()=>{const returned=await rows('support.customer_reply');assert.equal(returned.length,1);assert.equal(returned[0]!.id,receipt.eventId);assert.equal(returned[0]!.assigned_principal_id,staff);const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.customer_reply');assert.equal(facts.sourceAssigneeId,staff);assert.doesNotMatch(JSON.stringify(facts),/Owned requester return|body|notes/);});
  await suite.test('customer return goes to its pinned staff recipient and never the requester',async()=>{const saved=await audience.materialize(receipt.eventId);assert.deepEqual(saved.records.map(r=>r.intent.recipientId),[staff]);assert.ok(saved.records.every(r=>r.intent.recipientId!==requester));});
  await assertOwnedWave2ApprovalOpening(suite,operator,app,{agent,customer,staffAuth,workId:input.workId,oldTicketId:opened.ticketId,formId:entry.form.id,audience,control,local:JSON.parse(extended.values[0] as string)});
  await suite.test('expired finite route seals an actual public reply without delivery or later backfill',async()=>{
   const template=WAVE2_PUBLIC_TEMPLATES.find(t=>t.kind==='support.reply')!;
   await operator.query('insert into helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) values($1,$2,$3,$4,$5)',[template.id,template.version,template.kind,template,requestHash(template)]);
   await operator.query("insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids) values($1,'support.reply',2,'requester',$2,1,clock_timestamp()+interval '10 minutes',clock_timestamp(),$3::uuid[])",[w,template.id,[requester]]);
   receipt=await flow.execute(agent,opened.ticketId,refs,{action:'reply',expectedVersion:receipt.version,body:'Owned expired route probe; never sent'},randomUUID(),randomUUID());
   await operator.query("insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids) select workspace_id,kind,revision+1,audience,template_id,template_version,clock_timestamp()+interval '500 milliseconds',effective_after,recipient_ids from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind='support.reply' order by revision desc limit 1",[w]);
   await operator.query('select pg_sleep(0.7)');
   const first=await audience.materialize(receipt.eventId);assert.equal(first.plan.state,'no_recipients');assert.deepEqual(first.records,[]);
   await operator.query("insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids) select workspace_id,kind,revision+1,audience,template_id,template_version,clock_timestamp()+interval '10 minutes',effective_after,recipient_ids from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind='support.reply' order by revision desc limit 1",[w]);
   assert.deepEqual(await audience.materialize(receipt.eventId),first);
  });
  await suite.test('an expired explicit queue roster suppresses a genuine new ticket without blocking the worker',async()=>{
   const newDraft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:input.accountId,refs,formId:entry.form.id,formVersion:2,answers:{details:'Owned expired staff roster qualification'}},0);
   const query={draftId:newDraft.id,expectedDraftRevision:1,subject:'Owned queue expiry qualification',description:'No delivery expected for expired roster',coverageId:null},freshPreview=await intake.previewSupportRequest(customer,query);
   await operator.query("insert into helpdesk_integration.hdn_notification_queue_rosters(workspace_id,account_id,revision,member_ids,max_recipients,expires_at,request_id,reason) select workspace_id,account_id,revision+1,member_ids,max_recipients,clock_timestamp()+interval '500 milliseconds',$3,'Owned finite roster expiry' from helpdesk_integration.hdn_notification_queue_rosters where workspace_id=$1 and account_id=$2 order by revision desc limit 1",[w,input.accountId,randomUUID()]);
   const fresh=await intake.createSupportRequest(customer,{...query,previewHash:freshPreview.previewHash},randomUUID(),randomUUID());await operator.query('select pg_sleep(0.7)');
   const event=(await operator.query("select id from helpdesk_integration.hdn_notification_private_sources where workspace_id=$1 and ticket_id=$2 and kind='internal.queue_created'",[w,fresh.ticketId])).rows[0]!;
   const saved=await audience.materialize(String(event.id));assert.equal(saved.plan.state,'no_recipients');assert.deepEqual(saved.records,[]);
  });
  await suite.test('operator recipes qualify against genuine current participants and local publication',publicationSuite=>assertOwnedWave2Publication(publicationSuite,operator,{workspaceId:w,accountId:input.accountId,staffId:staff,requesterId:requester,workId:input.workId},audience.worker));
 });
}
