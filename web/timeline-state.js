/** A timeline is a separately authorized, live collection. Never render arbitrary event JSON. */
const priorities={low:'Baixa',normal:'Normal',high:'Alta',urgent:'Urgente'};
const statuses={received:'Recebido',in_progress:'Em atendimento',waiting_for_you:'Aguardando você',resolved:'Resolvido',closed:'Encerrado'};
const internalStatuses={new:'Novo',triage:'Triagem',open:'Em atendimento',waiting_customer:'Aguardando cliente',waiting_internal:'Aguardando equipe',waiting_third_party:'Aguardando terceiro',resolved:'Resolvido',closed:'Encerrado',cancelled:'Cancelado'};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const known=(map,v)=>typeof v==='string'&&Object.hasOwn(map,v);
const text=v=>typeof v==='string'&&[...v].length<=2000&&!/[\u0000\ud800-\udfff]/u.test(v);
const invalid=()=>{throw Error('Histórico inválido. Atualize o chamado ou tente novamente.');};
function validateEvent(e,internal){
 if(!fields(e,['id','type','created_at','data'])||Object.keys(e).length!==4||!identifier(e.id)||typeof e.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.created_at)||!Number.isFinite(Date.parse(e.created_at))||new Date(e.created_at).toISOString()!==e.created_at||!object(e.data))invalid();
 const d=e.data;let ok=false;
 switch(e.type){
  case 'ticket.created':ok=internal?fields(d,['version'])&&positive(d.version):fields(d,[]);break;
  case 'message.created':ok=internal?fields(d,['messageId','actorType'])&&identifier(d.messageId)&&['human_agent','customer','integration','automation','system'].includes(d.actorType):fields(d,[]);break;
  case 'note.created':ok=internal&&fields(d,['noteId'])&&identifier(d.noteId);break;
  case 'ticket.status_changed':ok=internal?fields(d,['from','to','reason'])&&known(internalStatuses,d.from)&&known(internalStatuses,d.to)&&text(d.reason):fields(d,['status'])&&known(statuses,d.status);break;
  case 'ticket.assignment_changed':ok=internal&&fields(d,['action','reason','version'])&&['claim','release'].includes(d.action)&&positive(d.version)&&d.version>=2&&text(d.reason)&&d.reason.trim().length>0&&!/[\p{Cc}\p{Cs}]/u.test(d.reason);break;
  case 'ticket.priority_changed':ok=fields(d,internal?['from','to','version','reason']:['from','to','version'])&&known(priorities,d.from)&&known(priorities,d.to)&&positive(d.version)&&d.version>=2&&(!internal||text(d.reason));break;
 }
 if(!ok)invalid();return structuredClone(e);
}
const compare=(a,b)=>a.created_at===b.created_at?(a.id===b.id?0:a.id<b.id?-1:1):a.created_at<b.created_at?-1:1;
export function createTimelineState(){
 let owner='',generation=0,internal=false,rows=[],cursor=null,pending=null,phase='idle';let used=new Set();
 const current=op=>!!op&&pending===op&&op.owner===owner&&op.generation===generation;
 return {
  reset(next='',operator=false){owner=next;generation++;internal=operator;rows=[];cursor=null;pending=null;phase='idle';used=new Set();},
  current,
  begin(){if(!owner||pending||phase==='capped'||(phase==='ready'&&cursor===null))return null;pending=Object.freeze({owner,generation,cursor});phase='loading';return pending;},
  accept(op,page){
   if(!current(op))return false;
   if(!fields(page,['items','next_cursor'])||Object.keys(page).length!==2||!Array.isArray(page.items)||page.items.length>50)invalid();
   const next=page.next_cursor;
   if(next!==null&&(typeof next!=='string'||!next.length||next.length>700||used.has(next)||next===op.cursor))invalid();
   if(!page.items.length&&next!==null)invalid();
   const accepted=page.items.map(e=>validateEvent(e,internal));const seen=new Set(rows.map(e=>e.id));let previous=rows.at(-1);
   for(const e of accepted){if(seen.has(e.id)||(previous&&compare(previous,e)<=0))invalid();seen.add(e.id);previous=e;}
   if(rows.length+accepted.length>500)invalid();
   rows.push(...accepted);cursor=next;if(op.cursor)used.add(op.cursor);pending=null;phase=rows.length>=500&&next!==null?'capped':'ready';return true;
  },
  fail(op){if(!current(op))return false;pending=null;phase='error';return true;},
  status:()=>phase,items:()=>structuredClone(rows),next:()=>cursor
 };
}
export function eventPresentation(event,internal=false){
 const e=validateEvent(event,internal),d=e.data;
 switch(e.type){
  case 'ticket.created':return {title:'Chamado aberto',description:'Abertura registrada com a cobertura aplicada.',internal:false};
  case 'message.created':return {title:'Resposta pública registrada',description:'Consulte o conteúdo na conversa.',internal:false};
  case 'note.created':return {title:'Nota interna registrada',description:'Registro restrito à equipe. Consulte a área de notas.',internal:true};
  case 'ticket.status_changed':return internal?{title:'Situação atualizada',description:internalStatuses[d.from]+' → '+internalStatuses[d.to]+(d.reason?' · Motivo interno: '+d.reason:''),internal:!!d.reason}:{title:'Situação atualizada',description:statuses[d.status],internal:false};
  case 'ticket.assignment_changed':return {title:d.action==='claim'?'Atendimento assumido':'Atendimento liberado',description:'Motivo interno: '+d.reason,internal:true};
  case 'ticket.priority_changed':return {title:'Prioridade alterada',description:priorities[d.from]+' → '+priorities[d.to]+(internal&&d.reason?' · Motivo interno: '+d.reason:''),internal:internal&&!!d.reason};
 }
 throw Error('Evento de histórico desconhecido.');
}
