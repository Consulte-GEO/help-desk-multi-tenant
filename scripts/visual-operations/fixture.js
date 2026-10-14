/* TEST ONLY: explicit in-memory adapters. Never copied to dist. */
import {mountExecutionChecklist} from '../../web/execution-checklist.js';
import {mountAttachments} from '../../web/attachments.js';
import {mountApprovals} from '../../web/approvals.js';
import {mountFormReview} from '../../web/form-review.js';
import {mountDeliveryOperations} from '../../web/delivery-operations.js';
const ID=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const a={principalId:ID(1),workspaceId:ID(2),accountId:ID(3),ticketId:ID(4),canWrite:true};
const c={principalId:ID(1),workspaceId:ID(2),ticketId:ID(4),version:7,formRevision:2,invitationId:ID(5)};
const at='2026-10-13T12:00:00.000Z';
const makeRecord=()=>({context:{workspaceId:ID(2),accountId:ID(3),ticketId:ID(4),ticketVersion:7,profileVersionId:'profile-1',reference:{id:'checklist-1',version:1,sha256:'a'.repeat(64)}},template:{schema:1,id:'checklist-1',version:1,status:'published',items:[{id:'check',label:'Conferir a execução e vincular a evidência da solicitação',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'sensitive'},{id:'ordinary',label:'Validar o resultado do atendimento',required:true,allowNotApplicable:false,evidenceRequired:false,risk:'ordinary'},{id:'optional',label:'Conferência complementar',required:false,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary'}]},snapshot:null,ticketStatus:'open',assignedTo:ID(1),readAt:at});
window.ID=ID;
window.setup=kind=>{
 window.P?.destroy();document.getElementById('root').replaceChildren();window.CALLS=[];window.MODE='ok';window.NOW=at;window.RECORD=makeRecord();window.FILE_STATUS='pending_scan';window.TUS={};window.PUBLIC_DIFF=[{path:'Descrição da solicitação',before:'Acesso solicitado para conferência.',after:'Acesso solicitado para conferência e revisão do atendimento.',privateExtra:'DO_NOT_RENDER'},{path:'Notificação autorizada',before:false,after:true}];window.DELIVERY='accepted';
 window.DEFERRED=null;window.DRAFT_LOOKUPS=0;
 const log=(op,value={})=>CALLS.push({op,...structuredClone(value)});
 const waitOrFail=async()=>{if(MODE==='delay')await new Promise(r=>window.DEFERRED=r);else if(MODE==='unknown')throw Error('PRIVATE_PROVIDER_ERROR');};
 const request=async(path,init={})=>{
  log('checklist',{path,method:init.method??'GET',body:init.body??null,headers:init.headers??{}});await waitOrFail();
  const rev=RECORD.snapshot?.revision??0;
  if(MODE==='refused')return Response.json({status:412,code:'checklist_version_conflict'},{status:412});
  if(path.endsWith('/evidence'))return Response.json({...a,ticketVersion:7,checklistRevision:rev,readAt:RECORD.readAt,items:[{id:ID(10),at:'2026-10-13T11:40:00.000Z'},{id:ID(9),at:'2026-10-13T11:40:00.000Z'}],next:null,canWrite:undefined},{headers:{etag:'"'+rev+'"'}});
  if(path.endsWith('/marks')){
   const cmd=JSON.parse(init.body),time='2026-10-13T12:01:00.000Z';
   const receipt={ticketId:a.ticketId,workspaceId:a.workspaceId,accountId:a.accountId,actorId:a.principalId,itemId:cmd.itemId,status:cmd.status,ticketVersion:7,checklistRevision:rev+1,auditId:ID(90),at:time,replayed:false};
   RECORD.readAt=time;RECORD.snapshot={...RECORD.context,revision:rev+1,entries:[{itemId:cmd.itemId,status:cmd.status,actorId:a.principalId,at:time,evidenceRefs:cmd.evidenceRefs,reason:cmd.reason,riskAcknowledgement:cmd.acknowledgeRisk?{actorId:a.principalId,at:time,statement:'Conferido pelo responsável'}:null}]};
   return Response.json(receipt,{headers:{etag:'"'+(rev+1)+'"'}});
  }
  return Response.json(RECORD,{headers:{etag:'"'+rev+'"'}});
 };
 // Remove a non-contract fixture attribute; real parser rejects any additional key.
 const checklistRequest=async(path,init)=>{
  const r=await request(path,init);
  if(path.endsWith('/evidence')&&r.ok){const v=await r.json();delete v.canWrite;return Response.json(v,{headers:{etag:r.headers.get('etag')}});}
  return r;
 };
 const reviewApi={
  prepare:async()=>{log('prepare');await waitOrFail();return {ticketId:ID(4),invitationId:ID(5),ticketVersion:7,formRevision:2,decisionApplied:false,token:'hd_approval_'+'a'.repeat(43),expiresAt:'2026-10-13T13:00:00.000Z'};},
  preview:async command=>{log('preview',{command});await waitOrFail();return {ticketId:ID(4),version:7,formRevision:2,commitAuthorized:false,previewHash:'b'.repeat(64),publicDiff:PUBLIC_DIFF};},
  commit:async(op,payload,key)=>{log('commit',{kind:op,payload,key});await waitOrFail();return MODE==='refused'?{kind:'rejected'}:{kind:'confirmed',value:{ticketId:ID(4),version:8,formRevision:op==='revision'?3:2,notification:'pending'}};},
 };
 const nativeFetch=window.__nativeFetch??window.fetch;window.__nativeFetch=nativeFetch;window.fetch=nativeFetch;
 const fileApi={
  start:async(input,key)=>{log('file-start',{input,key});await waitOrFail();const uploadId='file-'+CALLS.filter(c=>c.op==='file-start').length;const endpoint='https://upload.example.invalid/'+uploadId;TUS[endpoint]={size:input.bytes,offset:0};return {uploadId,status:'uploading',upload:{protocol:'tus',endpoint,token:'private-fixture-token-for-transfer',objectKey:'not-a-public-path',expiresAt:'2099-01-01T00:00:00.000Z'}};},
  saveSelection:async ids=>{log('file-save',{ids});return {revision:1};},
  bind:async(uploadId,revision)=>{log('file-bind',{uploadId,revision});},
  finish:async(uploadId,key)=>{log('file-finish',{uploadId,key});if(MODE==='finish-unknown')throw Error('private');return {uploadId,status:FILE_STATUS};},
 };
 const tusFetch=async(url,init)=>{
  if(!TUS[url])throw Error('Unexpected test request');const f=TUS[url];log('tus',{method:init.method,offset:init.headers['upload-offset']??null});
  if(init.method==='HEAD')return new Response(null,{status:200,headers:{'tus-resumable':'1.0.0','upload-length':String(f.size),'upload-offset':String(f.offset)}});
  if(MODE==='tus-delay')await new Promise(r=>window.DEFERRED=r);
  f.offset+=init.body.size;return new Response(null,{status:204,headers:{'tus-resumable':'1.0.0','upload-offset':String(f.offset)}});
 };
 const root=document.getElementById('root');
 if(kind==='checklist')window.P=mountExecutionChecklist(root,{audience:a,request:checklistRequest,timeoutMs:5000});
 if(kind==='attachments'){window.fetch=tusFetch;window.P=mountAttachments(root,{api:fileApi});}
 if(kind==='approval')window.P=mountApprovals(root,{context:c,clock:()=>NOW,api:reviewApi});
 if(kind==='revision')window.P=mountFormReview(root,{context:c,clock:()=>NOW,api:reviewApi,savedDraft:async()=>{DRAFT_LOOKUPS++;if(MODE==='draft-delay')await new Promise(r=>window.DEFERRED=r);return {draftId:ID(6),expectedDraftRevision:3,comment:'Conferência pública'};}});
 if(kind==='delivery')window.P=mountDeliveryOperations(root,{intentId:ID(8),api:{read:async()=>{log('delivery-read');await waitOrFail();return {intentId:ID(8),state:DELIVERY,attempts:0,attention:DELIVERY==='unknown',nextAttemptAt:null,rawPayload:'DO_NOT_RENDER',address:'PRIVATE_ADDRESS'};},reconcile:async()=>{log('delivery-evidence');await waitOrFail();return {intentId:ID(8),state:DELIVERY,attempts:1,attention:false,nextAttemptAt:'2026-10-13T14:00:00.123456Z'};}}});
};
window.READY=true;
