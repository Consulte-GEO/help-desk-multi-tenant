import {freezeFormData} from '../../shared/form-rules.js';
import {canonicalInstant,isCanonicalInstant} from '../../shared/instant.js';
import {requestHash} from './canonical.ts';
import {planDeliveryRecovery,planRestoredAccess} from './recovery-plan.ts';

/** Private C12/C15 snapshots only. This summary neither attests source authority
 * nor applies a recovery plan. Do not expose records or provider receipts. */
export function summarizeRecoveryReconciliation(backup:unknown,current:unknown,restored:unknown,tombstones:unknown,at:string){
 if(!isCanonicalInstant(at))throw new Error('Invalid reconciliation instant');
 const when=canonicalInstant(at);
 const delivery=planDeliveryRecovery(backup,current,when),access=planRestoredAccess(restored,tombstones);
 const source=(rows:unknown)=>({count:(rows as unknown[]).length,canonicalJsonSha256:requestHash(rows)});
 const states={pending:0,retry_wait:0,leased:0,sending:0,unknown:0,accepted:0,delivered:0,failed:0,suppressed:0};
 const actions={do_not_restore:0,keep_revoked:0,invalidate:0,quarantine:0,require_revalidation:0};
 for(const row of delivery.records)states[row.state]++;
 for(const row of access)actions[row.action as keyof typeof actions]++;
 return freezeFormData({schemaVersion:1,inputContract:'c15-recovery-v1',at:when,
  sources:{deliveryBackup:source(backup),deliveryCurrent:source(current),accessRestored:source(restored),accessTombstones:source(tombstones)},
  delivery:{total:delivery.records.length,states,attention:delivery.records.filter(r=>r.attention).length,dispatchable:delivery.dispatchable,planHash:delivery.planHash},
  access:{total:access.length,actions,planHash:requestHash(access)},
  sourceAuthorityVerified:false,productionApproved:false,restorePerformed:false,resumeWorkers:false,mutations:0});
}
