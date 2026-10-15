/** Owned PG17 fixture only. Contacts and credentials are synthetic, no provider. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {WAVE2_INTERNAL_TEMPLATES} from '../../src/integrations/notifications/wave2-templates.ts';import {requestHash} from '../../src/domain/canonical.ts';
import {createPostgresNotificationDeliveryStore} from '../../src/infrastructure/notification-delivery-store.ts';
import {materializeNotificationIntents} from '../../src/application/notification-outbox.ts';import {parseDeliveryRecord} from '../../src/domain/notification-delivery.ts';
import {formatMicros,instantMicros} from '../../src/domain/business-calendar.ts';
export async function createOwnedWave2AudienceFixture(suite:TestContext,operator:SqlPool,control:SqlPool,scope:{workspaceId:string;accountId:string;staffId:string;requesterId:string;unprepared?:boolean}){
 const {workspaceId:w,accountId:a,staffId:staff,requesterId:requester}=scope;
 const members=[staff,requester].sort(),audiences=['queue','assignee','customer_return'];
 async function prepare(){const c=await operator.connect();try{await c.query('BEGIN');
  for(const [index,t] of WAVE2_INTERNAL_TEMPLATES.entries()){
   await c.query('insert into helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) values($1,$2,$3,$4,$5)',[t.id,t.version,t.kind,t,requestHash(t)]);
   await c.query("insert into helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids) values($1,$2,2,$3,$4,1,clock_timestamp()+interval '10 minutes',clock_timestamp(),$5::uuid[])",[w,t.kind,audiences[index],t.id,members]);
  }
  // A hostile non-operator is listed deliberately: membership is never authority.
  await c.query("insert into helpdesk_integration.hdn_notification_queue_rosters(workspace_id,account_id,revision,member_ids,max_recipients,expires_at,request_id,reason) values($1,$2,1,$3::uuid[],2,clock_timestamp()+interval '10 minutes',$4,'Owned explicit roster; role denial probe')",[w,a,members,randomUUID()]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 if(!scope.unprepared)await prepare();
 const targets=validateDatabaseTestTargets(process.env),password=randomUUID(),command=(await control.query("select format('alter role helpdesk_notification_worker login password %L',$1::text) as command",[password])).rows[0]!.command;await control.query(String(command));
 const url=new URL(targets.appUrl);url.username='helpdesk_notification_worker';url.password=password;const pg=await import('pg'),worker=new pg.Pool({connectionString:url.toString(),max:1}) as unknown as SqlPool;
 suite.after(async()=>{await worker.end();await control.query('alter role helpdesk_notification_worker nologin password null');});
 const store=createPostgresNotificationDeliveryStore(worker),clock=async()=>String((await operator.query('select helpdesk_auth.hdn_workflow_iso(clock_timestamp()) as at')).rows[0]!.at);
 async function materialize(eventId:string){const at=await clock(),plan=await store.planLocked(eventId,tx=>materializeNotificationIntents(tx,eventId,at));const records=(await operator.query('select record from helpdesk_integration.hdn_notification_records where event_id=$1 order by recipient_id',[eventId])).rows.map(r=>parseDeliveryRecord(r.record));assert.deepEqual(records.map(r=>r.intent.id).sort(),[...plan.intentIds].sort());return {plan,records};}
 async function claim(){const at=await clock(),claims=await store.claimDelivery({workerId:'owned-wave2',at,until:formatMicros(instantMicros(at)+30_000_000n),limit:1});assert.equal(claims.length,1);return parseDeliveryRecord(claims[0]);}
 const authorize=async(record:ReturnType<typeof parseDeliveryRecord>)=>{try{return await store.authority.authorize(record.intent,new AbortController().signal) as any;}catch(error){
  // Diagnose only owned fixture SQL before the store sanitizes it. Never print
  // parameters, contacts, credentials, native result rows or provider messages.
  try{await worker.query('select helpdesk_auth.hdn_notification_authorize($1) as probe',[record.intent.id]);}catch(raw){const e=raw as {code?:string;where?:string;routine?:string;table?:string};suite.diagnostic(JSON.stringify({fixture:'owned-wave2-recipient',code:e.code,where:e.where,routine:e.routine,table:e.table}));}
  throw error;
 }};
 const ownedClaims=new Map<string,ReturnType<typeof parseDeliveryRecord>>();
 async function claimFor(id:string){
  if(ownedClaims.has(id))return ownedClaims.get(id)!;
  const at=await clock(),claims=await store.claimDelivery({workerId:'owned-wave2-review',at,until:formatMicros(instantMicros(at)+180_000_000n),limit:10});
  for(const raw of claims){const row=parseDeliveryRecord(raw);ownedClaims.set(row.intent.id,row);}
  assert.ok(ownedClaims.has(id),'the actual bounded worker must lease this intent before recipient authorization');return ownedClaims.get(id)!;
 }
 return {worker,store,materialize,claim,claimFor,authorize,prepare,scope};
}
