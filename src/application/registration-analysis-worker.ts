import {registrationRecord,registrationUuid,registrationHash,registrationFailure,copyRegistrationValue,type RegistrationJson} from '../domain/registration-canonical.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseLockedRegistration,parseRegistrationPersistenceReceipt,parseRegistrationAnalysisLease,HDA_ANALYSIS_LEASE_SECONDS,type RegistrationScopeRequest,type RegistrationAnalysisLease,type RegistrationPersistenceReceipt} from '../domain/registration-persistence.ts';
import {parseAgentAnalysis} from '../domain/registration-analysis.ts';
import {getRegistrationAction} from '../domain/registration-action-catalog.ts';
import {buildAnalysisPrompt} from '../connectors/dev-agent/analysis-request.ts';
import type {AgentAnalysisJob} from '../domain/registration-contracts.ts';
import {executeRegistrationCommand,type RegistrationCommandResult} from './registration-persistence.ts';
import type {RegistrationAnalysisTransactions,RegistrationAnalysisEngine,QualifiedAnalysisKnowledge} from './registration-analysis-ports.ts';
export type AnalysisWorkerResult=Readonly<{status:'disabled'|'busy'|'idle'|'replay_no_launch'|'exhausted'|'withheld'|'reconciliation_required'|'draft_ready'|'needs_information'|'manual_review'|'analysis_failed';stage:'admission'|'claim'|'load'|'analysis'|'settlement';claimCommandId:string;settlementCommandId:string;settlementPermission:'complete'|'fail'|null;operationId:string|null;ticketMutation:'none';originMutation:'none'}>;
const fail=()=>registrationFailure('registration_worker_claim_invalid',503);
function finishId(identity:Omit<RegistrationScopeRequest,'permission'>,claimId:string):string {
 const h=registrationHash({namespace:'hda.analysis.settlement.v1',identity,claimId});
 return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${(8+(parseInt(h[16]!,16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
}
function wire(raw:unknown,job:AgentAnalysisJob):RegistrationJson {
 parseAgentAnalysis(raw,job,getRegistrationAction(job.actionKey));return copyRegistrationValue(raw);
}
function manual(job:AgentAnalysisJob,warning:string):RegistrationJson {
 return {schema:1,jobId:job.jobId,operationId:job.operationId,inputRevision:job.inputRevision,disposition:'manual_review',proposedFields:{},missingFields:[],warnings:[warning],knowledgeRefs:[]};
}
/** One bounded analysis iteration. No scheduler, automatic retry, opening hook,
 * approval, source mutation or public ticket transition. Continuous revocation
 * monitoring belongs to the host: this increment reauthorizes after claim, after
 * knowledge loading and before settlement, and always observes caller abort. */
export function createRegistrationAnalysisWorker(o:Readonly<{
 identity:Omit<RegistrationScopeRequest,'permission'>;transactions:RegistrationAnalysisTransactions;runner:RegistrationAnalysisEngine;enabled:()=>boolean;
 readKnowledge?:(job:AgentAnalysisJob,signal:AbortSignal)=>Promise<readonly QualifiedAnalysisKnowledge[]>;
}>) {
 const i=parseRegistrationScopeRequest({...o.identity,permission:'read'});const {permission:_,...identity}=i;
 if(!o.transactions||typeof o.transactions.run!=='function'||!o.runner||typeof o.runner.analyze!=='function'||typeof o.enabled!=='function')throw fail();
 let busy=false;
 const scope=(permission:RegistrationScopeRequest['permission'])=>parseRegistrationScopeRequest({...identity,permission});
 const admitted=()=>{try{return o.enabled()===true;}catch{return false;}};
 return Object.freeze({async runOnce(rawClaimId:string,parent?:AbortSignal):Promise<AnalysisWorkerResult>{
  const claimCommandId=registrationUuid(rawClaimId),settlementCommandId=finishId(identity,claimCommandId);let operationId:string|null=null,settlementPermission:'complete'|'fail'|null=null;
  const result=(status:AnalysisWorkerResult['status'],stage:AnalysisWorkerResult['stage']):AnalysisWorkerResult=>Object.freeze({status,stage,claimCommandId,settlementCommandId,settlementPermission,operationId,ticketMutation:'none',originMutation:'none'});
  if(!admitted()||parent?.aborted)return result('disabled','admission');if(busy)return result('busy','admission');busy=true;
  const control=new AbortController(),cancel=()=>control.abort();parent?.addEventListener('abort',cancel,{once:true});if(parent?.aborted)cancel();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let analyzerPending=false,iterationEnded=false;
  const allowed=()=>admitted()&&!control.signal.aborted;
  const admission=()=>{if(!allowed())throw registrationFailure('registration_worker_aborted',409);};
  const awaitSignal=<T>(promise:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
   const abort=()=>{control.signal.removeEventListener('abort',abort);reject(registrationFailure('registration_worker_aborted',409));};
   control.signal.addEventListener('abort',abort,{once:true});if(control.signal.aborted)abort();
   void promise.then(resolve,reject).finally(()=>control.signal.removeEventListener('abort',abort));
  });
  try{
   const claimScope=scope('claim'),command={type:'claim',commandId:claimCommandId,leaseSeconds:HDA_ANALYSIS_LEASE_SECONDS.default};let claimed:RegistrationCommandResult;
   try{claimed=await o.transactions.run(claimScope,tx=>executeRegistrationCommand(tx,claimScope,command),admission);}
   catch{return result('reconciliation_required','claim');} // Never infer no COMMIT from a thrown error.
   let receipt:RegistrationPersistenceReceipt,lease:RegistrationAnalysisLease;
   try{
    const envelope=registrationRecord(claimed,['outcome','receipt','lease']);
    if(envelope.outcome==='idle'){if(envelope.receipt!==null||envelope.lease!==null)throw fail();return result('idle','claim');}
    receipt=parseRegistrationPersistenceReceipt(envelope.receipt);
    for(const k of ['workspaceId','accountId','actorId','bindingId'] as const)if(receipt[k]!==identity[k])throw fail();
    if(receipt.permission!=='claim'||receipt.commandId!==claimCommandId||receipt.commandHash!==registrationHash({scope:claimScope,command}))throw fail();
    operationId=receipt.operationId;
    if(envelope.outcome==='replay'){if(envelope.lease!==null)throw fail();return result('replay_no_launch','claim');}
    if(envelope.outcome==='exhausted'){if(envelope.lease!==null||receipt.status!=='analysis_failed')throw fail();return result('exhausted','claim');}
    if(envelope.outcome!=='applied'||receipt.status!=='analyzing')throw fail();lease=parseRegistrationAnalysisLease(envelope.lease);
    if(lease.leaseId!==claimCommandId||lease.workerId!==identity.actorId||lease.fence!==receipt.fence||receipt.recordedAt<lease.issuedAt||receipt.recordedAt>=lease.expiresAt)throw fail();
   }catch{return result('reconciliation_required','claim');}
   const load=async()=>{
    const s=scope('read');return o.transactions.run(s,async tx=>{
     try{
      if(!allowed())throw fail();const currentScope=parseLockedRegistrationScope(await tx.lockScope(s),s);
      if(currentScope.actorKind!=='analyzer')throw fail();const current=parseLockedRegistration(await tx.lockOperation(receipt.operationId),currentScope);
      if(current.state.revision!==receipt.operationRevision||registrationHash(current.state)!==receipt.stateHash||!current.state.job||current.queue.jobId!==receipt.jobId||registrationHash(current.queue.lease)!==registrationHash(lease)||lease.expiresAt<=current.databaseNow)throw fail();
      return {snapshot:current.state.snapshot,job:current.state.job,remainingMs:Math.min(Date.parse(lease.expiresAt),Date.parse(currentScope.expiresAt))-Date.parse(current.databaseNow)};
     }catch(e){return tx.reject(e);}
    },admission);
   };
   const loadStarted=performance.now();let current:Awaited<ReturnType<typeof load>>;
   try{current=await load();}catch{return result('withheld','load');}
   const budget=current.remainingMs-(performance.now()-loadStarted)-1500;
   if(!allowed()||budget<1000)return result('withheld','load');
   timer=setTimeout(()=>control.abort(),budget);
   let rawOutput:RegistrationJson|undefined,failureReason:'offline'|'timeout'|'invalid_output'|'runner_failed'|undefined;
   if(current.snapshot.attachmentRefs.length)rawOutput=manual(current.job,'Há anexos ainda não qualificados para esta análise. Conferência humana necessária.');
   else {
    let knowledge:readonly QualifiedAnalysisKnowledge[]=[];
    try{
     if(current.job.knowledgeRefs.length){if(!o.readKnowledge)throw fail();knowledge=await awaitSignal(o.readKnowledge(current.job,control.signal));}
     buildAnalysisPrompt(current.snapshot,current.job,knowledge);
    }catch{if(!allowed())return result('withheld','analysis');rawOutput=manual(current.job,'A documentação autorizada não pôde ser conferida. Conferência humana necessária.');}
    if(rawOutput===undefined){
     // The source may have changed while excerpts were being retrieved. No DB
     // transaction remains held when analyze() starts.
     try{await load();}catch{return result('withheld','load');}if(!allowed())return result('withheld','analysis');
     try{
      // Bound the worker even when a defective engine ignores cancellation.
      // Keep this instance quarantined until that engine actually settles: an
      // aborted Promise is not proof that its process/network activity stopped.
      analyzerPending=true;
      const running=Promise.resolve().then(()=>o.runner.analyze({snapshot:current.snapshot,job:current.job,knowledge},control.signal));
      const settled=()=>{analyzerPending=false;if(iterationEnded)busy=false;};
      void running.then(settled,settled); // observes late rejection without logging it
      const response=await awaitSignal(running);
      const d=response&&typeof response==='object'?Object.getOwnPropertyDescriptor(response,'output'):undefined;
      if(!d?.enumerable||!Object.hasOwn(d,'value'))throw registrationFailure('registration_cli_output_invalid',422);
      try{rawOutput=wire(d.value,current.job);}catch{throw registrationFailure('registration_cli_output_invalid',422);}
     }catch(error){
      if(!allowed())return result('withheld','analysis');
      const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;
      failureReason=code==='registration_runner_timeout'?'timeout':code==='registration_cli_output_invalid'?'invalid_output':code==='registration_runner_offline'?'offline':'runner_failed';
     }
    }
   }
   if(!allowed())return result('withheld','settlement');
   try{await load();}catch{return result('withheld','settlement');}
   if(!allowed())return result('withheld','settlement');
   const type=failureReason?'fail':'complete',s=scope(type),finish={type,commandId:settlementCommandId,operationId:receipt.operationId,expectedRevision:receipt.operationRevision,jobId:receipt.jobId,leaseId:lease.leaseId,fence:lease.fence,...(failureReason?{reason:failureReason}:{output:rawOutput!})};
   settlementPermission=type;
   try{
    const saved=await o.transactions.run(s,tx=>executeRegistrationCommand(tx,s,finish),admission);
    if(!saved.receipt||!['draft_ready','needs_information','manual_review','analysis_failed'].includes(saved.receipt.status))throw fail();
    return result(saved.receipt.status as 'draft_ready'|'needs_information'|'manual_review'|'analysis_failed','settlement');
   }catch{return result('reconciliation_required','settlement');} // No second fail/complete or fresh key.
  }finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel);control.abort();iterationEnded=true;if(!analyzerPending)busy=false;}
 }});
}
