import {operationsUI} from './operations-ui.js';
import {CSAT_RATINGS,csatIssues,externalWorkView,knowledgeView,packageAvailability} from './support-presentation.js';

/** One owner per root. Replacing a panel clears old text/controls/listeners, including
 * detached references. Host MUST dispose on audience changes; rendering never authenticates.
 */
const mounted = new WeakMap();
function surface(root,kind,title,description) {
 mounted.get(root)?.dispose();
 const ui=operationsUI(root,kind,title,description);
 ui.section.setAttribute('data-support-panel',kind);
 let closed=false;
 const cleanup=[];
 const life=Object.freeze({dispose(){
  if(closed)return;closed=true;
  for(const fn of cleanup)fn();cleanup.length=0;
  ui.destroy();
  if(mounted.get(root)===life)mounted.delete(root);
 }});
 mounted.set(root,life);
 return {ui,life,alive:()=>!closed&&mounted.get(root)===life,onDispose:fn=>cleanup.push(fn)};
}
function actions(ui,...buttons) {
 const box=ui.node('div',undefined,{class:'hd-ops-actions'});box.append(...buttons);return box;
}
/** Callback may be sync or async. No automatic invocation; one request while pending.
 * A void/fulfilled callback is never interpreted as server approval or delivery.
 */
function explicitAction(panel,button,callback,successMessage) {
 const {ui,alive}=panel;let pending=false;
 ui.listen(button,'click',async()=>{
  if(!alive()||pending||button.disabled||button.hidden)return;
  pending=true;button.disabled=true;button.setAttribute('aria-busy','true');ui.report('Encaminhando solicitação…','info');
  try {await callback();if(alive())ui.report(successMessage,'info');}
  catch {if(alive())ui.report('Não foi possível confirmar a solicitação. Tente novamente pelo aplicativo.','warning');}
  finally {if(alive()){pending=false;button.disabled=false;button.removeAttribute('aria-busy');}}
 });
}

export function renderKnowledge(root,result,onOpenTicket) {
 const panel=surface(root,'knowledge','Ajuda e orientações','Consulte as orientações disponíveis ou fale com a equipe de atendimento.'),{ui}=panel;
 const view=knowledgeView(result);
 // Content availability and the result of opening a ticket are independent states.
 ui.report('');
 if(view.state!=='ready'){
  const notice=ui.node('p',view.state==='unavailable'?'Conhecimento indisponível. Isso não impede a abertura de um chamado quando seu acesso estiver autorizado.':'Nenhuma orientação disponível nesta consulta. A equipe pode ajudar pelo chamado.',{class:'hd-ops-notice','data-support-knowledge-state':view.state,'data-tone':view.state==='unavailable'?'warning':'neutral'});
  ui.section.append(notice);
 }
 else {
  const list=ui.node('ul',undefined,{class:'hd-support-articles','aria-label':'Orientações disponíveis'});
  for(const item of view.items){
   const row=ui.node('li',undefined,{'data-support-article':'',class:'hd-support-article'});
   row.append(ui.node('h3',item.title),ui.node('p',item.snippet,{class:'hd-support-copy'}));list.append(row);
  }
  ui.section.append(list,ui.node('p',view.items.length+(view.items.length===1?' orientação exibida.':' orientações exibidas.'),{class:'hd-ops-muted'}));
  ui.report('');
 }
 const open=ui.node('button','Abrir chamado',{type:'button',class:'hd-ops-primary','data-ops-action':'open-ticket'});
 open.disabled=typeof onOpenTicket!=='function';
 if(!open.disabled)explicitAction(panel,open,()=>onOpenTicket(),'Abertura encaminhada ao aplicativo. A cobertura e o acesso serão conferidos no atendimento.');
 ui.section.append(actions(ui,open));if(open.disabled)ui.section.append(ui.node('p','A ação de abrir chamado não está conectada neste painel.',{class:'hd-ops-muted'}));
 ui.mount();return panel.life;
}

export function renderMacroPreview(root,preview) {
 const panel=surface(root,'macro','Prévia da resposta','Confira o texto antes de usar a resposta na conversa.'),{ui}=panel;
 if(!preview||preview.sent!==false||typeof preview.body!=='string')ui.report('Prévia indisponível. Nenhuma mensagem é enviada ao abrir este painel.');
 else if(!preview.body.trim())ui.report('Nenhum texto de resposta disponível para conferir.');
 else {
  ui.section.append(ui.badge({label:'Prévia · nada foi enviado',tone:'info'}),ui.node('div',preview.body,{class:'hd-support-macro hd-support-copy','data-support-macro':''}));
  ui.report('');
 }
 ui.section.append(ui.node('p','Esta visualização não envia, aplica ou copia mensagens. O envio pertence à conversa autorizada.',{class:'hd-ops-muted'}));
 ui.mount();return panel.life;
}

export function renderPackage(root,grant,onRequest,options={}) {
 const panel=surface(root,'package','Pacote de encerramento','Confira a disponibilidade e a validade antes de solicitar os documentos.'),{ui,alive}=panel;
 // Keep only required values in this closure. Never render grant.id or a private URL/token.
 let value=grant?{id:grant.id,expiresAt:grant.expiresAt,objectCount:grant.objectCount}:null;
 let pending=false;const now=typeof options.now==='function'?options.now:()=>Date.now();
 const read=()=>{try{return packageAvailability(value,now());}catch{return {state:'invalid',canRequest:false,expiresLabel:'Validade indisponível'};}};
 const facts=ui.node('dl',undefined,{class:'hd-ops-facts'}),validity=ui.node('dd'),count=ui.node('dd');
 for(const [label,node] of [['Validade do pacote',validity],['Itens no pacote',count]]){const box=ui.node('div');box.append(ui.node('dt',label),node);facts.append(box);}
 count.textContent=Number.isSafeInteger(value?.objectCount)&&value.objectCount>=0?String(value.objectCount):'Quantidade indisponível';
 const request=ui.node('button','Solicitar download autorizado',{type:'button',class:'hd-ops-primary','data-ops-action':'request-package'});
 const description=ui.node('p','O download usa um acesso temporário e será autorizado novamente. Este painel não armazena nem exibe o endereço privado.',{class:'hd-ops-muted'});
 function showAvailability(){
  const state=read();validity.textContent=state.expiresLabel;
  request.disabled=pending||!state.canRequest||typeof onRequest!=='function';
  ui.section.setAttribute('data-support-package-state',state.state);
  if(state.state==='unavailable')ui.report('Pacote indisponível. Consulte a equipe pelo chamado.');
  else if(state.state==='invalid')ui.report('Validade ou referência indisponível. Atualize os dados do pacote pelo aplicativo.','warning');
  else if(state.state==='expired')ui.report('A validade informada expirou. Atualize o pacote pelo aplicativo antes de solicitar o download.','warning');
  else if(typeof onRequest!=='function')ui.report('A solicitação do pacote não está conectada neste painel.');
  else ui.report('O prazo informado ainda está vigente. O acesso será validado pelo servidor ao solicitar o download.','info');
  return state;
 }
 ui.listen(request,'click',async()=>{
  if(!alive()||pending||request.disabled||request.hidden)return;
  if(!showAvailability().canRequest||typeof onRequest!=='function')return;
  const id=value.id;pending=true;request.disabled=true;request.setAttribute('aria-busy','true');ui.report('Solicitando ao aplicativo a conferência do acesso…','info');
  try{await onRequest(id);if(alive())ui.report('Solicitação encaminhada ao aplicativo. O retorno desta ação não confirma a conclusão do download.','info');}
  catch{if(alive())ui.report('Não foi possível confirmar o pedido de download. Confira a validade e tente novamente pelo aplicativo.','warning');}
  finally{if(alive()){pending=false;request.removeAttribute('aria-busy');const s=read();request.disabled=!s.canRequest;if(!s.canRequest)showAvailability();}}
 });
 panel.onDispose(()=>{value=null;});ui.section.append(facts,description,actions(ui,request));showAvailability();ui.mount();return panel.life;
}

export function renderExternalWork(root,link) {
 const panel=surface(root,'external-work','Acompanhamento do desenvolvimento','Acompanhe a informação disponível sem confundir publicação com encerramento.'),{ui}=panel;
 const known=typeof link?.state==='string'&&['waiting_internal','waiting_release','awaiting_human_validation'].includes(link.state);
 const view=externalWorkView(link?.state),badge=ui.badge(view);
 badge.setAttribute('data-support-state',known?link.state:'unavailable');
 ui.section.append(badge,ui.node('p',view.description,{class:'hd-support-external-description'}),ui.node('p','Este painel não resolve o chamado e não comprova a conclusão de etapas anteriores.',{class:'hd-ops-muted'}));
 ui.report('');ui.mount();return panel.life;
}

/** Token remains solely in the host's owned API closure. No context/credential in DOM,
 * URL or storage. Score changes do not submit. Unknown outcomes replay the EXACT intent.
 */
export function mountCsat(root,submit,keyFactory=()=>crypto.randomUUID()) {
 const panel=surface(root,'csat','Como foi o atendimento?','Sua avaliação ajuda a equipe a melhorar. Escolha uma nota e, se desejar, deixe um comentário.'),{ui,alive}=panel;
 let generation=0,pending=false,intent=null,completed=false,uncertain=false,validationShown=false;
 const connected=typeof submit==='function';
 const form=ui.node('form',undefined,{novalidate:'','data-support-csat-form':''}),rating=ui.field('Nota de 1 a 5','rating','select','Selecione a opção que melhor representa sua experiência.'),comment=ui.field('Comentário opcional','comment','textarea','Use até 2.000 caracteres. Não inclua senhas ou códigos de acesso.');
 rating.input.setAttribute('name','rating');rating.input.setAttribute('required','');rating.input.setAttribute('aria-required','true');
 const placeholder=ui.node('option','Selecione uma nota',{value:''});placeholder.value='';placeholder.disabled=true;placeholder.selected=true;rating.input.append(placeholder);
 for(const option of CSAT_RATINGS){const node=ui.node('option',option.label,{value:option.value});node.value=option.value;rating.input.append(node);}rating.input.value='';
 comment.input.setAttribute('name','comment');comment.input.setAttribute('maxlength','2000');comment.input.setAttribute('rows','4');comment.input.maxLength=2000;
 const counter=ui.node('p','0 / 2000 caracteres',{id:ui.prefix+'-counter',class:'hd-support-counter','data-support-counter':''});
 comment.input.setAttribute('aria-describedby',comment.input.getAttribute('aria-describedby')+' '+ui.prefix+'-counter');comment.box.append(counter);
 const sendButton=ui.node('button','Enviar avaliação',{type:'submit',class:'hd-ops-primary','data-ops-action':'send-csat'});
 const retry=ui.button('Conferir envio','retry-csat',()=>{if(alive()&&uncertain)void send();},true);retry.hidden=true;
 form.append(rating.box,comment.box,actions(ui,sendButton,retry));ui.section.append(form);
 const count=()=>{counter.textContent=comment.input.value.length+' / 2000 caracteres';};
 // A late response must not steal focus after the user moved to another panel.
 const feedbackFocus=target=>{const doc=ui.section.ownerDocument,active=doc.activeElement;if(active===doc.body||ui.section.contains(active))target.focus();};
 function update(){
  const locked=!connected||pending||uncertain||completed;
  rating.input.disabled=comment.input.disabled=sendButton.disabled=locked;
  retry.hidden=!uncertain;retry.disabled=pending;
  sendButton.textContent=pending?'Enviando avaliação…':completed?'Avaliação registrada':'Enviar avaliação';
  form.setAttribute('aria-busy',String(pending));
 }
 async function send(){
  if(!alive()||pending||completed||!intent||!connected)return;
  const g=generation,saved=intent;pending=true;update();ui.report('Enviando avaliação…','info');
  try{
   const receipt=await submit(structuredClone(saved.input),saved.key);
   if(!alive()||g!==generation)return;
   if(!receipt||receipt.rating!==saved.input.rating||receipt.attribution!=='invitation_possession')throw Error();
   completed=true;uncertain=false;pending=false;intent=null;comment.input.value='';count();
   ui.report('Avaliação registrada. Obrigado.','success');update();feedbackFocus(ui.status);
  }catch{
   if(alive()&&g===generation){pending=false;uncertain=true;ui.report('Confirmação indisponível. Confira o envio antes de iniciar outra avaliação. Seus dados foram preservados para conferir a mesma solicitação.','warning');update();feedbackFocus(retry);}
  }
 }
 ui.listen(form,'submit',event=>{
  event.preventDefault();if(!alive()||pending||uncertain||completed||!connected)return;
  const issues=csatIssues(rating.input.value,comment.input.value);
  rating.feedback(issues.rating);comment.feedback(issues.comment);count();
  if(issues.rating||issues.comment){validationShown=true;ui.report('Revise os campos indicados antes de enviar a avaliação.','warning');(issues.rating?rating.input:comment.input).focus();return;}
  let key;try{key=keyFactory();if(typeof key!=='string'||!key.trim()||key.length>128)throw Error();}
  catch{ui.report('Não foi possível preparar a avaliação. Nada foi enviado. Tente novamente.','warning');return;}
  validationShown=false;intent=Object.freeze({key,input:Object.freeze({rating:Number(rating.input.value),comment:comment.input.value})});void send();
 });
 const clearValidationSummary=()=>{if(!validationShown)return;const issues=csatIssues(rating.input.value,comment.input.value);if(!issues.rating&&!issues.comment){validationShown=false;ui.report('');}};
 ui.listen(rating.input,'change',()=>{if(alive()&&!pending&&!uncertain&&!completed){rating.feedback('');clearValidationSummary();}});
 ui.listen(comment.input,'input',()=>{if(alive()&&!pending&&!uncertain&&!completed){count();if(comment.input.value.length<=2000)comment.feedback('');clearValidationSummary();}});
 panel.onDispose(()=>{generation++;intent=null;pending=false;comment.input.value='';rating.input.value='';});
 ui.report(connected?'':'Avaliação indisponível. O envio não está conectado neste painel.');update();ui.mount();return panel.life;
}
