/** Owned disposable PostgreSQL only; no production URLs or recipient contact. */
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createNotificationIntent} from '../../src/domain/notification-delivery.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
export function registerWave2PublicSqlTests(operatorPool:()=>SqlPool){
 test('wave2 public intents are accepted by the actual private SQL contract',async suite=>{
  const c=await operatorPool().connect();
  try{
   await c.query('BEGIN');
   assert.equal((await c.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
   assert.equal((await c.query('select current_user as who')).rows[0]?.who,'helpdesk_operator');
   assert.equal((await c.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.24.0');
   const now=new Date().toISOString(),until=new Date(Date.now()+86400000).toISOString();
   for(const kind of ['support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled']){
    await suite.test(kind,async()=>{
     const intent=createNotificationIntent({id:randomUUID(),workspaceId:randomUUID(),accountId:randomUUID(),ticketId:randomUUID(),eventId:randomUUID(),recipientId:randomUUID(),channelId:'resend',templateId:'owned-wave2',templateVersion:1,templateHash:requestHash({kind}),kind,sourceVersion:2,resourceHash:'b'.repeat(64),protocol:'CG-10002',invitationId:null,createdAt:now,expiresAt:until});
     assert.equal((await c.query('select helpdesk_auth.hdn_notification_valid_intent($1::jsonb) as allowed',[JSON.stringify(intent)])).rows[0]?.allowed,true,'native SQL still rejects '+kind);
     for(const hostile of [{...intent,body:'private'},{...intent,notes:'private'},{...intent,kind:'note.created'},{...intent,idempotencyKey:'a'.repeat(64)}])assert.equal((await c.query('select helpdesk_auth.hdn_notification_valid_intent($1::jsonb) as allowed',[JSON.stringify(hostile)])).rows[0]?.allowed,false);
    });
   }
  }finally{await c.query('ROLLBACK');c.release();}
 });
}

