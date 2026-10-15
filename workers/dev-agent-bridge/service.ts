import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {createPostgresRegistrationTransactions} from '../../src/infrastructure/registration-transactions.ts';
import {createRegistrationAnalysisWorker} from '../../src/application/registration-analysis-worker.ts';
import {createRegistrationReceiptReader} from '../../src/application/registration-receipt-reader.ts';
import {parseRegistrationScopeRequest,type RegistrationScopeRequest} from '../../src/domain/registration-persistence.ts';
import {registrationRecord} from '../../src/domain/registration-canonical.ts';
import type {RegistrationAnalysisEngine,QualifiedAnalysisKnowledge} from '../../src/application/registration-analysis-ports.ts';
import type {AgentAnalysisJob} from '../../src/domain/registration-contracts.ts';

/** Analysis service composition, not a scheduler, HTTP endpoint or live installer.
 * The host supplies a qualified worker pool and analyzer; never a human session.
 * The analyzer receives only bounded AnalysisEngineInput, not this object/pool.
 * Receipt observation stays independently gated during an execution shutdown.
 * No opening hook, source mutation, approval, email or runtime flag is introduced.
 */
export function createPostgresRegistrationAnalysisService(options:Readonly<{
 pool:SqlPool;
 identity:Omit<RegistrationScopeRequest,'permission'>;
 runner:RegistrationAnalysisEngine;
 analysisEnabled:()=>boolean;
 receiptReadEnabled:()=>boolean;
 readKnowledge?:(job:AgentAnalysisJob,signal:AbortSignal)=>Promise<readonly QualifiedAnalysisKnowledge[]>;
}>) {
 const fields=registrationRecord(options.identity,['workspaceId','accountId','actorId','bindingId']);
 const {permission:_,...identity}=parseRegistrationScopeRequest({...fields,permission:'read'});
 const transactions=createPostgresRegistrationTransactions({pool:options.pool,identity});
 const worker=createRegistrationAnalysisWorker({identity,transactions,runner:options.runner,enabled:options.analysisEnabled,
  ...(options.readKnowledge?{readKnowledge:options.readKnowledge}:{})});
 const reader=createRegistrationReceiptReader({identity,transactions,enabled:options.receiptReadEnabled});
 return Object.freeze({runOnce:worker.runOnce,readReceipt:reader.readReceipt});
}
