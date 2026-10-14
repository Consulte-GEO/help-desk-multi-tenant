/** In-memory UI state only. The authenticated request adapter belongs to the
 * existing session controller; no credentials, drafts or intents enter storage.
 * Action hints never authorize: every command is rechecked by the server.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions=['invite','set_role','revoke','expire','handoff'];
const positive=value=>Number.isSafeInteger(value)&&value>0;
function row(value){
 if(!value||typeof value!=='object'||!uuid.test(value.principal_id)||value.principal_kind!=='human'||!['admin','agent'].includes(value.role)||!['active','invited','revoked'].includes(value.status)||!positive(value.revision)||!(value.expires_at===null||typeof value.expires_at==='string'))throw Error();
 return {principal_id:value.principal_id,principal_kind:'human',role:value.role,status:value.status,effective_status:value.effective_status??value.status,revision:value.revision,expires_at:value.expires_at};
}
function list(value,audience){
 if(!value||value.workspace_id!==audience.workspaceId||!positive(value.revision)||!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.items)||value.items.length>100||value.total<value.items.length||!Array.isArray(value.available_actions)||value.available_actions.some(a=>!actions.includes(a))||!(value.next_cursor===null||typeof value.next_cursor==='string'&&value.next_cursor.length<=1024))throw Error();
 const items=value.items.map(row);if(new Set(items.map(r=>r.principal_id)).size!==items.length)throw Error();
 return {items,revision:value.revision,total:value.total,availableActions:[...new Set(value.available_actions)],nextCursor:value.next_cursor};
}
export function createMemberAdminController(options){
 if(typeof options.request!=='function'||!options.audience||!uuid.test(options.audience.principalId)||!uuid.test(options.audience.workspaceId))throw Error('Invalid member controller configuration');
 let audience={...options.audience},generation=0,destroyed=false,active=null,pending=null;
 let state={items:[],revision:null,total:0,availableActions:[],nextCursor:null,busy:false,uncertain:false,message:'',dialog:null};
 const view=()=>structuredClone({...state,audience});
 function emit(){if(!destroyed)try{options.onState?.(view());}catch{/* Rendering observers never submit operations. */}}
 function clearRows(){state={...state,items:[],revision:null,total:0,availableActions:[],nextCursor:null};}
 async function load({append=false,message=''}={}){
  if(destroyed||state.uncertain||state.busy&&pending)return false;
  const token=++generation,old=append?{items:state.items,revision:state.revision}:null,cursor=append?state.nextCursor:null;
  active?.abort();active=new AbortController();state.busy=true;if(!append)clearRows();state.message=message||'Carregando membros…';emit();
  try{
   const response=await options.request('/v1/admin/members?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal:active.signal});
   if(token!==generation||destroyed)return false;
   if(!response.ok){clearRows();state.message=message?message+' A consulta de membros não está disponível para a sessão atual.':'Consulta indisponível ou sem permissão. Atualize o acesso antes de continuar.';return false;}
   const value=list(await response.json(),audience);if(token!==generation||destroyed)return false;
   if(old){if(old.revision!==value.revision)throw Error();const ids=new Set(old.items.map(m=>m.principal_id));if(value.items.some(m=>ids.has(m.principal_id)))throw Error();value.items=[...old.items,...value.items];if(value.items.length>5000||value.items.length>value.total)throw Error();}
   state={...state,...value,message:message||`${value.total} membro(s) no workspace.`,dialog:state.dialog};return true;
  }catch{if(token===generation&&!destroyed){clearRows();state.message=message?message+' Não foi possível validar a nova consulta.':'Não foi possível validar a consulta de membros.';}return false;}
  finally{if(token===generation&&!destroyed){state.busy=false;active=null;emit();}}
 }
 function openDialog(action,target){
  if(destroyed||state.busy||state.uncertain||!state.availableActions.includes(action))return false;
  const member=action==='invite'?null:state.items.find(m=>m.principal_id===target);
  if(action!=='invite'&&!member)return false;
  state.dialog={action,targetPrincipalId:member?.principal_id??null,memberRevision:member?.revision??null,role:member?.role==='agent'?'admin':'agent',principalId:'',expiresAt:'',successorPrincipalId:'',reason:''};emit();return true;
 }
 function setField(name,value){if(!destroyed&&!state.busy&&!state.uncertain&&state.dialog&&['reason','role','principalId','expiresAt','successorPrincipalId'].includes(name)&&typeof value==='string')state.dialog={...state.dialog,[name]:value};}
 function cancelDialog(){if(destroyed||state.busy||state.uncertain)return false;state.dialog=null;emit();return true;}
 async function submit(){
  if(!pending||state.busy||destroyed)return false;
  const token=generation,intent=pending,reconciling=state.uncertain;active=new AbortController();state.busy=true;state.message='Enviando solicitação…';emit();
  let message='';
  try{
   const response=await options.request(intent.path,{method:intent.method,headers:{...intent.headers},body:intent.body,signal:active.signal});
   if(token!==generation||destroyed)return false;
   if(!response.ok){
    if(response.status>=500||reconciling){state.uncertain=true;state.dialog=null;state.message='Confirmação desconhecida. Concilie a solicitação antes de iniciar outra.';}
    else{pending=null;state.uncertain=false;state.dialog=null;clearRows();state.message='Solicitação recusada. Atualize a lista e suas permissões antes de tentar novamente.';}
    return false;
   }
   const result=await response.json();if(token!==generation||destroyed)return false;
   if(result.workspace_id!==audience.workspaceId||result.actor_id!==audience.principalId||!positive(result.revision)||!uuid.test(result.audit_id)||result.notification!=='not_requested'||typeof result.replayed!=='boolean')throw Error();
   const member=row(result.member);if(member.principal_id!==intent.targetPrincipalId)throw Error();
   pending=null;state.uncertain=false;state.dialog=null;message=result.member.status==='invited'?'Convite pendente registrado. Nenhum e-mail foi enviado.':'Operação registrada.';state.message=message;return true;
  }catch{if(token===generation&&!destroyed){state.uncertain=true;state.dialog=null;state.message='Confirmação desconhecida. Concilie usando a mesma solicitação.';}return false;}
  finally{if(token===generation&&!destroyed){state.busy=false;active=null;emit();if(message)await load({message});}}
 }
 async function confirm(){
  if(destroyed||state.busy||state.uncertain||!state.dialog||!positive(state.revision))return false;
  const d=state.dialog;if(d.reason.trim().length<3||d.reason.length>2000){state.message='Informe um motivo com pelo menos três caracteres.';emit();return false;}
  const invitation=d.action==='invite';const target=invitation?d.principalId:d.targetPrincipalId;
  if(!uuid.test(target)||invitation&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(d.expiresAt)||d.action==='handoff'&&!uuid.test(d.successorPrincipalId)){state.message='Confira a pessoa cadastrada, a validade e o sucessor informados.';emit();return false;}
  const body=invitation?{principal_id:target,expires_at:d.expiresAt,reason:d.reason}:{member_revision:d.memberRevision,reason:d.reason,...(d.action==='set_role'?{role:d.role}:{}),...(d.action==='handoff'?{successor_principal_id:d.successorPrincipalId}:{})};
  const suffix={revoke:'/revocations',expire:'/expiry',handoff:'/succession',set_role:''}[d.action]??'';
  pending=Object.freeze({path:invitation?'/v1/admin/members/invitations':'/v1/admin/members/'+target+suffix,method:d.action==='set_role'?'PATCH':'POST',headers:Object.freeze({'content-type':'application/json','if-match':`"${state.revision}"`,'idempotency-key':crypto.randomUUID()}),body:JSON.stringify(body),targetPrincipalId:target});
  return submit();
 }
 function setAudience(next){
  if(!next||!uuid.test(next.principalId)||!uuid.test(next.workspaceId))throw Error('Invalid audience');
  generation++;active?.abort();active=null;pending=null;audience={...next};state={items:[],revision:null,total:0,availableActions:[],nextCursor:null,busy:false,uncertain:false,message:'Sessão alterada. Atualize os membros no novo contexto.',dialog:null};emit();
 }
 function destroy(){generation++;active?.abort();active=null;pending=null;state={items:[],revision:null,total:0,availableActions:[],nextCursor:null,busy:false,uncertain:false,message:'',dialog:null};destroyed=true;}
 return Object.freeze({view,load,openDialog,setField,cancelDialog,confirm,reconcile:()=>state.uncertain?submit():Promise.resolve(false),setAudience,destroy});
}
