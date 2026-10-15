/** Owned PostgreSQL only; each hostile hook is removed in finally. */
import assert from 'node:assert/strict';import type {TestContext} from 'node:test';import type {SqlPool} from '../../src/infrastructure/sql.ts';
export async function assertOwnedRevisionRollback(suite:TestContext,operator:SqlPool,input:{workspaceId:string;ticketId:string;draftId:string;revise:()=>Promise<unknown>}){
 const {workspaceId:w,ticketId,draftId,revise}=input;
 assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
 const before=async()=>({ticket:(await operator.query('select status,version,priority from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,ticketId])).rows,
  draft:(await operator.query('select document,revision from helpdesk_core.hdni_drafts where workspace_id=$1 and id=$2',[w,draftId])).rows,
  receipts:(await operator.query('select id from helpdesk_audit.hdnr_receipts where workspace_id=$1 and ticket_id=$2 order by id',[w,ticketId])).rows,
  forms:(await operator.query('select document from helpdesk_core.hdnr_forms where workspace_id=$1 and ticket_id=$2 order by revision',[w,ticketId])).rows,
  events:(await operator.query('select id from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2 order by id',[w,ticketId])).rows,
  sources:(await operator.query('select id from helpdesk_integration.hdnr_sources where workspace_id=$1 and ticket_id=$2 order by id',[w,ticketId])).rows});
 for(const [name,relation,event,body] of [
  ['missing_form','helpdesk_core.hdnr_forms','INSERT','RETURN NULL;'],
  ['unconsumed_draft','helpdesk_core.hdni_drafts','UPDATE',"IF NEW.document->>'status'='committed' THEN RETURN OLD;END IF;RETURN NEW;"],
  ['missing_source','helpdesk_integration.hdnr_sources','INSERT',"IF NEW.kind='support.form_revised' THEN RETURN NULL;END IF;RETURN NEW;"]
 ])await suite.test('a revision with '+name+' rolls back all actual effects and preserves the editing draft',async()=>{
  const baseline=await before(),fn='helpdesk_auth.owned_wave2_revision_fault',trigger='owned_wave2_revision_fault';
  try{
   await operator.query('CREATE FUNCTION '+fn+"() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fault$ BEGIN "+body+' END $fault$');
   await operator.query('CREATE TRIGGER '+trigger+' BEFORE '+event+' ON '+relation+' FOR EACH ROW EXECUTE FUNCTION '+fn+'()');
   await assert.rejects(revise(),{code:'approval_unavailable'});assert.deepEqual(await before(),baseline);
  }finally{await operator.query('DROP TRIGGER IF EXISTS '+trigger+' ON '+relation);await operator.query('DROP FUNCTION IF EXISTS '+fn+'()');}
 });
}
