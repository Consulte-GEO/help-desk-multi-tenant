import {copyFormData,freezeFormData} from '../shared/form-rules.js';import {compareInstants} from '../shared/instant.js';
const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))throw Error('Identificador inválido.');return v;};
const version=v=>{if(!Number.isSafeInteger(v)||v<1)throw Error('Revisão inválida.');return v;};
/** Authenticated fetch is injected by the host session adapter, never a stored token.
 * No challenge or user credential appears in a URL or durable browser storage. */
export function createReviewApi(options){const origin=new URL(options.origin);if(origin.protocol!=='https:'||origin.origin!==options.origin||typeof location!=='undefined'&&location.origin!==origin.origin)throw Error('Origem incompatível.');
 async function post(action,input,key,signal){const v=copyFormData(input),ticket=uuid(v.ticketId),expected=version(v.expectedVersion??v.version);delete v.ticketId;delete v.expectedVersion;delete v.version;const response=await options.fetch(origin.origin+'/v1/tickets/'+ticket+'/'+action,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','if-match':'"'+expected+'"',...(key?{'idempotency-key':key}:{})},body:JSON.stringify(v),signal});let value;try{value=await response.json();}catch{return {kind:'unknown'};}return response.ok?{kind:'confirmed',value}:response.status<500?{kind:'rejected'}:{kind:'unknown'};}
 const read=async(action,input,signal)=>{const r=await post(action,input,null,signal);if(r.kind!=='confirmed')throw Error('Não foi possível conferir a revisão.');return r.value;};
 return Object.freeze({prepare:(c,signal)=>read('approval-challenge',{ticketId:c.ticketId,expectedVersion:c.version,invitationId:c.invitationId},signal),preview:(c,signal)=>read('form-preview',c,signal),commit:(op,c,key,signal)=>{if(!['approval','revision'].includes(op))throw Error('Operação inválida.');return post(op==='approval'?'approval-decisions':'form-revisions',c,key,signal);}});
}
/** Memory-only state shared by approval and form-return panels. New contexts require
 * a new controller; clear must be called on logout/account/identity changes. */
export function createReviewState(options){let context=freezeFormData(copyFormData(options.context));uuid(context.ticketId);uuid(context.principalId);uuid(context.workspaceId);version(context.version);version(context.formRevision);if(context.invitationId!==null)uuid(context.invitationId);
 let phase='ready',challenge=null,preview=null,draft=null,intent=null,receipt=null,epoch=0,active=null;
 const clock=options.clock??(()=>new Date().toISOString()),newKey=options.key??(()=>crypto.randomUUID());
 const snapshot=()=>freezeFormData({phase,publicDiff:preview?copyFormData(preview.publicDiff):[],receipt,version:context?.version??null,formRevision:context?.formRevision??null});
 const change=()=>{try{options.onChange?.(snapshot());}catch{/* observer cannot authorize a change */}};
 const requirePhase=(allowed)=>{if(!allowed.includes(phase)||!context)throw Error('Conclua ou concilie a intenção atual.');};
 async function prepare(){requirePhase(['ready']);const generation=epoch,controller=new AbortController();active=controller;phase='preparing';change();try{const r=await options.api.prepare(context,controller.signal);if(generation!==epoch)return;
  if(r?.ticketId!==context.ticketId||r.invitationId!==context.invitationId||r.ticketVersion!==context.version||r.formRevision!==context.formRevision||r.decisionApplied!==false||typeof r.token!=='string'||!/^hd_approval_[A-Za-z0-9_-]{43}$/.test(r.token)||compareInstants(r.expiresAt,clock())<=0)throw Error();
  challenge=freezeFormData(copyFormData(r));phase='decision';
 }catch{if(generation===epoch){challenge=null;phase='error';throw Error('Recarregue o convite antes de confirmar.');}}finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}}
 async function previewRevision(input){requirePhase(['ready']);const data=copyFormData(input);if(Object.keys(data).sort().join(',')!=='comment,draftId,expectedDraftRevision'||typeof data.comment!=='string'||data.comment.length>12000)throw Error('Rascunho inválido.');uuid(data.draftId);version(data.expectedDraftRevision);
  const command=freezeFormData({...data,ticketId:context.ticketId,expectedVersion:context.version,expectedFormRevision:context.formRevision}),generation=epoch,controller=new AbortController();active=controller;phase='previewing';change();
  try{const r=await options.api.preview(command,controller.signal);if(generation!==epoch)return;
   if(r?.ticketId!==context.ticketId||r.version!==context.version||r.formRevision!==context.formRevision||r.commitAuthorized!==false||typeof r.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(r.previewHash)||!Array.isArray(r.publicDiff)||r.publicDiff.length>1000)throw Error();
   preview=freezeFormData(copyFormData(r));draft=command;phase='review';
  }catch{if(generation===epoch){preview=null;draft=null;phase='error';throw Error('Recarregue e confira o rascunho.');}}finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}
 }
 async function send(){const generation=epoch,saved=intent,controller=new AbortController();active=controller;phase='submitting';change();
  try{const result=await options.api.commit(saved.op,saved.payload,saved.key,controller.signal);if(generation!==epoch)return;
   if(result?.kind==='rejected'){phase='error';intent=null;challenge=null;preview=null;draft=null;return;}
   const r=result?.value;if(result?.kind!=='confirmed'||r?.ticketId!==context.ticketId||r.version!==context.version+1||r.formRevision!==context.formRevision+(saved.op==='revision'?1:0)||r.notification!=='pending')throw Error();
   receipt=freezeFormData({ticketId:r.ticketId,version:r.version,formRevision:r.formRevision,notification:'pending'});intent=null;challenge=null;preview=null;draft=null;phase='confirmed';
  }catch{if(generation===epoch)phase='unknown';}finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}
 }
 async function confirmApproval(decision,reason){requirePhase(['decision']);if(!challenge||compareInstants(challenge.expiresAt,clock())<=0||!['approve','reject'].includes(decision)||typeof reason!=='string'||!reason.trim()||reason.length>2000)throw Error('Informe sua decisão e justificativa.');intent=freezeFormData({op:'approval',key:newKey(),payload:{ticketId:context.ticketId,invitationId:context.invitationId,expectedVersion:context.version,expectedFormRevision:context.formRevision,token:challenge.token,decision,reason}});await send();}
 async function confirmRevision(){requirePhase(['review']);if(!preview||!draft)throw Error('Prévia obrigatória.');intent=freezeFormData({op:'revision',key:newKey(),payload:{...draft,previewHash:preview.previewHash}});await send();}
 async function reconcile(){requirePhase(['unknown']);if(!intent)throw Error('Nenhuma intenção pendente.');await send();}
 function clear(){epoch++;active?.abort();active=null;context=null;challenge=null;preview=null;draft=null;intent=null;receipt=null;phase='cleared';change();}
 return Object.freeze({snapshot,prepare,previewRevision,confirmApproval,confirmRevision,reconcile,clear});
}
