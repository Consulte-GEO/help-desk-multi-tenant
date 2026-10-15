/** Native tests are registered only in the owned PG17 upgrade fixture. */
import assert from 'node:assert/strict';
import type {SqlClient} from '../../src/infrastructure/sql.ts';
export async function assertWave2InternalRelations(pool:SqlClient){
 return assertPrivateRelations(pool,['helpdesk_integration.hdn_notification_private_sources','helpdesk_integration.hdn_notification_queue_rosters']);
}
export async function assertWave2ReviewRelations(pool:SqlClient){
 return assertPrivateRelations(pool,['helpdesk_core.hdnr_policies','helpdesk_core.hdnr_profiles','helpdesk_auth.hdnr_grants','helpdesk_auth.hdnr_rosters']);
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
