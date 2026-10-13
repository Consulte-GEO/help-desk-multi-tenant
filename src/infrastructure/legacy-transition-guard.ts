import {rejectTransactionValidation} from './transaction.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {copyFormData} from '../../shared/form-rules.js';
import type {SqlClient,SqlResult} from './sql.ts';

type Identity=Readonly<{id:string;workspaceId:string}>;
export type LegacyTicketUpdate=Readonly<{
 id:string;workspaceId:string;accountId:string;status:string;version:number;updatedAt:string;
}>;
const known:Readonly<Record<string,readonly [number,string]>>=Object.freeze({
 HD001:[404,'resource_not_found'],HD002:[412,'version_conflict'],HD008:[409,'structured_workflow_required'],
 structured_workflow_required:[409,'structured_workflow_required'],
 legacy_transition_guard_unavailable:[503,'legacy_transition_guard_unavailable'],
 release_gate_closed:[503,'release_gate_closed'],request_cancelled:[409,'request_cancelled'],
 resource_scope_denied:[403,'resource_scope_denied'],resource_scope_unavailable:[503,'resource_scope_unavailable'],
 transaction_identity_changed:[403,'transaction_identity_changed'],
 transaction_validation_failed:[503,'transaction_validation_failed'],
 transaction_statement_failed:[503,'transaction_statement_failed'],
 database_unavailable:[503,'database_unavailable'],transaction_outcome_unknown:[503,'transaction_outcome_unknown'],
});
function unavailable():HelpdeskError{return new HelpdeskError(503,'legacy_transition_guard_unavailable','Não foi possível conferir o fluxo de conclusão deste chamado.');}
function safe(error:unknown):HelpdeskError{
 try{
  const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;
  if(typeof code==='string'&&Object.hasOwn(known,code)){
   const [status,normalized]=known[code]!;
   return new HelpdeskError(status,normalized,normalized==='structured_workflow_required'
    ?'Este chamado exige a conclusão pelo fluxo estruturado, com conferência do checklist.'
    :'Não foi possível concluir esta alteração autorizada. Atualize o chamado.');
  }
 }catch{/* Do not execute or propagate values from a transport error. */}
 return unavailable();
}
function onlyRow(result:SqlResult,keys:readonly string[]):Record<string,unknown>{
 // pg's command tag is not optional evidence of a successful SELECT.
 if(!result||result.command!=='SELECT'||result.rowCount!==1)throw unavailable();
 const rows=copyFormData(result.rows) as unknown;
 if(!Array.isArray(rows)||rows.length!==1)throw unavailable();
 const row=rows[0];
 if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==keys.length
  ||keys.some(k=>!Object.hasOwn(row,k)))throw unavailable();
 return row as Record<string,unknown>;
}
/** Additional refusal for the ORIGINAL PostgresStore only. It does not resolve
 * a ticket or authorize the structured flow. Invoke in the SAME borrowed client
 * immediately before updateTicket; never cache a result across transactions.
 * A failed mandatory validation invalidates that owned transaction even when its
 * caller catches the error. The shared runner controls rollback/COMMIT outcomes.
 * A wholly absent HDN facility preserves old databases. A partial/broken facility
 * is unavailable, not a fallback. The normal role/schema/RLS checks still apply.
 * The migration's initial cutover must run with attendance closed. This guard is
 * not a database-wide invariant against arbitrary raw SQL or administrative DDL.
 */
export async function assertLegacyTerminalUpdateAllowed(client:SqlClient,p:Identity,t:LegacyTicketUpdate,expectedVersion:number):Promise<void>{
 if(t.status!=='resolved'&&t.status!=='closed')return;
 try{
  const workspaceId=uuidIdentifier(t.workspaceId),accountId=uuidIdentifier(t.accountId),ticketId=uuidIdentifier(t.id),status=t.status;
  if(workspaceId!==uuidIdentifier(p.workspaceId)||!uuidIdentifier(p.id)
   ||!Number.isSafeInteger(expectedVersion)||expectedVersion<1
   ||!Number.isSafeInteger(t.version)||t.version!==expectedVersion+1)throw unavailable();
  const catalog=onlyRow(await client.query(`select
   to_regclass('helpdesk_core.hdn_execution_bindings') is not null as bindings,
   to_regprocedure('helpdesk_auth.hdn_legacy_terminal_update(uuid,uuid,uuid,text,integer)') is not null as guard`),['bindings','guard']);
  if(typeof catalog.bindings!=='boolean'||typeof catalog.guard!=='boolean')throw unavailable();
  if(catalog.bindings===false&&catalog.guard===false)return;
  if(!catalog.bindings||!catalog.guard)throw unavailable();
  const row=onlyRow(await client.query('select helpdesk_auth.hdn_legacy_terminal_update($1,$2,$3,$4,$5) as decision',
   [workspaceId,accountId,ticketId,status,expectedVersion]),['decision']);
  if(row.decision==='structured_required')throw new HelpdeskError(409,'structured_workflow_required','Use o fluxo estruturado.');
  if(row.decision!=='legacy_allowed')throw unavailable();
 }catch(error){return rejectTransactionValidation(client,safe(error));}
}
