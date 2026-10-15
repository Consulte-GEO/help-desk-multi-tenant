import {readVersionReceiptHeader} from './version-receipt.js';
import {observeResponseDiagnostic} from './response-diagnostic.js';
import {readEvidencePage} from '../shared/checklist-evidence.js';
import {copyFormData,freezeFormData} from '../shared/form-rules.js';
import {checklistAudience,readChecklistPresentation,prepareChecklistMark,readChecklistMarkReceipt} from './execution-checklist-contract.js';

const safeRejections=new Map([
 ['resource_scope_denied',403],['resource_scope_database_mismatch',403],
 ['invalid_checklist_mark',400],['checklist_forbidden',403],['checklist_evidence_denied',403],['checklist_state_conflict',409],['checklist_intent_conflict',409],
 ['checklist_binding_required',409],['checklist_risk_ack_required',409],['checklist_version_conflict',412],['invalid_identifier',400],['invalid_idempotency_key',400],
 ['precondition_required',428],['origin_denied',403],['unauthorized',401],['membership_required',403],['rate_limit_exceeded',429],['unsupported_media_type',415],
 ['invalid_json',400],['payload_too_large',413],['request_cancelled',409],['request_timeout',408],['release_gate_closed',503]
]);
const emptyEvidence=()=>({phase:'idle',items:[],selected:[],next:null,message:''});
const empty=phase=>({phase,evidence:emptyEvidence(),record:null,draft:null,review:null,receipt:null,requiredTotal:null,requiredCompleted:null,canEdit:false,message:''});
const failure=()=>new Error('Resposta indisponível.');
/** One bounded request/response attempt. The host adapter must use the CURRENT
 * memory-only session and must never automatically retry mutations. No identity,
 * credential, trace or opaque payload is logged, persisted or put in the URL here.
 */
async function attempt(request,path,init,controller,timeoutMs,diagnostic){let category='request';
 const deadline=performance.now()+timeoutMs;let timer,abortListener,reader,response,complete=false;
 const cancelled=new WeakSet();
 const discard=value=>{try{if(value instanceof Response&&!cancelled.has(value)){cancelled.add(value);void value.body?.cancel().catch(()=>{});}}catch{/* cleanup only */}};
 const stopped=new Promise((_,reject)=>{
  abortListener=()=>reject(failure());controller.signal.addEventListener('abort',abortListener,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(failure());},timeoutMs);
 });
 const check=()=>{if(controller.signal.aborted||performance.now()>=deadline)throw failure();};
 try{
  check();const dispatched=Promise.resolve().then(()=>{check();return request(path,{...init,signal:controller.signal});});
  // A transport that ignores abort may resolve late. Dispose its unread body;
  // do not adopt it as a new result or leave it retaining network resources.
  void dispatched.then(value=>{if(controller.signal.aborted||performance.now()>=deadline)discard(value);},()=>{});
  response=await Promise.race([dispatched,stopped]);check();
  category='response_type';if(!(response instanceof Response))throw failure();category='response_content_type';if(!/^application\/(?:problem\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw failure();category='response_body';if(!response.body)throw failure();
  reader=response.body.getReader();const chunks=[];let size=0;
  for(;;){const part=await Promise.race([reader.read(),stopped]);check();if(part.done){complete=true;break;}
   size+=part.value.byteLength;if(size>262144)throw failure();chunks.push(part.value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  category='response_json';const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check();
  category='response_version';return {data,status:response.status,etag:readVersionReceiptHeader(response)};
 }catch(error){observeResponseDiagnostic(diagnostic,category);throw error;}finally{
  clearTimeout(timer);controller.signal.removeEventListener('abort',abortListener);
  if(!complete){if(reader)try{void reader.cancel().catch(()=>{});}catch{/* no response details */}else discard(response);}
  try{reader?.releaseLock();}catch{/* pending cancelled read */}
 }
}
function knownRefusal(result){try{const d=copyFormData(result.data);return d&&d.status===result.status&&typeof d.code==='string'&&safeRejections.get(d.code)===result.status;}catch{return false;}}

/** Private optional controller. Allocation has no side effects and no automatic
 * read, write, resolution, note creation or source-system action. The shell must
 * call clear/changeAudience on logout and every account/ticket/context change.
 */
export function createExecutionChecklistController(options){
 if(typeof options.request!=='function')throw new Error('Adaptador autenticado obrigatório.');
 let evidenceActive=null,evidenceEpoch=0;
 let audience=checklistAudience(options.audience),state=empty('idle'),generation=0,active=null,pending=null,destroyed=false;
 const timeoutMs=options.timeoutMs??5000,newKey=options.key??(()=>crypto.randomUUID());
 if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw new Error('Prazo inválido.');
 const view=()=>freezeFormData(copyFormData({...state,hasUnconfirmedWrite:pending!==null&&(state.phase==='saving'||state.phase==='unknown')}));
 const emit=()=>{if(!destroyed)try{options.onState?.(view());}catch{/* Observers cannot authorize dispatch. */}};
 const alive=(token,controller)=>!destroyed&&audience!==null&&generation===token&&active===controller;
 const editable=()=>audience!==null&&!destroyed&&state.phase==='ready'&&state.canEdit;
 function stopEvidence(){evidenceEpoch++;evidenceActive?.abort();evidenceActive=null;}
 function wipe(phase){stopEvidence();generation++;active?.abort();active=null;pending=null;state=empty(phase);}
 function changeAudience(raw){if(destroyed)return false;const next=checklistAudience(raw);wipe('idle');audience=next;emit();return true;}
 function clear(){if(destroyed)return false;wipe('empty');audience=null;emit();return true;}
 async function load(){
  if(destroyed||!audience||!['idle','ready','refresh_required','error'].includes(state.phase))return false;
  const person=audience,token=++generation,controller=new AbortController();let readCategory=null;active?.abort();active=controller;
  state={...empty('loading'),message:'Carregando o checklist desta revisão…'};emit();
  try{
   if(!alive(token,controller))return false;
   const result=await attempt(options.request,'/v1/internal/tickets/'+person.ticketId+'/execution-checklist',{method:'GET',cache:'no-store'},controller,timeoutMs,options.onResponseDiagnostic);
   readCategory=result.etag!==JSON.stringify(String(result.data?.snapshot?.revision??0))?'checklist_etag':'checklist_receipt';
   if(!alive(token,controller))return false;if(result.status!==200)throw failure();
   const presentation=readChecklistPresentation(result.data,person,result.etag);
   state={...empty('ready'),...presentation,message:presentation.canEdit?'Confira a execução e registre cada item.':'Consulta interna. Somente o responsável autorizado pode registrar itens.'};return true;
  }catch{if(alive(token,controller)){observeResponseDiagnostic(options.onResponseDiagnostic,readCategory);state={...empty('error'),message:'Não foi possível consultar a revisão. Confira o acesso e tente atualizar.'};}return false;}
  finally{controller.abort();if(active===controller)active=null;if(!destroyed&&generation===token)emit();}
 }
 function editItem(itemId){
  if(!editable())return false;const item=state.record.template.items.find(i=>i.id===itemId);if(!item)return false;
  stopEvidence();state={...state,evidence:emptyEvidence(),phase:'editing',receipt:null,review:null,draft:{itemId,status:'done',evidenceText:'',reason:'',acknowledgeRisk:false},message:'Revise a marcação antes de confirmar.'};emit();return true;
 }
 function setField(name,value){
  if(destroyed||!audience||state.phase!=='editing'||!['status','evidenceText','reason','acknowledgeRisk'].includes(name))return false;
  if(name==='acknowledgeRisk'?typeof value!=='boolean':typeof value!=='string')return false;
  if(typeof value==='string'&&value.length>(name==='evidenceText'?1000:name==='reason'?2000:30))return false;
  let ev=state.evidence;if(name==='status'||name==='evidenceText'){stopEvidence();ev=emptyEvidence();}
  const draft={...state.draft,[name]:value};if(name==='status'&&value!=='done'){draft.evidenceText='';draft.acknowledgeRisk=false;}
  state={...state,evidence:ev,draft,message:''};emit();return true;
 }
 /** Explicit private lookup only. It never creates a note or grants a mark.
  * Page contents are not durable evidence: POST/resolve recheck the source again. */
 async function loadEvidence(more=false){
  if(destroyed||!audience||state.phase!=='editing'||state.draft.status!=='done'||state.evidence.phase==='loading'||typeof more!=='boolean')return false;
  if(more&&(state.evidence.phase!=='ready'||!state.evidence.next))return false;
  const person=audience,record=state.record,itemId=state.draft.itemId,token=generation;
  const query={expectedTicketVersion:record.context.ticketVersion,expectedChecklistRevision:record.snapshot?.revision??0,before:more?state.evidence.next:null};
  const selected=more?state.evidence.selected:[];
  stopEvidence();const epoch=evidenceEpoch,controller=new AbortController();evidenceActive=controller;
  const current=()=>!destroyed&&audience===person&&generation===token&&evidenceEpoch===epoch&&evidenceActive===controller&&state.phase==='editing'&&state.draft?.itemId===itemId&&state.draft.status==='done';
  state={...state,draft:{...state.draft,evidenceText:more?state.draft.evidenceText:''},evidence:{phase:'loading',items:[],selected,next:null,message:'Consultando suas notas deste chamado…'}};emit();
  try{
   if(!current())return false;
   const result=await attempt(options.request,'/v1/internal/tickets/'+person.ticketId+'/execution-checklist/evidence',{
    method:'POST',cache:'no-store',headers:{'content-type':'application/json','if-match':'"'+query.expectedChecklistRevision+'"'},body:JSON.stringify(query)
   },controller,timeoutMs);
   if(!current())return false;if(result.status!==200||result.etag!=='"'+query.expectedChecklistRevision+'"')throw failure();
   const page=readEvidencePage(result.data,{principalId:person.principalId,workspaceId:person.workspaceId,accountId:person.accountId,ticketId:person.ticketId,
    ticketVersion:record.context.ticketVersion,checklistRevision:record.snapshot?.revision??0,readAt:record.readAt},query);
   // Selected references may come from previous pages. A repeated ID with changed
   // metadata is not adopted as another note; the list is not a live grant.
   if(page.items.some(i=>selected.some(s=>s.id===i.id&&s.at!==i.at)))throw failure();
   state={...state,evidence:{phase:'ready',items:page.items,selected,next:page.next,message:page.items.length?'Selecione as notas da conferência. Confira o conteúdo na conversa.':'Nenhuma nota elegível nesta página. Registre a conferência na conversa e consulte novamente.'}};
   return true;
  }catch{
   if(current())state={...state,draft:{...state.draft,evidenceText:''},evidence:{...emptyEvidence(),phase:'error',message:'Consulta indisponível. Confira acesso e revisão do chamado antes de tentar novamente.'}};
   return false;
  }finally{controller.abort();if(evidenceActive===controller)evidenceActive=null;if(!destroyed&&generation===token&&evidenceEpoch===epoch)emit();}
 }
 function toggleEvidence(noteId){
  if(destroyed||!audience||state.phase!=='editing'||state.draft.status!=='done'||state.evidence.phase!=='ready')return false;
  const old=state.evidence.selected,existing=old.find(i=>i.id===noteId),item=state.evidence.items.find(i=>i.id===noteId);
  if(!existing&&!item)return false;
  if(!existing&&old.length>=20){state={...state,evidence:{...state.evidence,message:'Selecione no máximo 20 notas. Remova uma seleção para escolher outra.'}};emit();return false;}
  const selected=existing?old.filter(i=>i.id!==noteId):[...old,item];
  state={...state,draft:{...state.draft,evidenceText:selected.map(i=>'note:'+i.id).join('\n')},evidence:{...state.evidence,selected,message:selected.length+' nota(s) selecionada(s). A marcação ainda não foi enviada.'}};emit();return true;
 }
 function review(){
  if(destroyed||state.phase!=='editing'||state.evidence.phase==='loading')return false;
  try{
   const body=prepareChecklistMark(state.record,state.draft),item=state.record.template.items.find(i=>i.id===body.itemId);
   state={...state,phase:'review',review:{itemId:body.itemId,label:item.label,status:body.status,evidenceCount:body.evidenceRefs.length,reason:body.reason,risk:item.risk},message:'Nenhuma alteração foi enviada. Confirme após conferir os dados.'};emit();return true;
  }catch{state={...state,message:'Confira a evidência, o motivo e o reconhecimento do risco exigidos para este item.'};emit();return false;}
 }
 function back(){if(destroyed||state.phase!=='review')return false;state={...state,phase:'editing',review:null,message:''};emit();return true;}
 function cancel(){if(destroyed||!['editing','review'].includes(state.phase))return false;stopEvidence();state={...state,evidence:emptyEvidence(),phase:'ready',draft:null,review:null,message:'Marcação não enviada.'};emit();return true;}
 async function send(reconciling){
  const saved=pending,token=generation,controller=new AbortController();active=controller;
  stopEvidence();state={...state,evidence:emptyEvidence(),phase:'saving',draft:null,record:null,canEdit:false,requiredTotal:null,requiredCompleted:null,message:reconciling?'Consultando o resultado da mesma intenção…':'Registrando a marcação…'};emit();
  try{
   if(!saved||!alive(token,controller))return false;
   const result=await attempt(options.request,saved.path,{method:'POST',cache:'no-store',headers:saved.headers,body:saved.body},controller,timeoutMs);
   if(!alive(token,controller))return false;
   if(result.status===200){
    const receipt=readChecklistMarkReceipt(result.data,saved.audience,saved.command,saved.readAt,result.etag);
    pending=null;state={...empty('refresh_required'),receipt,message:'Marcação registrada. Atualize o checklist antes da próxima alteração.'};return true;
   }
   // A refusal on a later replay says nothing about the FIRST attempt's commit.
   if(!reconciling&&knownRefusal(result)){
    pending=null;state={...empty('refresh_required'),message:'Marcação recusada. Atualize a revisão e confira acesso, atribuição e evidência antes de tentar novamente.'};return false;
   }
   throw failure();
  }catch{
   if(alive(token,controller))state={...empty('unknown'),message:'Confirmação desconhecida. Não crie outra marcação: concilie esta mesma intenção. Se o acesso foi revogado, consulte o responsável.'};return false;
  }finally{controller.abort();if(active===controller)active=null;if(!destroyed&&generation===token)emit();}
 }
 async function confirm(){
  if(destroyed||!audience||state.phase!=='review'||pending!==null)return false;
  try{
   const command=prepareChecklistMark(state.record,state.draft),key=newKey();if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw failure();
   pending=freezeFormData({audience,command,key,readAt:state.record.readAt,path:'/v1/internal/tickets/'+audience.ticketId+'/execution-checklist/marks',
    headers:{'content-type':'application/json','if-match':'"'+command.expectedChecklistRevision+'"','idempotency-key':key},body:JSON.stringify(command)});
  }catch{state={...state,message:'Não foi possível preparar uma intenção válida. Revise os dados.'};emit();return false;}
  return send(false);
 }
 async function reconcile(){if(destroyed||!audience||state.phase!=='unknown'||pending===null)return false;return send(true);}
 function destroy(){if(destroyed)return;wipe('disposed');audience=null;destroyed=true;}
 return Object.freeze({view,load,editItem,setField,loadEvidence,toggleEvidence,review,back,cancel,confirm,reconcile,changeAudience,clear,destroy});
}
