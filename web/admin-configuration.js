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
  if(!pending||state.busy||destroyed)return false;const intention=pending,token=generation;state.busy=true;active=new AbortController();emit();let success=false;
  try{const r=await o.request(intention.path,{method:intention.method,headers:{...intention.headers},body:intention.body,signal:active.signal});if(token!==generation||destroyed)return false;
   if(!r.ok){if(r.status>=500){state.uncertain=true;state.dialog=null;state.message='Confirmação desconhecida. Concilie a mesma solicitação.';}else{pending=null;state.uncertain=false;state.dialog=null;clear();state.message='Solicitação recusada. Atualize a lista antes de iniciar outra.';}return false;}
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
/** Optional semantic DOM mount, not a replacement of the existing app shell. */
export function mountConfigurationPanel(root,o){
 const doc=root.ownerDocument;let controller;
 const make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const button=(text,fn,disabled=false)=>{const b=make('button',text);b.type='button';b.disabled=disabled;b.onclick=fn;return b;};
 const clearFields=()=>{for(const element of root.querySelectorAll('input,textarea')){element.value='';element.checked=false;}};
 const render=s=>{
  clearFields();root.replaceChildren();root.append(make('h2','Contas, catálogo e contratos'));
  const hint=make('p','Configuração administrativa. Publicar um contrato não libera atendimento ou acesso à origem.');root.append(hint);
  const selector=make('select');selector.setAttribute('aria-label','Tipo de configuração');for(const [kind,form] of Object.entries(configurationForms)){const opt=make('option',form.label);opt.value=kind;selector.append(opt);}selector.value=s.kind;selector.disabled=s.busy||s.uncertain;selector.onchange=()=>controller.load(selector.value);root.append(selector,button('Atualizar',()=>controller.load(s.kind),s.busy||s.uncertain),button('Novo registro',()=>controller.open('create'),s.busy||s.uncertain||!s.revision));
  const status=make('p',s.message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
  if(s.uncertain)root.append(button('Conciliar solicitação',()=>controller.reconcile(),s.busy));
  const list=make('ul');for(const row of s.items){const li=make('li');li.append(make('strong',String(row.data.name??row.data.code??row.id)),make('span',` · revisão ${row.revision} · ${row.id}`));if(row.data.published!==true){li.append(button('Editar',()=>controller.open('update',row.id),s.busy||s.uncertain));if(row.kind==='contract_version')li.append(button('Publicar versão',()=>controller.open('publish',row.id),s.busy||s.uncertain));}else li.append(make('span',' · publicada, somente leitura'));list.append(li);}root.append(list);if(s.nextCursor)root.append(button('Carregar mais',()=>controller.load(s.kind,{append:true}),s.busy||s.uncertain));
  if(s.dialog){const fieldset=make('fieldset');fieldset.append(make('legend',s.dialog.action==='publish'?'Confirmar publicação':'Editar configuração'));
   if(s.dialog.action!=='publish')for(const name of configurationForms[s.kind].fields){const label=make('label',fieldLabels[name]+' '),input=make('input');input.name=name;input.type=booleanFields.includes(name)?'checkbox':'text';if(input.type==='checkbox')input.checked=s.dialog.data[name]===true;else input.value=s.dialog.data[name]??'';input.disabled=s.busy;input.oninput=()=>controller.setField(name,input.type==='checkbox'?input.checked:input.value);label.append(input);fieldset.append(label);}
   const reason=make('textarea');reason.setAttribute('aria-label','Motivo da alteração');reason.value=s.dialog.reason;reason.oninput=()=>controller.setReason(reason.value);reason.disabled=s.busy;fieldset.append(reason,button('Confirmar alteração',()=>controller.confirm(),s.busy),button('Cancelar',()=>controller.cancel(),s.busy));root.append(fieldset);
  }
 };
 controller=createConfigurationController({...o,onState:render});render(controller.view());return Object.freeze({controller,destroy:()=>{controller.destroy();clearFields();root.replaceChildren();}});
}
