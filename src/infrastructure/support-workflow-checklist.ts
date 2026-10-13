import type {Principal} from '../domain/model.ts';
import type {SqlClient} from './sql.ts';
import {createSupportWorkflow,type SupportWorkflowTransaction} from '../application/support-workflow.ts';
import {createPostgresExecutionChecklistStore} from './execution-checklist-store.ts';

/** The host still owns the real ticket/profile/receipt reader and atomic writer.
 * This omission is deliberate: the PostgreSQL composition below, not a fallback
 * reader supplied by the host, provides the checklist required by a pinned profile.
 */
export type ChecklistWorkflowBaseStore=Omit<SupportWorkflowTransaction,'readExecutionChecklist'>;
export type PostgresChecklistWorkflowOptions=Omit<Parameters<typeof createSupportWorkflow>[0],'createStore'>&{
 createStore:(client:SqlClient,principal:Principal)=>ChecklistWorkflowBaseStore;
};

/** Compose, do not replace, the existing workflow and PostgreSQL checklist reader.
 * There is one resource-authorized transaction and one EXACT borrowed client.
 * Every host method is delegated with its original receiver (including classes).
 * The bound SQL reader rechecks its installation/login and locks its current
 * evidence before the existing workflow can call commitDecision.
 *
 * Readiness is evaluated only when the pinned profile requires the checklist.
 * A legacy profile, a customer return, or an authorized historical receipt does
 * not silently become dependent on a new checklist installation. A required
 * checklist has no old-reader/memory fallback after a failed SQL/readiness check.
 *
 * This is not a runtime mount or a completed PostgreSQL workflow writer. The host
 * MUST supply genuine same-client read/lock/CAS/audit/outbox/receipt persistence.
 * No fixture may be used as that store in production. No pool acquisition,
 * transaction control, grants, template publication or retries are added here.
 */
export function createPostgresChecklistWorkflow(options:PostgresChecklistWorkflowOptions){
 const createBaseStore=options.createStore.bind(options);
 return createSupportWorkflow({...options,createStore(client,principal){
  const base=createBaseStore(client,principal),checklist=createPostgresExecutionChecklistStore(client);
  return Object.freeze({
   readTicket:base.readTicket.bind(base),
   readProfile:base.readProfile.bind(base),
   readReceipt:base.readReceipt.bind(base),
   verifyAssignee:base.verifyAssignee.bind(base),
   commitDecision:base.commitDecision.bind(base),
   async readExecutionChecklist(ticketId:string):Promise<unknown>{
    await checklist.assertReady();
    return checklist.readExecutionChecklist(ticketId);
   },
  });
 }});
}
