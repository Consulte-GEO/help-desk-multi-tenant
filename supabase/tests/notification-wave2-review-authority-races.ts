/** Two real owned PG17 sessions; no network provider or synthetic SQL result. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {Principal} from '../../src/domain/model.ts';import type {SqlPool} from '../../src/infrastructure/sql.ts';import {runTransaction} from '../../src/infrastructure/transaction.ts';
export async function assertOwnedReviewAuthorityGuards(suite:TestContext,operator:SqlPool,app:SqlPool,input:{agent:Principal;accountId:string;ticketId:string;profileVersionId:string}){
 const {agent,accountId,ticketId,profileVersionId}=input,w=agent.workspaceId;
 assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
 const grantSql="select helpdesk_auth.hdnr_grant($1,'approvals.decide',helpdesk_auth.cg_lock_ticket_scope($1,'tickets.write')-'ticketId') as result";
 const publishSql=`insert into helpdesk_auth.hdnr_rosters(workspace_id,account_id,profile_version_id,revision,approver_id,active,work_ids,expires_at,request_id,reason)
  select workspace_id,account_id,profile_version_id,revision+1,approver_id,$4,work_ids,clock_timestamp()+interval '10 minutes',$5,'Owned actual authority race qualification'
  from helpdesk_auth.hdnr_rosters where(workspace_id,account_id,profile_version_id)=($1,$2,$3) order by revision desc limit 1`;
 const publish=(active:boolean)=>operator.query(publishSql,[w,accountId,profileVersionId,active,randomUUID()]);
 await suite.test('authority publication cannot overtake an already authorized review transaction',async()=>{
  let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  const held=runTransaction(app,agent,async c=>{await c.query(grantSql,[ticketId]);entered();await gate;});
  const c=await operator.connect();
  try{
   await Promise.race([ready,held.then(()=>{throw Error('Review transaction did not hold its authorization');})]);
   await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='200ms'");
   await assert.rejects(c.query(publishSql,[w,accountId,profileVersionId,false,randomUUID()]),{code:'55P03'},'a roster change overtook the active authorization');
  }finally{await c.query('ROLLBACK');c.release();release();await held;}
 });
 await suite.test('an inactive latest roster revokes the previous approver even while its individual capability remains active',async()=>{
  await publish(false);
  try{await assert.rejects(runTransaction(app,agent,c=>c.query(grantSql,[ticketId])),{code:'HDR05'});}
  finally{await publish(true);}
  assert.equal((await runTransaction(app,agent,c=>c.query(grantSql,[ticketId]))).rows[0]!.result!==null,true);
 });
}
