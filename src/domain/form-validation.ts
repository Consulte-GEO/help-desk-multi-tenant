import type {Principal} from './model.ts';
import {uuidIdentifier} from './input-values.ts';
import {requestHash} from './canonical.ts';
import {HelpdeskError} from './errors.ts';
import type {createResourceAccessResolver,ResourceScopeContext,ActiveResourceScope} from '../application/resource-access.ts';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {validateFormValues,copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {parseFormVersion,formRecord,formRevision,formFailure as fail} from './form-schema.ts';
export type FormEvidenceQuery=Readonly<{kind:'lookup'|'file';path:string;registryKey:string;value:string;workspaceId:string;accountId:string;principalId:string;bindingId:string;accessRevision:string;formId:string;formVersion:number;draftId:string;draftRevision:number}>;
export interface FormEvidenceAuthority{
 /** SERVER ONLY; verify every lookup and clean immutable attachment receipt in its
  * actual source. Bind tenant/connection/resources, owner, draft, field, version,
  * hash and scan state. Do not simply echo queryHash or trust browser labels.
  * Invoked again at final intake/revision inside a still-authorized transaction.
  */
 verify(queries:readonly FormEvidenceQuery[],signal:AbortSignal):Promise<unknown>;
}
export function createScopedFormValidator(options:{resolver:ReturnType<typeof createResourceAccessResolver>;evidence:FormEvidenceAuthority;clock?:()=>string;timeoutMs?:number}){
 const clock=options.clock??(()=>new Date().toISOString()),timeout=options.timeoutMs??5000;
 if(!Number.isInteger(timeout)||timeout<1||timeout>10000||typeof options.evidence?.verify!=='function')throw fail('form_evidence_unavailable',503);
 async function validateForm(p:Principal,rawSchema:unknown,answers:unknown,context:ResourceScopeContext,lease:ActiveResourceScope,draft:{id:string;revision:number},signal?:AbortSignal){
  const check=()=>{options.resolver.assertResourceScopeCurrent(p,context,lease);if(signal?.aborted)throw fail('form_evidence_unavailable',503);};check();
  if(context.operation!=='tickets.write'||context.principalId!==p.id)throw fail('resource_scope_denied',403);
  const d=formRecord(draft,['id','revision']),draftId=uuidIdentifier(d.id),draftRevision=formRevision(d.revision),schema=parseFormVersion(rawSchema);
  if(schema.status!=='published')throw fail('form_not_published',409);
  // The schema MUST originate from the versioned catalog, never directly from HTTP.
  const result=validateFormValues(schema,answers,{audience:'customer'});
  if(!result.valid)throw fail('invalid_form_values',422);
  const queries=freezeFormData(result.requirements.flatMap(r=>r.values.map(value=>({kind:r.kind,path:r.path,registryKey:r.key,value,workspaceId:context.workspaceId,accountId:context.accountId,principalId:context.principalId,bindingId:context.bindingId,accessRevision:context.accessRevision,formId:schema.id,formVersion:schema.version,draftId,draftRevision}))));
  if(queries.length){
   const controller=new AbortController(),deadline=performance.now()+timeout;let timer:ReturnType<typeof setTimeout>|undefined;let stop=()=>{};
   const aborted=new Promise<never>((_,reject)=>{stop=()=>{controller.abort();reject(fail('form_evidence_unavailable',503));};timer=setTimeout(stop,timeout);signal?.addEventListener('abort',stop,{once:true});});
   try{
    check();const raw=await Promise.race([Promise.resolve().then(()=>options.evidence.verify(queries,controller.signal)),aborted]);check();
    if(controller.signal.aborted||performance.now()>=deadline)throw fail('form_evidence_unavailable',503);
    const responses=copyFormData(raw);if(!Array.isArray(responses)||responses.length!==queries.length)throw Error();
    const rows=responses.map(r=>formRecord(r,['queryHash','status','expiresAt']));if(new Set(rows.map(r=>r.queryHash)).size!==rows.length)throw Error();
    const now=clock();if(!isCanonicalInstant(now))throw Error();
    for(const query of queries){const row=rows.find(r=>r.queryHash===requestHash(query));if(!row||row.status!==(query.kind==='file'?'clean':'verified')||!isCanonicalInstant(row.expiresAt)||compareInstants(row.expiresAt,now)<=0)throw Error();}
   }catch(e){if(e instanceof HelpdeskError&&Object.getOwnPropertyDescriptor(e,'code')?.value==='resource_scope_denied')throw fail('resource_scope_denied',403);throw fail('form_evidence_unavailable',503);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  }
  check();const at=clock();if(!isCanonicalInstant(at))throw fail('form_evidence_unavailable',503);
  // Descriptive snapshot, NOT a reusable authorization receipt or commit permission.
  return freezeFormData({formId:schema.id,formVersion:schema.version,formHash:requestHash(schema),answers:result.answers,publicAnswers:result.publicAnswers,answerHash:requestHash(result.answers),scopeHash:requestHash(context),draftId,draftRevision,validatedAt:at,commitAuthorized:false});
 }
 return Object.freeze({validateForm});
}
