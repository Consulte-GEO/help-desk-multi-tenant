import {adminUI,adminText,clearAdminNode} from './admin-ui.js';
/** Fixed catalog UI. Client-side hints never replace administrative capability,
 * MFA, relational validation, CAS or immutable version checks on the server. */
export const configurationForms=Object.freeze({
 account:{label:'Contas',path:'accounts',fields:['name','active']},product:{label:'Produtos',path:'products',fields:['code','name','active']},instance:{label:'Instâncias',path:'instances',fields:['productId','environment','active']},service:{label:'Serviços',path:'services',fields:['productId','code','name','active']},binding:{label:'Vínculos com a origem',path:'bindings',fields:['accountId','productInstanceId','connectionId','tenantId','active']},contract:{label:'Contratos',path:'contracts',fields:['name','status']},contract_version:{label:'Versões contratuais',path:'contract-versions',fields:['contractId','validFrom','validUntil','policyRef']},coverage:{label:'Coberturas',path:'coverages',fields:['accountId','productInstanceId','serviceId','contractVersionId','validFrom','validUntil','enabled']}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,positive=n=>Number.isSafeInteger(n)&&n>0;
const booleanFields=['active','enabled'];
const fieldLabels={name:'Nome',code:'Código',productId:'Produto (ID cadastrado)',environment:'Ambiente',accountId:'Conta (ID cadastrado)',productInstanceId:'Instância (ID cadastrado)',connectionId:'Conexão qualificada (ID)',tenantId:'Identificador do tenant na origem',active:'Ativo',status:'Situação: active, suspended ou terminated',contractId:'Contrato (ID cadastrado)',validFrom:'Início de validade (UTC)',validUntil:'Fim de validade (UTC, opcional)',policyRef:'Referência da política aprovada',serviceId:'Serviço (ID cadastrado)',contractVersionId:'Versão contratual publicada (ID)',enabled:'Habilitada'};
const validAudience=v=>v&&uuid.test(v.principalId)&&uuid.test(v.workspaceId);
function record(r,kind,workspace){if(!r||r.kind!==kind||r.workspaceId!==workspace||!uuid.test(r.id)||!positive(r.revision)||!r.data||typeof r.data!=='object'||Array.isArray(r.data))throw Error();return structuredClone(r);}
export function createConfigurationController(o){
 if(typeof o.request!=='function'||!validAudience(o.audience))throw Error('Invalid configuration controller');
 let audience={...o.audience},generation=0,active=null,pending=null,destroyed=false;
 let state={kind:'account',items:[],revision:null,total:0,nextCursor:null,dialog:null,busy:false,uncertain:false,message:''};
 const view=()=>structuredClone({...state,audience});const emit=()=>{if(!destroyed)try{o.onState?.(view());}catch{/* render never commands */}};
 const clear=()=>{state.items=[];state.revision=null;state.total=0;state.nextCursor=null;};
 async function load(kind=state.kind,{append=false}={}){
  if(destroyed||state.uncertain||pending||!Object.hasOwn(configurationForms,kind))return false;
  const token=++generation,prior=append?{items:state.items,revision:state.revision,cursor:state.nextCursor}:null;
  active?.abort();active=new AbortController();state.kind=kind;state.busy=true;state.dialog=null;if(!append)clear();emit();
  try{const r=await o.request('/v1/admin/'+configurationForms[kind].path+'?limit=50'+(prior?.cursor?'&cursor='+encodeURIComponent(prior.cursor):''),{signal:active.signal});if(token!==generation||destroyed)return false;if(!r.ok)throw Error();const v=await r.json();if(token!==generation||destroyed)return false;
   if(v.workspace_id!==audience.workspaceId||!positive(v.revision)||!Number.isSafeInteger(v.total)||v.total<0||!Array.isArray(v.items)||v.items.length>100||v.total<v.items.length||!(v.next_cursor===null||typeof v.next_cursor==='string'&&v.next_cursor.length<=2048))throw Error();const rows=v.items.map(x=>record(x,kind,audience.workspaceId));
   const items=prior?[...prior.items,...rows]:rows;if(prior&&prior.revision!==v.revision||items.length>5000||items.length>v.total||new Set(items.map(x=>x.id)).size!==items.length)throw Error();
   state={...state,items,revision:v.revision,total:v.total,nextCursor:v.next_cursor,message:`${v.total} registro(s). Ações dependem das permissões atuais.`};return true;
  }catch{if(token===generation&&!destroyed){clear();state.message='Consulta indisponível ou incompatível. Atualize o acesso.';}return false;}
  finally{if(token===generation&&!destroyed){state.busy=false;active=null;emit();}}
 }
 function open(action,id){
  if(destroyed||state.busy||state.uncertain||!positive(state.revision)||!['create','update','publish'].includes(action))return false;
  const r=action==='create'?null:state.items.find(x=>x.id===id);if(action!=='create'&&!r||action==='publish'&&state.kind!=='contract_version'||r?.data.published===true)return false;
  const data=Object.fromEntries(configurationForms[state.kind].fields.map(k=>[k,r?r.data[k]:booleanFields.includes(k)?true:k==='environment'?'production':k==='status'?'active':k==='validUntil'?null:'']));
  state.dialog={kind:state.kind,action,targetId:r?.id??null,entityRevision:r?.revision??null,data,reason:''};emit();return true;
 }
 function setField(name,value){if(destroyed||state.busy||state.uncertain||!state.dialog||!configurationForms[state.kind].fields.includes(name))return false;if(booleanFields.includes(name)?typeof value!=='boolean':value!==null&&typeof value!=='string')return false;state.dialog.data[name]=name==='validUntil'&&value===''?null:value;return true;}
 const setReason=value=>{if(state.dialog&&!state.busy&&!state.uncertain&&typeof value==='string')state.dialog.reason=value;};
 async function send(){
  if(!pending||state.busy||destroyed)return false;const intention=pending,token=generation,reconciling=state.uncertain;state.busy=true;active=new AbortController();emit();let success=false;
  try{const r=await o.request(intention.path,{method:intention.method,headers:{...intention.headers},body:intention.body,signal:active.signal});if(token!==generation||destroyed)return false;
   if(!r.ok){if(r.status>=500||reconciling){state.uncertain=true;state.dialog=null;state.message='Confirmação desconhecida. Concilie a mesma solicitação.';}else{pending=null;state.uncertain=false;state.dialog=null;clear();state.message='Solicitação recusada. Atualize a lista antes de iniciar outra.';}return false;}
   const v=await r.json();if(token!==generation||destroyed)return false;const item=record(v.record,intention.kind,audience.workspaceId);
   if(v.workspace_id!==audience.workspaceId||v.actor_id!==audience.principalId||!positive(v.revision)||!uuid.test(v.audit_id)||typeof v.replayed!=='boolean'||intention.targetId&&item.id!==intention.targetId)throw Error();
   pending=null;state.uncertain=false;state.dialog=null;state.message='Configuração registrada. O atendimento não foi liberado por esta ação.';success=true;return true;
  }catch{if(token===generation&&!destroyed){state.uncertain=true;state.dialog=null;state.message='Confirmação desconhecida. Não envie uma nova intenção.';}return false;}
  finally{if(token===generation&&!destroyed){state.busy=false;active=null;emit();if(success)await load(state.kind);}}
 }
 function confirm(){
  const d=state.dialog;if(!d||destroyed||state.busy||state.uncertain||d.reason.trim().length<3||d.reason.length>2000)return Promise.resolve(false);
  const created=d.action==='create';pending=Object.freeze({kind:d.kind,targetId:d.targetId,path:'/v1/admin/'+configurationForms[d.kind].path+(created?'':'/'+d.targetId)+(d.action==='publish'?'/publish':''),method:d.action==='update'?'PATCH':'POST',headers:Object.freeze({'content-type':'application/json','if-match':`"${state.revision}"`,'idempotency-key':crypto.randomUUID()}),body:JSON.stringify({data:d.action==='publish'?{}:d.data,reason:d.reason,...(!created?{entity_revision:d.entityRevision}:{})})});return send();
 }
 function setAudience(v){if(!validAudience(v))throw Error('Invalid audience');generation++;active?.abort();active=null;pending=null;audience={...v};state={kind:'account',items:[],revision:null,total:0,nextCursor:null,dialog:null,busy:false,uncertain:false,message:'Contexto alterado. Atualize a configuração.'};emit();}
 function cancel(){if(!state.busy&&!state.uncertain){state.dialog=null;emit();}}
 function destroy(){generation++;active?.abort();active=null;pending=null;clear();state.dialog=null;destroyed=true;}
 return Object.freeze({view,load,open,setField,setReason,confirm,cancel,reconcile:()=>state.uncertain?send():Promise.resolve(false),setAudience,destroy});
}
/** Optional INTERNAL presentation. The unchanged controller remains the only command
 * composer. A modal organizes existing fields, not a new authorization boundary. */
export function mountConfigurationPanel(root,o){
 const ui=adminUI(root,'configuration'),{node,button,field,listen}=ui,rowListeners=[],fieldListeners=[],rowButtons=new Map();
 let destroyed=false,rowsStamp='',editorKey='',currentFields=[],returnKey=null,focusAfter=null,wasOpen=false,lastAudience='';
 const section=node('section',undefined,{class:'hd-admin','data-admin-panel':'configuration'});
 const toolbar=node('div',undefined,{class:'hd-admin-toolbar'}),selectLabel=node('label','Tipo de configuração',{for:ui.prefix+'-kind'}),selector=node('select',undefined,{id:ui.prefix+'-kind','aria-label':'Tipo de configuração'});
 for(const [kind,form] of Object.entries(configurationForms))selector.append(node('option',form.label,{value:kind}));selectLabel.append(selector);
 const refresh=button('Atualizar',()=>void controller.load(controller.view().kind)),create=button('Novo registro',()=>{returnKey='new';controller.open('create');},true),reconcile=button('Conciliar solicitação',()=>void controller.reconcile(),true);
 listen(selector,'change',()=>void controller.load(selector.value));reconcile.hidden=true;toolbar.append(selectLabel,refresh,create,reconcile);
 const status=node('p','',{class:'hd-admin-status',role:'status','aria-live':'polite'}),count=node('p','',{class:'hd-admin-muted'}),empty=node('div','',{class:'hd-admin-empty'}),list=node('ul',undefined,{class:'hd-admin-list'}),more=button('Carregar mais',()=>void controller.load(controller.view().kind,{append:true}));
 const dialog=node('dialog',undefined,{'aria-labelledby':ui.prefix+'-title','aria-describedby':ui.prefix+'-notice'}),heading=node('div',undefined,{class:'hd-admin-dialog-heading'}),title=node('h2','',{id:ui.prefix+'-title'}),notice=node('p','',{id:ui.prefix+'-notice',class:'hd-admin-muted'}),recordLabel=node('p','',{class:'hd-admin-muted'});
 heading.append(title,notice,recordLabel);const form=node('form',undefined,{class:'hd-admin-dialog-form'});form.noValidate=true;
 const body=node('div',undefined,{class:'hd-admin-dialog-body'}),fieldRoot=node('div'),reason=field('Motivo da alteração','reason',{tag:'textarea',hint:'Obrigatório: de 3 a 2.000 caracteres. A operação fica no histórico administrativo.',attrs:{'data-config-reason':'',rows:'3',maxlength:'2000',required:''}}),feedback=node('p','',{role:'status','aria-live':'polite',class:'hd-admin-error'});
 body.append(fieldRoot,reason.box,feedback);
 const footer=node('div',undefined,{class:'hd-admin-dialog-footer'}),cancel=button('Cancelar',()=>controller.cancel()),confirm=node('button','Confirmar alteração',{type:'submit',class:'hd-admin-primary'});footer.append(cancel,confirm);form.append(body,footer);dialog.append(heading,form);
 listen(reason.input,'input',()=>controller.setReason(reason.input.value));
 listen(form,'submit',event=>{event.preventDefault();if(confirm.disabled)return;
  reason.feedback('');if(reason.input.value.trim().length<3||reason.input.value.length>2000){reason.feedback('Informe um motivo com pelo menos três caracteres e até 2.000 caracteres.');reason.input.focus();return;}
  controller.setReason(reason.input.value);void controller.confirm();
 });
 listen(dialog,'cancel',event=>{event.preventDefault();controller.cancel();});
 section.append(ui.header('Contas, catálogo e contratos','Organize os cadastros e suas versões. A disponibilidade de cada ação depende da validação administrativa atual.'),toolbar,status,count,empty,list,more,dialog);root.replaceChildren(section);
 function wipeEditor(){
  ui.removeListeners(fieldListeners);clearAdminNode(fieldRoot);currentFields=[];editorKey='';reason.input.value='';reason.input.disabled=true;reason.feedback('');title.textContent=notice.textContent=recordLabel.textContent=feedback.textContent='';
 }
 function makeFields(d){
  wipeEditor();editorKey=JSON.stringify([d.kind,d.action,d.targetId]);
  if(d.action==='publish')return;
  for(const name of configurationForms[d.kind].fields){
   const isBool=booleanFields.includes(name),isStatus=name==='status';
   const label=isStatus?'Situação do contrato':fieldLabels[name];
   const hint=name==='validUntil'?'Deixe vazio quando não houver fim de validade. Mantenha o instante UTC terminado em Z.':name==='validFrom'?'Informe o instante UTC completo, terminado em Z; a precisão não é convertida.':name.endsWith('Id')?'Use o identificador do registro autorizado. Não há busca por nome ou e-mail neste painel.':name==='environment'?'Use o identificador de ambiente cadastrado; o valor é validado pelo servidor.':'';
   const f=field(label,name,{tag:isStatus?'select':'input',hint,attrs:{name,'data-config-field':name,...(isBool?{type:'checkbox'}:{})}});
   if(isBool)f.box.className='hd-admin-field hd-admin-field--boolean';
   if(isStatus)for(const [value,text] of [['active','Ativo'],['suspended','Suspenso'],['terminated','Encerrado']])f.input.append(node('option',text,{value}));
   // Keep existing unrecognized values visible for explicit review; never select a new status silently.
   if(isStatus&&typeof d.data[name]==='string'&&!['active','suspended','terminated'].includes(d.data[name]))f.input.append(node('option','Valor atual não reconhecido',{value:d.data[name]}));
   listen(f.input,isBool||isStatus?'change':'input',()=>controller.setField(name,isBool?f.input.checked:f.input.value),fieldListeners);
   currentFields.push({name,isBool,...f});fieldRoot.append(f.box);
  }
 }
 function clearRows(){ui.removeListeners(rowListeners);rowButtons.clear();clearAdminNode(list);rowsStamp='';}
 function render(s){
  const audience=s.audience.workspaceId+'|'+s.audience.principalId;
  if(audience!==lastAudience){clearRows();wipeEditor();returnKey=focusAfter=null;lastAudience=audience;}
  section.setAttribute('aria-busy',String(s.busy));selector.value=s.kind;selector.disabled=refresh.disabled=s.busy||s.uncertain||!!s.dialog;
  create.disabled=s.busy||s.uncertain||!s.revision||!!s.dialog;reconcile.hidden=!s.uncertain;reconcile.disabled=s.busy;
  status.textContent=s.message;count.textContent=s.revision===null?'':`${s.items.length} de ${s.total} registros carregados · revisão da consulta ${s.revision}`;
  empty.hidden=s.items.length>0;empty.textContent=s.busy?'Consultando registros…':s.revision!==null?'Nenhum registro encontrado nesta consulta.':s.message?'Consulta indisponível. Revise o aviso antes de continuar.':'Escolha o tipo e atualize a lista para consultar os registros autorizados.';
  const stamp=JSON.stringify([s.kind,s.items]);
  if(stamp!==rowsStamp){clearRows();rowsStamp=stamp;
   for(const row of s.items){
    const li=node('li',undefined,{class:'hd-admin-card','data-config-record':row.id}),content=node('div',undefined,{class:'hd-admin-list-body'}),actions=node('div',undefined,{class:'hd-admin-actions'});
    content.append(node('strong',adminText(row.data.name)||adminText(row.data.code)||configurationForms[s.kind].label+' · '+row.id.slice(0,8)),node('p','Revisão '+row.revision,{class:'hd-admin-muted'}));
    if(row.data.published===true)content.append(ui.badge('published'));else if(typeof row.data.status==='string')content.append(ui.badge(row.data.status));else if(row.data.active===false||row.data.enabled===false)content.append(node('span','Inativo',{class:'hd-admin-badge'}));
    const ids=node('details');ids.append(node('summary','Ver identificador'),node('code',row.id));content.append(ids);
    if(row.data.published!==true){
     const add=(action,text)=>{const key=row.id+'|'+action;const b=button(text,()=>{returnKey=key;controller.open(action,row.id);},false,{'data-config-action':action},rowListeners);rowButtons.set(key,b);actions.append(b);};
     add('update','Editar');if(row.kind==='contract_version')add('publish','Publicar versão');
    }
    li.append(content,actions);list.append(li);
   }
  }
  for(const b of rowButtons.values())b.disabled=s.busy||s.uncertain||!!s.dialog;
  more.hidden=!s.nextCursor;more.disabled=s.busy||s.uncertain||!!s.dialog;
  if(!s.dialog){
   if(wasOpen){if(dialog.open)dialog.close();focusAfter=s.uncertain?'reconcile':returnKey;wasOpen=false;}wipeEditor();
  }else{
   const d=s.dialog,key=JSON.stringify([d.kind,d.action,d.targetId]);if(key!==editorKey)makeFields(d);
   title.textContent=(d.action==='publish'?'Confirmar publicação':d.action==='create'?'Novo registro':'Editar registro')+' — '+configurationForms[d.kind].label;
   notice.textContent=d.action==='publish'?'Publicar esta versão não libera atendimento nem acesso à origem. Depois de publicada, esta versão não pode ser editada.':'Confira os campos e informe o motivo. O servidor valida permissões, relacionamentos e revisões antes de registrar.';
   recordLabel.textContent=d.targetId?'Registro: '+d.targetId+' · revisão '+d.entityRevision:'';
   for(const f of currentFields){const value=d.data[f.name];if(f.isBool)f.input.checked=value===true;else if(f.input.value!==(value??''))f.input.value=value??'';f.input.disabled=s.busy||s.uncertain;}
   if(reason.input.value!==d.reason)reason.input.value=d.reason;reason.input.disabled=cancel.disabled=confirm.disabled=s.busy||s.uncertain;
   feedback.textContent=s.busy?'Registrando a operação uma única vez…':'';
   if(!dialog.open){dialog.showModal();(currentFields[0]?.input??reason.input).focus();}wasOpen=true;
  }
  if(focusAfter&&!s.busy)queueMicrotask(()=>{if(destroyed||!focusAfter||controller.view().busy||controller.view().dialog)return;const key=focusAfter;focusAfter=null;const target=key==='reconcile'?reconcile:key==='new'?create:rowButtons.get(key);if(target&&!target.disabled&&!target.hidden)target.focus();else if(!refresh.disabled)refresh.focus();});
 }
 const controller=createConfigurationController({...o,onState:render});render(controller.view());
 return Object.freeze({controller,destroy(){destroyed=true;controller.destroy();ui.removeListeners();ui.removeListeners(rowListeners);if(dialog.open)dialog.close();wipeEditor();clearRows();clearAdminNode(section);root.replaceChildren();lastAudience='';returnKey=focusAfter=null;}});
}
