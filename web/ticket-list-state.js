import {parseConsulteGeoTicketSummary} from '../shared/consultegeo-ticket.js';
import {isCanonicalInstant} from '../shared/instant.js';
/** Per-session, per-query inbox state. No persistent cache or authorization decisions. */
const PUBLIC=['received','in_progress','waiting_for_you','resolved','closed'];
const PRIORITIES=['low','normal','high','urgent'];
const INTERNAL=['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'];
const FIELDS=['consultegeo','id','account_id','product_instance_id','service_code','subject','description','status','internal_status','assignment','priority','version','coverage_id','contract_version_id','created_at','updated_at'];
const bad=()=>{throw Error('Resposta da lista incompatível. Atualize a consulta antes de continuar.');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const text=(v,min,max)=>typeof v==='string'&&v.length<=max*2&&Array.from(v).length>=min&&Array.from(v).length<=max&&!/\p{Cs}/u.test(v);
const instant=isCanonicalInstant;
function filters(raw={}){
 if(!object(raw)||Object.keys(raw).some(k=>!['q','status','priority','assignment'].includes(k)))throw Error('Filtros inválidos.');
 const out={};
 if(raw.q!==undefined){if(typeof raw.q!=='string'||raw.q.length>480||/[\p{Cc}\p{Cs}]/u.test(raw.q))throw Error('Busca inválida. Use de 2 a 120 caracteres.');
  const q=raw.q.trim();if(Array.from(q).length<2||Array.from(q).length>120)throw Error('Busca inválida. Use de 2 a 120 caracteres.');out.q=q;}
 if(raw.status!==undefined){if(!PUBLIC.includes(raw.status))throw Error('Situação inválida.');out.status=raw.status;}
 if(raw.priority!==undefined){if(!PRIORITIES.includes(raw.priority))throw Error('Prioridade inválida.');out.priority=raw.priority;}
 if(raw.assignment!==undefined){if(!['mine','unassigned'].includes(raw.assignment))throw Error('Responsabilidade inválida.');out.assignment=raw.assignment;}
 return Object.freeze(out);
}
function validateAssignment(a){
 return object(a)&&Object.keys(a).sort().join(',')==='can_claim,can_release,state'
  &&['unassigned','mine','other'].includes(a.state)&&typeof a.can_claim==='boolean'&&typeof a.can_release==='boolean'
  &&(!a.can_claim||a.state==='unassigned')&&(!a.can_release||a.state!=='unassigned');
}
function validateItem(t){
 if(t?.consultegeo!==undefined)parseConsulteGeoTicketSummary(t.consultegeo);
 if(!object(t)||Object.keys(t).some(k=>!FIELDS.includes(k))
  ||!['id','account_id','product_instance_id','coverage_id','contract_version_id'].every(k=>identifier(t[k]))
  ||!text(t.service_code,1,80)||!text(t.subject,3,200)||!text(t.description,1,12000)
  ||!PUBLIC.includes(t.status)||!PRIORITIES.includes(t.priority)
  ||!Number.isSafeInteger(t.version)||t.version<1||!instant(t.created_at)||!instant(t.updated_at)
  ||t.internal_status!==undefined&&!INTERNAL.includes(t.internal_status)
  ||t.assignment!==undefined&&(t.internal_status===undefined||!validateAssignment(t.assignment)))bad();
}
export function createTicketListState(){
 let generation=0,sequence=0,selected=filters(),items=[],cursor=null,phase='idle',pending=null;
 let seenCursors=new Set();
 const current=op=>!!op&&pending===op&&op.generation===generation;
 const capped=()=>items.length>=500&&cursor!==null;
 function reset(raw={}){const next=filters(raw);generation++;selected=next;items=[];cursor=null;phase='idle';pending=null;seenCursors=new Set();}
 return {
  reset,restart:()=>reset(selected),filters:()=>({...selected}),items:()=>structuredClone(items),next:()=>cursor,
  status:()=>phase,busy:()=>pending!==null,capped,current,
  begin(){
   if(pending||capped()||(['ready','empty'].includes(phase)&&cursor===null))return null;
   const params=new URLSearchParams({limit:'25',...selected});if(cursor)params.set('cursor',cursor);
   pending=Object.freeze({generation,sequence:++sequence,cursor,path:'/tickets?'+params.toString()});phase='loading';return pending;
  },
  accept(op,page){
   if(!current(op))return false;
   if(!object(page)||Object.keys(page).sort().join(',')!=='items,next_cursor'||!Array.isArray(page.items)||page.items.length>25
    ||!(page.next_cursor===null||typeof page.next_cursor==='string'&&/^[A-Za-z0-9_-]{1,700}$/.test(page.next_cursor))
    ||page.next_cursor!==null&&(!page.items.length||seenCursors.has(page.next_cursor)))bad();
   const ids=new Set(items.map(t=>t.id));
   for(const t of page.items){validateItem(t);if(ids.has(t.id))bad();ids.add(t.id);}
   // Commit the entire page atomically only after validation; callers own fail/retry decisions.
   items=[...items,...structuredClone(page.items)];cursor=page.next_cursor;if(cursor)seenCursors.add(cursor);
   phase=items.length?'ready':'empty';pending=null;return true;
  },
  fail(op){if(!current(op))return false;pending=null;phase='error';return true;}
 };
}
