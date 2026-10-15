/** Fault injection is confined to the owned disposable PG17 cluster. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {TestContext} from 'node:test';
import type {SqlPool} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
import type {ExternalResourceRef} from '../../src/domain/external-resource.ts';
import type {createFormDraftService} from '../../src/application/form-draft.ts';import type {createSupportIntake} from '../../src/application/support-intake.ts';
export async function assertOwnedPendingOpeningFaults(suite:TestContext,operator:SqlPool,input:{customer:Principal;accountId:string;refs:readonly ExternalResourceRef[];formId:string;drafts:ReturnType<typeof createFormDraftService>;intake:ReturnType<typeof createSupportIntake>}){
 const {customer,accountId,refs,formId,drafts,intake}=input,w=customer.workspaceId;
 assert.equal((await operator.query('select current_database() as db')).rows[0]?.db,'helpdesk_test');
 const counts=async()=>(await operator.query(`select jsonb_build_object(
  'tickets',(select count(*) from helpdesk_core.tickets where workspace_id=$1),
  'receipts',(select count(*) from helpdesk_audit.hdni_receipts where workspace_id=$1),
  'snapshots',(select count(*) from helpdesk_core.hdni_snapshots where workspace_id=$1),
  'proofs',(select count(*) from helpdesk_audit.hdnr_openings where workspace_id=$1),
  'events',(select count(*) from helpdesk_core.ticket_events where workspace_id=$1),
  'counter',(select last_sequence::text from helpdesk_core.hdni_protocol_counters where workspace_id=$1)) as result`,[w])).rows[0]!.result;
 for(const fault of ['suppressed','corrupt_digest'] as const)await suite.test('pending opening rolls back every effect when private proof is '+fault,async()=>{
  const draft=await drafts.saveFormDraft(customer,{id:randomUUID(),accountId,refs,formId,formVersion:2,answers:{details:'Owned atomic pending opening fault'}},0);
  const query={draftId:draft.id,expectedDraftRevision:1,subject:'Owned proof fault qualification',description:'No partial ticket may survive',coverageId:null},preview=await intake.previewSupportRequest(customer,query),before=await counts();
  const body=fault==='suppressed'?'RETURN NULL;':"NEW.snapshot_hash:=repeat('0',64);RETURN NEW;";
  await operator.query("CREATE FUNCTION helpdesk_auth.hdtest_pending_opening_fault() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN "+body+"END$$; REVOKE ALL ON FUNCTION helpdesk_auth.hdtest_pending_opening_fault() FROM PUBLIC; CREATE TRIGGER hdtest_pending_opening_fault BEFORE INSERT ON helpdesk_audit.hdnr_openings FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdtest_pending_opening_fault();");
  try{
   await assert.rejects(intake.createSupportRequest(customer,{...query,previewHash:preview.previewHash},randomUUID(),randomUUID()));
   assert.deepEqual(await counts(),before,'a failed initial approval left partial ticket, receipt, proof, event or counter');
   assert.equal((await operator.query("select document->>'status' as state from helpdesk_core.hdni_drafts where workspace_id=$1 and id=$2",[w,draft.id])).rows[0]!.state,'editing');
  }finally{await operator.query('DROP TRIGGER hdtest_pending_opening_fault ON helpdesk_audit.hdnr_openings; DROP FUNCTION helpdesk_auth.hdtest_pending_opening_fault();');}
 });
}
