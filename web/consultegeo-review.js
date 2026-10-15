import {copyFormData,freezeFormData} from '../shared/form-rules.js';import {compareInstants} from '../shared/instant.js';
import {parseFormVersion} from '../shared/form-rules.js';import {readOperationalResponse} from './consultegeo-operation.js';import {createConsulteGeoIntakeApi} from './consultegeo-intake-api.js';
import {createReviewApi} from './review-state.js';import {mountApprovals} from './approvals.js';import {mountFormReview} from './form-review.js';import {mountDynamicForm} from './dynamic-form.js';
import {operationsUI,diffValue,deliveryView,clearOperationsNode} from './operations-ui.js';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const refsKey=refs=>canonical([...refs].map(r=>[r.connectionId,r.tenantId,r.type,r.id]).sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0));
const failure=()=>Error('Confira o rascunho salvo antes de continuar.');
/** Memory only, one draft ID and CAS revision. A lost save is read back before
 * any further save; this controller cannot create a ticket or send a notice. */
export function createRevisionDraft(options){
 let draft=freezeFormData(copyFormData(options.draft)),phase='editing',revision=0,stored=null,intent=null,active=null,epoch=0;
 if(!uuid(draft.id)||!uuid(draft.accountId)||!uuid(draft.formId)||!Number.isSafeInteger(draft.formVersion)||draft.formVersion<1||!Array.isArray(draft.refs)||!draft.refs.length)throw failure();
 const clock=options.clock??(()=>new Date().toISOString()),snapshot=()=>Object.freeze({phase,revision}),change=()=>{try{options.onChange?.(snapshot());}catch{}};
 const current=()=>{if(phase==='cleared'||!draft)throw failure();};
 function validate(raw,saved){const r=copyFormData(raw);if(!r||Object.keys(r).sort().join(',')!=='accountId,answers,expiresAt,formId,formVersion,id,refs,revision,status,ticketId'||r.id!==draft.id||r.accountId!==draft.accountId||r.formId!==draft.formId||r.formVersion!==draft.formVersion||r.revision!==saved.expected+1||r.status!=='editing'||r.ticketId!==null||refsKey(r.refs)!==refsKey(draft.refs)||canonical(r.answers)!==canonical(saved.payload.answers)||compareInstants(r.expiresAt,clock())<=0)throw failure();return r;}
 const reference=()=>Object.freeze({draftId:draft.id,expectedDraftRevision:revision});
 async function save(answers){current();if(['saving','unknown','retryable'].includes(phase))throw failure();const clean=copyFormData(answers);if(phase==='saved'&&canonical(clean)===canonical(stored))return reference();
  intent=freezeFormData({payload:{...draft,answers:clean},expected:revision,base:stored===null?null:copyFormData(stored)});return send();
 }
 async function send(){const generation=epoch,controller=new AbortController();active=controller;const owned=intent;phase='saving';change();
  try{const response=await options.api.save(owned.payload,owned.expected,controller.signal);if(generation!==epoch)return null;
   if(response?.kind==='rejected'&&response.code!=='draft_version_conflict'){intent=null;phase='error';throw failure();}
   if(response?.kind!=='confirmed')throw failure();const r=validate(response.value,owned);revision=r.revision;stored=copyFormData(r.answers);intent=null;phase='saved';return reference();
  }catch{if(generation===epoch){if(phase!=='error')phase='unknown';throw failure();}}
  finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}
 }
 async function reconcile(){current();if(phase!=='unknown'||!intent)throw failure();const owned=intent,generation=epoch,controller=new AbortController();active=controller;
  try{const raw=await options.readDraft(draft.id,controller.signal);if(generation!==epoch)return null;
   if(owned.expected===0&&raw?.absent===true&&Object.keys(raw).length===1){phase='retryable';return null;}
   if(owned.expected>0&&raw?.revision===owned.expected&&owned.base!==null){validate(raw,{expected:owned.expected-1,payload:{answers:owned.base}});phase='retryable';return null;}
   const r=validate(raw,owned);revision=r.revision;stored=copyFormData(r.answers);intent=null;phase='saved';return reference();}
  catch{if(generation===epoch){phase='unknown';throw failure();}}
  finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}
 }
 function clear(){epoch++;active?.abort();active=null;draft=null;stored=null;intent=null;revision=0;phase='cleared';change();}
 async function retry(){current();if(phase!=='retryable'||!intent)throw failure();return send();}
 return Object.freeze({save,reconcile,retry,snapshot,clear});
}

function portalContext(raw,identity,ticket){
 const v=copyFormData(raw);if(v===null)return null;const c=v?.context,f=v?.form,caps=v?.capabilities;
 if(v.schema!==1||!c||c.principalId!==identity.principalId||c.workspaceId!==identity.workspaceId||c.accountId!==ticket.account_id||c.ticketId!==ticket.id||c.version!==ticket.version||!Number.isSafeInteger(c.formRevision)||c.formRevision<1||!caps||Object.keys(caps).sort().join(',')!=='decideApproval,requestApproval,reviseForm'||Object.values(caps).some(x=>typeof x!=='boolean')||!f||!uuid(f.formId)||!Array.isArray(f.refs)||!f.refs.length||!/^CG-[1-9]\d{4,17}$/.test(v.protocol))throw failure();
 if(c.invitationId!==null&&!uuid(c.invitationId)||(c.invitationId!==null)!==caps.decideApproval)throw failure();const definition=parseFormVersion(f.definition);if(definition.id!==f.formId||definition.version!==f.formVersion||definition.status!=='published'||definition.fields.some(x=>!x.public)||typeof f.schemaHash!=='string'||!/^[a-f0-9]{64}$/.test(f.schemaHash))throw failure();
 return freezeFormData(v);
}
/** Actual authenticated host; current server projections only advise which
 * controls to show. Every command still reauthorizes in its own transaction. */
export function mountOperationalReview(root,options){
 const identity=freezeFormData(copyFormData(options.identity)),ticket=freezeFormData(copyFormData(options.ticket));if(!uuid(identity.principalId)||!uuid(identity.workspaceId)||!uuid(ticket.id)||!uuid(ticket.account_id)||typeof options.request!=='function')throw failure();
 const ui=operationsUI(root,'review-portal','Revisão e aprovação','Confira as informações da solicitação e as orientações registradas.'),{node}=ui;
 let disposed=false,epoch=0,active=null,view=null,approval=null,revision=null,editor=null,draft=null,requestPhase='ready',requestIntent=null,reviewPhase='ready',draftPhase='editing',confirmed=false;
 const contents=node('div'),attention=node('section'),attentionStatus=node('p','',{role:'status','aria-live':'polite'}),attentionList=node('ul');
 const labels={'support.created':'Abertura','support.devolutiva':'Informações solicitadas','support.resolved':'Solução','support.transition':'Atendimento iniciado','support.reply':'Resposta pública','support.handoff':'Encaminhamento','support.closed':'Encerramento','support.reopened':'Reabertura','support.cancelled':'Cancelamento','internal.queue_created':'Fila de atendimento','internal.assignment_changed':'Atribuição','support.customer_reply':'Resposta do solicitante','support.form_revised':'Revisão de formulário','support.approval_requested':'Aprovação solicitada','support.approval_granted':'Aprovação registrada','support.approval_rejected':'Correção solicitada'};
 const busy=()=>['sending','unknown'].includes(requestPhase)||['preparing','previewing','submitting','unknown'].includes(reviewPhase)||['saving','unknown','retryable'].includes(draftPhase);
 function notify(){if(disposed)return;try{options.onChange?.({blocked:busy(),phase:reviewPhase,requestPhase,draftPhase});}catch{}}
 function reported(s){if(disposed)return;reviewPhase=s.phase;notify();if(s.phase==='confirmed'&&!confirmed){confirmed=true;queueMicrotask(()=>{if(!disposed)options.onConfirmed?.();});}}
 function wipe(){approval?.destroy();revision?.destroy();editor?.destroy();draft?.clear();approval=revision=editor=draft=null;clearOperationsNode(contents);}
 const refresh=ui.button('Atualizar revisão do chamado','refresh-review',()=>options.onRefresh?.());refresh.setAttribute('data-review-action','refresh');
 async function readAttention(){if(disposed||!options.canReadAttention)return;const generation=epoch,controller=new AbortController();active=controller;attentionButton.disabled=true;attentionList.replaceChildren();attentionStatus.textContent='Consultando o estado das notificações…';
  try{const {response,data}=await readOperationalResponse(options.request,'/tickets/'+ticket.id+'/notification-attention',{method:'GET'},controller.signal);if(disposed||generation!==epoch)return;
   if(response.status!==200||data?.ticketId!==ticket.id||data.workspaceId!==identity.workspaceId||data.accountId!==ticket.account_id||data.limit!==20||data.resendAvailable!==false||!Array.isArray(data.items)||data.items.length>20)throw failure();
   for(const item of data.items){const presentation=deliveryView(item.state),label=labels[item.kind];if(!uuid(item.id)||!label||typeof item.attention!=='boolean')throw failure();const row=node('li');row.append(node('strong',label+' · '+presentation.label),node('p',item.state==='accepted'?'Confirmação de entrega pendente.':item.attention?'Precisa de conferência pela equipe.':''));attentionList.append(row);}
   attentionStatus.textContent=data.items.length?'Últimas notificações registradas para este chamado.':'Não há notificações registradas para este chamado.';
  }catch{if(!disposed&&generation===epoch){attentionList.replaceChildren();attentionStatus.textContent='Consulta indisponível. Confira o acesso e entre novamente usando o autenticador.';}}
  finally{controller.abort();if(active===controller)active=null;if(!disposed&&generation===epoch)attentionButton.disabled=false;}
 }
 const attentionButton=ui.button('Consultar estado dos e-mails','read-attention',()=>void readAttention());attentionButton.setAttribute('data-review-action','read-attention');attention.hidden=options.canReadAttention!==true;attention.append(node('h3','Notificações do chamado'),node('p','Este painel permite acompanhar falhas e confirmações de entrega.'),attentionButton,attentionStatus,attentionList);
 function mount(v){wipe();if(v===null){contents.append(node('p','O histórico e as ações disponíveis estão no atendimento deste chamado.'));ui.report('');return;}
  contents.append(node('p',v.protocol+' · formulário, revisão '+v.context.formRevision));
  if(v.decision){const box=node('section');box.append(node('h3','Última decisão registrada · revisão '+v.decision.formRevision),node('p',v.decision.decision==='approve'?'Aprovação registrada.':'Correção solicitada.'),node('p',v.decision.reason));contents.append(box);}
  const answers=node('dl',undefined,{class:'hd-ops-facts'});for(const field of v.form.definition.fields){if(!Object.hasOwn(v.form.answers,field.key))continue;const pair=node('div');pair.append(node('dt',field.label),node('dd',diffValue(v.form.answers[field.key])));answers.append(pair);}contents.append(answers);
  const api=createReviewApi({origin:options.origin,fetch:(url,init)=>{const path=new URL(url);if(path.origin!==options.origin||!path.pathname.startsWith('/v1/'))throw failure();return options.request(path.pathname.slice(3),init);}});
  if(v.capabilities.requestApproval){
   const requestBox=node('section'),requestStatus=node('p','Nenhum convite é enviado apenas por abrir esta tela.',{role:'status'});
   const ask=ui.button('Solicitar aprovação','request-approval',()=>void requestInvitation(false)),reconcile=ui.button('Conferir mesma solicitação','reconcile-invitation',()=>void requestInvitation(true));ask.setAttribute('data-review-action','request-approval');reconcile.setAttribute('data-review-action','reconcile-invitation');reconcile.hidden=true;
   const draw=()=>{ask.hidden=requestPhase!=='ready';ask.disabled=requestPhase==='sending';reconcile.hidden=requestPhase!=='unknown';reconcile.disabled=requestPhase==='sending';refresh.disabled=busy();notify();};
   async function requestInvitation(reconciling){if(disposed||requestPhase!==(reconciling?'unknown':'ready'))return;const generation=epoch,controller=new AbortController();active=controller;if(!requestIntent)requestIntent={key:crypto.randomUUID(),version:v.context.version};const intent=requestIntent;requestPhase='sending';requestStatus.textContent='Registrando a solicitação de aprovação…';draw();
    try{const {response,data}=await readOperationalResponse(options.request,'/tickets/'+ticket.id+'/approval-invitations',{method:'POST',headers:{'content-type':'application/json','if-match':'"'+intent.version+'"','idempotency-key':intent.key},body:'{}'},controller.signal);if(disposed||generation!==epoch)return;
     if(!response.ok){requestPhase=response.status<500&&!reconciling?'error':'unknown';throw failure();}
     if(![200,202].includes(response.status)||data?.ticketId!==ticket.id||data.workspaceId!==identity.workspaceId||data.accountId!==ticket.account_id||data.actorId!==identity.principalId||!uuid(data.invitationId)||data.ticketVersion!==v.context.version||data.formRevision!==v.context.formRevision||data.notification!=='pending'||typeof data.replayed!=='boolean')throw failure();
     requestPhase='confirmed';requestIntent=null;requestStatus.textContent='Solicitação de aprovação registrada. Notificação pendente.';if(!confirmed){confirmed=true;queueMicrotask(()=>{if(!disposed)options.onConfirmed?.();});}
    }catch{if(!disposed&&generation===epoch){if(requestPhase!=='error')requestPhase='unknown';requestStatus.textContent=requestPhase==='unknown'?'Confirmação desconhecida. Confira esta mesma solicitação antes de continuar.':'Não foi possível solicitar a aprovação. Atualize o chamado e confira suas permissões.';}}
    finally{controller.abort();if(active===controller)active=null;if(!disposed&&generation===epoch)draw();}
   }
   requestBox.append(ask,reconcile,requestStatus);contents.append(requestBox);
  }
  if(v.capabilities.decideApproval){const target=node('div');contents.append(target);approval=mountApprovals(target,{context:v.context,api,onChange:reported});}
  if(v.capabilities.reviseForm){
   const formRoot=node('div'),revisionRoot=node('div'),comment=ui.field('Comentário da correção','revision-comment','textarea','Informe o que foi corrigido, se necessário. Até 2.000 caracteres.'),draftStatus=node('p','',{role:'status'}),checkDraft=ui.button('Conferir rascunho salvo','reconcile-draft',()=>void reconcileDraft());comment.input.maxLength=2000;checkDraft.hidden=true;checkDraft.setAttribute('data-review-action','reconcile-draft');
   contents.append(node('h3','Corrigir informações'),node('p','Ao salvar e conferir, você verá as diferenças antes de confirmar a revisão.'),formRoot,comment.box,draftStatus,checkDraft,revisionRoot);
   const editable=()=>!disposed&&reviewPhase==='ready'&&!['saving','unknown','retryable'].includes(draftPhase);
   const draw=()=>{if(disposed)return;formRoot.inert=!editable();comment.input.disabled=!editable();revisionRoot.inert=['unknown','retryable'].includes(draftPhase);checkDraft.hidden=!['unknown','retryable'].includes(draftPhase);checkDraft.textContent=draftPhase==='retryable'?'Tentar salvar o mesmo rascunho':'Conferir rascunho salvo';refresh.disabled=busy();notify();};
   editor=mountDynamicForm(formRoot,{schema:v.form.definition,answers:v.form.answers,audience:'customer',canEdit:editable});
   const descriptor={id:crypto.randomUUID(),accountId:ticket.account_id,refs:v.form.refs,formId:v.form.formId,formVersion:v.form.formVersion};
   const draftApi=createConsulteGeoIntakeApi({draft:descriptor,context:{...identity,accountId:ticket.account_id,refs:v.form.refs,coverageId:null},profileVersionId:'cg-wf-'+descriptor.formId+'-v'+descriptor.formVersion,request:options.request});
   draft=createRevisionDraft({draft:descriptor,api:draftApi,readDraft:async(id,signal)=>{const r=await readOperationalResponse(options.request,'/form-drafts/'+id,{method:'GET'},signal);if(r.response.status===404)return {absent:true};if(r.response.status!==200)throw failure();return r.data;},onChange:s=>{draftPhase=s.phase;draftStatus.textContent=s.phase==='unknown'?'O resultado do salvamento é desconhecido. Confira o rascunho salvo antes de continuar.':s.phase==='retryable'?'O rascunho não contém esta gravação. Você pode tentar salvar exatamente a mesma correção.':s.phase==='saved'?'Rascunho salvo e conferido.':'';draw();}});
   async function reconcileDraft(){try{if(draftPhase==='retryable')await draft.retry();else await draft.reconcile();}catch{if(!disposed)draftStatus.textContent='Não foi possível conferir este rascunho. Preserve a correção e confira seu acesso.';}}
   revision=mountFormReview(revisionRoot,{context:v.context,api,saveOnPreview:true,savedDraft:async()=>{if(!editor.validate({focus:true}).valid)throw failure();const saved=await draft.save(editor.draftAnswers());if(!saved)throw failure();return {...saved,comment:comment.input.value};},onChange:s=>{reported(s);draw();}});draw();
  }
  ui.report(v.capabilities.decideApproval?'Confira o convite antes de registrar sua decisão.':v.capabilities.reviseForm?'Corrija os dados e confira as diferenças antes de confirmar.':'As ações serão verificadas novamente no envio.');
 }
 async function load(){if(disposed||busy())return false;const generation=++epoch,controller=new AbortController();active?.abort();active=controller;view=null;wipe();ui.report('Consultando a revisão autorizada…');
  try{const {response,data}=await readOperationalResponse(options.request,'/tickets/'+ticket.id+'/review-context',{method:'GET'},controller.signal);if(disposed||generation!==epoch)return false;if(response.status!==200)throw failure();view=portalContext(data,identity,ticket);mount(view);return true;}
  catch{if(!disposed&&generation===epoch){wipe();ui.report('Atualize o chamado para conferir a revisão e as permissões atuais.','warning');}return false;}
  finally{controller.abort();if(active===controller)active=null;}
 }
 ui.section.append(contents,refresh,attention);ui.mount();
 return Object.freeze({load,blocked:busy,destroy(){if(disposed)return;disposed=true;epoch++;active?.abort();active=null;requestIntent=null;view=null;wipe();ui.destroy();options={};}});
}
