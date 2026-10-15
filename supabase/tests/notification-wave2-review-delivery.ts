/** Actual owned worker/app sessions, no provider or production recipient. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import {requestHash} from '../../src/domain/canonical.ts';
import {WAVE2_REVIEW_TEMPLATES} from '../../src/integrations/notifications/wave2-templates.ts';
import type {createOwnedWave2AudienceFixture} from './notification-wave2-audience-fixture.ts';
type Audience=Awaited<ReturnType<typeof createOwnedWave2AudienceFixture>>;
export async function prepareOwnedReviewDelivery(operator:SqlPool,w:string,members:string[]){
 for(const t of WAVE2_REVIEW_TEMPLATES){
  await operator.query('insert into helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) values($1,$2,$3,$4,$5)',[t.id,t.version,t.kind,t,requestHash(t)]);
  await operator.query("insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids) values($1,$2,2,$3,$4,1,clock_timestamp()+interval '10 minutes',clock_timestamp(),$5::uuid[])",[w,t.kind,t.kind==='support.approval_requested'?'approver':'requester',t.id,[...members].sort()]);
 }
}
export async function assertOwnedInvitationDelivery(suite:TestContext,operator:SqlPool,audience:Audience,input:{eventId:string;invitationId:string;ticketId:string;profileVersionId:string;approverId:string}){
 const {eventId,invitationId,ticketId,profileVersionId,approverId}=input,{workspaceId:w,accountId:a}=audience.scope;
 const facts=(await audience.worker.query('select helpdesk_auth.hdn_notification_source($1) as result',[eventId])).rows[0]!.result as any;
 assert.equal(facts.type,'support.approval_requested');assert.equal(facts.invitationId,invitationId);
 assert.doesNotMatch(JSON.stringify(facts),/hd_approval_|challenge|hash|details|reason|email/);
 const enumerated=(await audience.worker.query('select helpdesk_auth.hdn_notification_sources(10) as ids')).rows[0]!.ids as string[];assert.ok(enumerated.includes(eventId));
 const saved=await audience.materialize(eventId);assert.equal(saved.records.length,1);const record=await audience.claimFor(saved.records[0]!.intent.id);
 assert.equal(record.intent.recipientId,approverId);assert.equal(record.intent.invitationId,invitationId);assert.equal((await audience.authorize(record)).decision,'allowed');
 await suite.test('a queued approval notice loses delivery authority after its exact delegation is revoked',async()=>{
  const publish=(active:boolean)=>operator.query(`insert into helpdesk_auth.hdnr_rosters(workspace_id,account_id,profile_version_id,revision,approver_id,active,work_ids,expires_at,request_id,reason)
   select workspace_id,account_id,profile_version_id,revision+1,approver_id,$4,work_ids,expires_at,$5,'Owned queued approval authority probe' from helpdesk_auth.hdnr_rosters where(workspace_id,account_id,profile_version_id)=($1,$2,$3) order by revision desc limit 1`,[w,a,profileVersionId,active,randomUUID()]);
  await publish(false);try{const revoked=await audience.authorize(record);assert.equal(revoked.decision,'revoked');assert.equal(revoked.address,null);}finally{await publish(true);}
  assert.equal((await audience.authorize(record)).decision,'allowed');
 });
 return async()=>{
  const revoked=await audience.authorize(record);assert.equal(revoked.decision,'revoked');assert.equal(revoked.address,null);
  assert.deepEqual((await audience.worker.query('select helpdesk_auth.hdn_notification_source($1) as result',[eventId])).rows[0]!.result,facts,'historical source remains available after consuming the invitation');
  assert.equal((await audience.materialize(eventId)).plan.sourceHash,saved.plan.sourceHash,'old plan does not rematerialize with current invitation state');
 };
}
export async function assertOwnedReviewResultDelivery(audience:Audience,eventId:string,kind:string){
 const saved=await audience.materialize(eventId);assert.equal(saved.records.length,1);const record=await audience.claimFor(saved.records[0]!.intent.id);
 assert.equal(record.intent.kind,kind);assert.equal(record.intent.recipientId,audience.scope.requesterId);assert.equal(record.intent.invitationId,null);
 assert.equal((await audience.authorize(record)).decision,'allowed');
 assert.doesNotMatch(JSON.stringify(record),/Owned correction|Owned pending approval details|hd_approval_|reason|answers|email/);
}
