import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import {planConsulteGeoInitialOperation} from '../../src/application/consultegeo-initial-operation.ts';
import {planConsulteGeoLocalProvisioning} from '../../src/application/consultegeo-local-provisioning.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {createConsulteGeoRequestCatalog} from '../../src/application/consultegeo-request-catalog.ts';
import {createFormDraftService} from '../../src/application/form-draft.ts';import {createSupportIntake} from '../../src/application/support-intake.ts';
import {createPostgresConsulteGeoIntakeStore,createPostgresConsulteGeoDraftDirectory} from '../../src/infrastructure/consultegeo-intake-store.ts';
import {createDurablePostgresSupportWorkflow} from '../../src/infrastructure/support-workflow-store.ts';
/** Last suite in an owned disposable cluster. Real ordinary app sessions see the
 * committed candidate. Schema/upgrade readiness remains a separate release gate. */
export function registerWave2JourneySqlTests(operatorPool:()=>SqlPool,controlPool:()=>SqlPool,appPool:()=>SqlPool){
 test('wave2 private projection follows genuine opening transfer and customer reply commits',async suite=>{
  const operator=operatorPool(),control=controlPool(),app=appPool();
  assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  await operator.query('BEGIN');try{
   for(const file of ['hdn_notification_wave2_public.sql','hdn_notification_wave2_internal.sql'])await operator.query(await readFile(new URL('../candidates/'+file,import.meta.url),'utf8'));
   await operator.query('COMMIT');
  }catch(e){await operator.query('ROLLBACK');throw e;}
  const hadAuth=Boolean((await control.query("select to_regclass('auth.users') as users")).rows[0]?.users);
  if(!hadAuth){await control.query('create schema if not exists auth');await control.query('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz)');}
  await control.query('grant usage on schema auth to helpdesk_operator');await control.query('grant select on auth.users to helpdesk_operator');
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
  const source=createPostgresLocalConsulteGeoSourcePorts(app),contexts=await source.readRequestContexts(customer,new AbortController().signal),refs=[contexts[0]!.works[0]!.ref];
  const options={pool:app,resolver:source.resolver,createStore:createPostgresConsulteGeoIntakeStore,directory:createPostgresConsulteGeoDraftDirectory(app),draftTtlSeconds:600};
  const catalog=await createConsulteGeoRequestCatalog(options).read(customer,{service:'questions',refs}),entry=catalog.configurations[0]!.entries[0]!;
  const draft=await createFormDraftService(options).saveFormDraft(customer,{id:randomUUID(),accountId:input.accountId,refs,formId:entry.form.id,formVersion:1,answers:{details:'Owned native details; never included in email'}},0);
  const intake=createSupportIntake(options),q={draftId:draft.id,expectedDraftRevision:1,subject:'Owned wave2 qualification',description:'Private source isolation probe',coverageId:null},preview=await intake.previewSupportRequest(customer,q),opened=await intake.createSupportRequest(customer,{...q,previewHash:preview.previewHash},randomUUID(),randomUUID());
  const rows=async(kind:string)=>(await operator.query('select * from helpdesk_integration.hdn_notification_private_sources where workspace_id=$1 and ticket_id=$2 and kind=$3',[w,opened.ticketId,kind])).rows;
  await suite.test('one opening creates one minimal private queue source in its genuine request transaction',async()=>{
   const queue=await rows('internal.queue_created');assert.equal(queue.length,1,'opening queue projection is missing');assert.equal(queue[0]!.source_version,1);assert.equal(queue[0]!.assigned_principal_id,null);
   const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[queue[0]!.id])).rows[0]!.result as any;
   assert.equal(facts.source.type,'internal.queue_created');assert.equal(facts.requesterId,requester);assert.equal(facts.protocol,opened.protocol);assert.doesNotMatch(JSON.stringify(facts),/Private source isolation probe|Owned native details|body|notes/);
  });
  const flow=createDurablePostgresSupportWorkflow({pool:app,resolver:source.resolver});
  let receipt=await flow.execute(agent,opened.ticketId,refs,{action:'start',expectedVersion:1},randomUUID(),randomUUID());
  await suite.test('staff start has its own qualified public kind',async()=>{const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.transition');assert.equal(facts.wave2Eligible,true);});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'transfer',expectedVersion:receipt.version,targetPrincipalId:staff,reason:'Owned assignment qualification'},randomUUID(),randomUUID());
  await suite.test('transfer emits one private assignment projection and never a public assignment outbox',async()=>{const assigned=await rows('internal.assignment_changed');assert.equal(assigned.length,1);assert.equal(assigned[0]!.assigned_principal_id,staff);assert.equal(assigned[0]!.parent_event_id,receipt.eventId);assert.equal((await operator.query('select count(*)::int as n from helpdesk_integration.outbox_events where id=$1',[receipt.eventId])).rows[0]!.n,0);});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'reply',expectedVersion:receipt.version,body:'Owned public answer excluded from mail'},randomUUID(),randomUUID());
  await suite.test('ordinary reply no longer becomes a request for customer information',async()=>{const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.reply');assert.doesNotMatch(JSON.stringify(facts),/Owned public answer|body/);});
  receipt=await flow.execute(agent,opened.ticketId,refs,{action:'request_customer',expectedVersion:receipt.version,body:'Owned customer information request'},randomUUID(),randomUUID());
  receipt=await flow.execute(customer,opened.ticketId,refs,{action:'customer_reply',expectedVersion:receipt.version,body:'Owned requester return excluded from mail'},randomUUID(),randomUUID());
  await suite.test('customer reply pins the actual responsible staff and keeps conversation private',async()=>{const returned=await rows('support.customer_reply');assert.equal(returned.length,1);assert.equal(returned[0]!.id,receipt.eventId);assert.equal(returned[0]!.assigned_principal_id,staff);const facts=(await operator.query('select helpdesk_auth.hdn_notification_facts($1) as result',[receipt.eventId])).rows[0]!.result as any;assert.equal(facts.source.type,'support.customer_reply');assert.equal(facts.sourceAssigneeId,staff);assert.doesNotMatch(JSON.stringify(facts),/Owned requester return|body|notes/);});
 });
}
