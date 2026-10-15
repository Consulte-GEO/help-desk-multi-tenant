/** Genuine owned app sessions only. No challenge or decision is made on read. */
import assert from 'node:assert/strict';import type {TestContext} from 'node:test';import type {Principal} from '../../src/domain/model.ts';import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {createPostgresSupportReviewQueries} from '../../src/infrastructure/support-review-portal.ts';import {runTransaction} from '../../src/infrastructure/transaction.ts';
type Queries=ReturnType<typeof createPostgresSupportReviewQueries>;
export async function assertOwnedReviewPortal(suite:TestContext,operator:SqlPool,app:SqlPool,queries:Queries,input:{agent:Principal;customer:Principal;ticketId:string;invitationId:string;oldTicketId:string;readAssured:<T>(work:(person:Principal,proof:unknown)=>Promise<T>)=>Promise<T>}){
 const {agent,customer,ticketId,invitationId,oldTicketId,readAssured}=input,w=agent.workspaceId;
 await suite.test('the authenticated old profile has no invented review context',async()=>assert.equal(await queries.readReviewContext(customer,oldTicketId),null));
 await suite.test('portal reads select only current approver navigation and public pinned answers without preparing a challenge',async()=>{
  const before=(await operator.query('select count(*)::int as n from helpdesk_audit.hdnr_challenges where workspace_id=$1',[w])).rows[0]!.n;
  const staff=await queries.readReviewContext(agent,ticketId) as any,requester=await queries.readReviewContext(customer,ticketId) as any;
  assert.equal(staff.context.invitationId,invitationId);assert.equal(staff.capabilities.decideApproval,true);assert.equal(staff.context.version,1);assert.equal(staff.context.formRevision,1);
  assert.equal(requester.context.invitationId,null);assert.equal(requester.capabilities.decideApproval,false);assert.equal(requester.capabilities.reviseForm,false);assert.equal(requester.capabilities.requestApproval,false);
  assert.deepEqual(await queries.readApprovalLanding(agent,invitationId),{workspaceId:w,ticketId,invitationId});
  await assert.rejects(queries.readApprovalLanding(customer,invitationId),{code:'approval_forbidden'});
  assert.deepEqual(requester.form.answers,{details:'Owned pending approval details, never mailed'});assert.equal(requester.form.definition.version,2);assert.equal(requester.decision,null);
  assert.doesNotMatch(JSON.stringify(staff),/hd_approval_|"challenge"|"targetHash"|"roster"/);
  assert.equal((await operator.query('select count(*)::int as n from helpdesk_audit.hdnr_challenges where workspace_id=$1',[w])).rows[0]!.n,before);
 });
 await suite.test('delivery attention requires actual MFA and current administrator work authority without producing notifications',async()=>{
  const before=(await operator.query('select count(*)::int as n from helpdesk_integration.outbox_events where workspace_id=$1',[w])).rows[0]!.n;
  await assert.rejects(queries.readDeliveryAttention(agent,ticketId,undefined),{code:'review_step_up_required'});
  await assert.rejects(runTransaction(app,customer,c=>c.query('select helpdesk_auth.hdn_notification_attention($1)',[ticketId])),{code:'HDR01'});
  const panel=await readAssured(async(person,proof)=>{await assert.rejects(queries.readDeliveryAttention(agent,ticketId,proof),{code:'review_step_up_required'});return queries.readDeliveryAttention(person,ticketId,proof);}) as any;
  assert.equal(panel.ticketId,ticketId);assert.equal(panel.resendAvailable,false);assert.equal(panel.limit,20);assert.ok(panel.items.length<=20);
  assert.doesNotMatch(JSON.stringify(panel),/example.invalid|providerMessageId|contactHash|leaseId|hd_approval_/);
  assert.equal((await operator.query('select count(*)::int as n from helpdesk_integration.outbox_events where workspace_id=$1',[w])).rows[0]!.n,before);
 });
}
