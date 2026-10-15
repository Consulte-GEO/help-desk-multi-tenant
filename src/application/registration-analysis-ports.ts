import type {RegistrationJobTransaction} from './registration-job-store.ts';
import type {RegistrationScopeRequest} from '../domain/registration-persistence.ts';
import type {RegistrationInputSnapshot,AgentAnalysisJob} from '../domain/registration-contracts.ts';
/** SERVER-only transaction owner. Resolve ONLY after confirmed COMMIT, reject
 * unknown outcomes and bound DB/lock time. Enforce admission before/after waits and before COMMIT. Borrowed stores never leave work().
 * This port is deliberately not wired to the hosted runtime in E04. */
export interface RegistrationAnalysisTransactions {
 run<T>(scope:RegistrationScopeRequest,work:(tx:RegistrationJobTransaction)=>Promise<T>,admission:()=>void):Promise<T>;
}
export type QualifiedAnalysisKnowledge=Readonly<{id:string;hash:string;text:string}>;
export type AnalysisEngineInput=Readonly<{snapshot:RegistrationInputSnapshot;job:AgentAnalysisJob;knowledge:readonly QualifiedAnalysisKnowledge[]}>;
/** Implementations must terminate their owned subprocess on cancellation. They
 * receive no store, DB login, origin API, approver capability or notification port. */
export interface RegistrationAnalysisEngine {
 analyze(input:AnalysisEngineInput,signal?:AbortSignal):Promise<Readonly<{output:unknown}>>;
}
