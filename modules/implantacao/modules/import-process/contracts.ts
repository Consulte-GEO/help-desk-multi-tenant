import type { Snapshot } from './canonical.ts';
export interface Scope {workspaceId:string;accountId:string;caseId:string;workRef:string|null;}
/** Returned only by a trusted live server resolver, never deserialized from HTTP. */
export interface Authority extends Scope {actorId:string;requesterId:string;role:'requester'|'support';accessVersion:number;expiresAt:string;}
export type Operation='create'|'read'|'revise'|'cancel'|'artifact.register'|'artifact.verify';
export interface Process extends Scope {
  requesterId:string;createdBy:string;purpose:'new_work'|'history'|'reports'|'reconciliation';
  target:{system:string;contractVersion:string};status:'draft'|'cancelled';linkState:'awaiting_ticket';
  version:number;headRevision:number;headHash:string;createdAt:string;updatedAt:string;
}
export interface Revision {
  workspaceId:string;accountId:string;caseId:string;number:number;parentHash:string|null;
  actorId:string;reason:string;createdAt:string;snapshot:Snapshot;hash:string;
}
export interface Artifact {
  workspaceId:string;accountId:string;caseId:string;id:string;name:string;mime:string;
  bytes:number;sha256:string;objectKey:string;objectVersion:string|null;
  status:'pending'|'ready'|'rejected';rejectionCode:string|null;
  createdBy:string;createdAt:string;verifiedAt:string|null;retainUntil:string;
}
export interface WriteResult {
  caseId:string;operationId:string;version:number;revision:number;hash:string;
  status:'draft'|'cancelled';replayed:boolean;artifactId?:string;artifactStatus?:Artifact['status'];
}
export interface Receipt {
  workspaceId:string;accountId:string;caseId:string;actorId:string;operationId:string;
  requestHash:string;result:WriteResult;
}
export interface CaseEvent {
  workspaceId:string;accountId:string;caseId:string;actorId:string;
  version:number;operation:Operation;at:string;revision:number;hash:string;reason:string|null;
}
export interface Transaction {
  readProcess():Promise<Process|null>;
  readRevision(number:number):Promise<Revision|null>;
  listArtifacts():Promise<Artifact[]>;
  readArtifact(id:string):Promise<Artifact|null>;
  readReceipt(actorId:string,operationId:string):Promise<Receipt|null>;
  insertProcess(value:Process):Promise<void>;
  updateProcess(value:Process,expectedVersion:number):Promise<void>;
  insertRevision(value:Revision):Promise<void>;
  insertArtifact(value:Artifact):Promise<void>;
  updateArtifact(value:Artifact):Promise<void>;
  insertEvent(value:CaseEvent):Promise<void>;
  insertReceipt(value:Receipt):Promise<void>;
}
/** Must serialize the case including creation, use one connection and commit atomically. */
export interface Repository {transaction<T>(scope:Authority,work:(tx:Transaction)=>Promise<T>):Promise<T>;}
export interface Inspection {
  sha256:string;bytes:number;mime:string;private:boolean;contentValidated:boolean;
  scan:'clean'|'infected'|'unavailable';objectVersion:string;
}
export interface Options {
  repository:Repository;
  authority:{resolve(credential:unknown,selection:Scope,operation:Operation,signal?:AbortSignal):Promise<unknown>};
  /** Must inspect immutable bytes in private storage, including archive/PDF safety.
   * Unavailable, timed out or inconclusive inspection MUST fail, never imply clean. */
  inspector:{inspect(privateObjectKey:string,signal?:AbortSignal):Promise<unknown>};
  clock:()=>Date;newId:()=>string;retentionDays:number;timeouts?:{authorityMs:number;inspectionMs:number};
}

/** Receipt lookup is read-only. Missing is unconfirmed, never proof of rollback. */
export type ReceiptLookup =
 | {caseId:string;operationId:string;status:'confirmed';requestHash:string;receipt:WriteResult}
 | {caseId:string;operationId:string;status:'unconfirmed';requestHash:null;receipt:null};
