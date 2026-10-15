/** Native tests are registered only in the owned PG17 upgrade fixture. */
import assert from 'node:assert/strict';
import type {SqlClient} from '../../src/infrastructure/sql.ts';
export async function assertWave2InternalRelations(pool:SqlClient){
 return assertPrivateRelations(pool,['helpdesk_integration.hdn_notification_private_sources','helpdesk_integration.hdn_notification_queue_rosters']);
}
export async function assertWave2ReviewRelations(pool:SqlClient){
 await assertPrivateRelations(pool,['helpdesk_core.hdnr_policies','helpdesk_core.hdnr_profiles','helpdesk_auth.hdnr_grants','helpdesk_auth.hdnr_rosters','helpdesk_audit.hdnr_openings','helpdesk_core.hdnr_forms','helpdesk_core.hdnr_invitations','helpdesk_audit.hdnr_receipts','helpdesk_integration.hdnr_sources','helpdesk_audit.hdnr_challenges']);
 for(const signature of ['hdnr_scope_hash(jsonb)','hdnr_target_hash(jsonb)','hdnr_operator(uuid,uuid,uuid,uuid)','hdnr_context(uuid)','hdnr_invitation_guard()','hdnr_receipt_complete()','hdnr_challenge_complete()','hdnr_authority_read(uuid)','hdnr_authority_publish()'])for(const role of ['helpdesk_app','helpdesk_notification_worker'])
  assert.equal((await pool.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,'helpdesk_auth.'+signature])).rows[0]?.allowed,false);
 for(const signature of ['hdnr_aggregate(uuid)','hdnr_grant(uuid,text,jsonb)','hdnr_route(uuid,jsonb)','hdnr_invitation_receipt(text)','hdnr_pending_invitation(uuid)','hdnr_invitation(uuid)','hdnr_commit_invitation(jsonb,jsonb)','hdnr_challenge(jsonb,integer)','hdnr_receipt(text)','hdnr_commit_approval(jsonb,jsonb)']){
  assert.equal((await pool.query("select has_function_privilege('helpdesk_app',$1,'EXECUTE') as allowed",['helpdesk_auth.'+signature])).rows[0]?.allowed,true);
  assert.equal((await pool.query("select has_function_privilege('helpdesk_notification_worker',$1,'EXECUTE') as allowed",['helpdesk_auth.'+signature])).rows[0]?.allowed,false);
 }
}
async function assertPrivateRelations(pool:SqlClient,names:readonly string[]){
  assert.equal((await pool.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
  for(const name of names){
   assert.ok((await pool.query('select to_regclass($1) as relation',[name])).rows[0]?.relation,'qualified internal relation missing: '+name);
   const r=(await pool.query(`select c.relrowsecurity as enabled,c.relforcerowsecurity as forced,
    has_table_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as app,
    has_table_privilege('helpdesk_notification_worker',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as worker
    from pg_class c where c.oid=to_regclass($1)`,[name])).rows[0];
   assert.deepEqual(r,{enabled:true,forced:true,app:false,worker:false});
  }
}
