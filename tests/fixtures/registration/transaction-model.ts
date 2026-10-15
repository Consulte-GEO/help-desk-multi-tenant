/** Transaction reference model for local application tests ONLY.
 * Serializes calls and rolls back staged data. It is not SQL, RLS, a real worker,
 * a production fallback, nor proof of persistence across process restarts.
 */
import {registrationHash,registrationFailure} from '../../../src/domain/registration-canonical.ts';
import {id} from './sample.ts';
const clone=<T>(v:T):T=>structuredClone(v);
export function transactionModel(){
 let now='2026-10-14T12:00:00.000Z',tail=Promise.resolve();
 let data={operations:new Map<string,any>(),jobs:new Map<string,any>(),snapshots:new Map<string,any>(),drafts:new Map<string,any>(),receipts:new Map<string,any>()};
 let active=true;
 const evidence:{name:string;args:any}[]=[];
 let badAck:((r:any)=>any)|undefined,beforeCommit:(()=>void)|undefined;
 const scope=(permission:string,actor='human')=>({workspaceId:id(1),accountId:id(2),actorId:actor==='human'?id(20):id(21),bindingId:id(30),permission});
 const actor=(p:any)=>p.actorId===id(20)?'human':p.actorId===id(21)?'analyzer':null;
 const denied=()=>{throw registrationFailure('registration_scope_denied',403);};
 const key=(p:any,commandId:string)=>`${p.workspaceId}:${p.actorId}:${commandId}`;
 const transaction=async<T>(request:any,work:(tx:any)=>Promise<T>):Promise<T>=>{
  const previous=tail;let unlock!:()=>void;tail=new Promise<void>(r=>{unlock=r;});await previous;
  const staged=clone(data);let locked:any,rejected=false,live=true;
  const requireScope=()=>{if(!live||!active||!locked)denied();};
  const tx={
   reject(error:unknown):never{rejected=true;throw error;},
   async lockScope(p:any){evidence.push({name:'lockScope',args:clone(p)});if(locked||!active||p.workspaceId!==id(1)||p.accountId!==id(2)||p.bindingId!==id(30)||!actor(p))denied();const target=await import('../../../src/domain/registration-contracts.ts').then(m=>m.createRegistrationInputSnapshot).then(f=>import('./sample.ts').then(m=>f(m.input())));locked={...p,actorKind:actor(p),bindingRevision:1,targetHash:target.targetHash,ticketId:id(11),databaseNow:now,expiresAt:'2026-10-14T13:00:00.000Z'};return clone(locked);},
   async readReceipt(commandId:string){requireScope();evidence.push({name:'readReceipt',args:commandId});return clone(staged.receipts.get(key(locked,commandId))??null);},
   async lockOperation(operationId:string){requireScope();evidence.push({name:'lockOperation',args:operationId});const r=staged.operations.get(operationId);return r?{...clone(r),databaseNow:now}:null;},
   async lockNextOperation(){requireScope();evidence.push({name:'lockNextOperation',args:null});for(const r of staged.operations.values())if(r.queue.status==='queued'||r.queue.status==='leased'&&r.queue.lease.expiresAt<=now)return {...clone(r),databaseNow:now};return null;},
   async apply(write:any){requireScope();evidence.push({name:'apply',args:clone(write)});const s=write.next.state,q=write.next.queue,op=s.snapshot.operationId,old=staged.operations.get(op);if((old?.state.revision??0)!==write.expectedRevision)throw registrationFailure('registration_revision_conflict',412);if(old&&registrationHash(old.state)!==write.beforeStateHash)throw registrationFailure('registration_revision_conflict',412);
    const receiptKey=key(locked,write.command.commandId);if(staged.receipts.has(receiptKey))throw registrationFailure('registration_event_conflict',409);
    if(old?.queue.jobId!==q.jobId&&staged.jobs.has(q.jobId))throw registrationFailure('registration_job_conflict',409);
    const snapshotKey=`${op}:${s.snapshot.inputRevision}`,snapshot=staged.snapshots.get(snapshotKey);if(snapshot&&registrationHash(snapshot)!==registrationHash(s.snapshot))throw registrationFailure('registration_snapshot_mismatch',409);
    staged.snapshots.set(snapshotKey,clone(s.snapshot));
    if(old&&old.queue.jobId!==q.jobId)staged.jobs.set(old.queue.jobId,{...old.queue,status:'superseded',lease:null});
    staged.operations.set(op,clone(write.next));staged.jobs.set(q.jobId,clone(q));
    if(s.draft){const draftKey=`${op}:${s.draft.draftRevision}`;if(staged.drafts.has(draftKey))throw registrationFailure('registration_draft_mismatch',409);staged.drafts.set(draftKey,clone(s.draft));}
    const receipt={schema:1,commandId:write.command.commandId,commandHash:write.commandHash,permission:locked.permission,workspaceId:locked.workspaceId,accountId:locked.accountId,actorId:locked.actorId,bindingId:locked.bindingId,operationId:op,operationRevision:s.revision,stateHash:registrationHash(s),jobId:q.jobId,fence:s.analysisFence,status:s.status,recordedAt:now};staged.receipts.set(receiptKey,clone(receipt));
    beforeCommit?.();if(!active)denied();return badAck?badAck(clone(receipt)):clone(receipt);
   }
  };
  try{const value=await work(tx);if(rejected||!active)throw registrationFailure('registration_transaction_rejected',503);data=staged;return value;}
  finally{live=false;unlock();}
 };
 return {scope,transaction,evidence,inspect:()=>clone(data),advance:(ms:number)=>{now=new Date(Date.parse(now)+ms).toISOString();},now:()=>now,revoke:()=>{active=false;},restore:()=>{active=true;},setBadAck:(f?:typeof badAck)=>{badAck=f;},setBeforeCommit:(f?:typeof beforeCommit)=>{beforeCommit=f;},corruptReceipt:(actorId:string,cmd:string,f:(r:any)=>any)=>{const k=key({workspaceId:id(1),actorId},cmd);data.receipts.set(k,f(data.receipts.get(k)));}};
}
