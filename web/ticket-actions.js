import {isCanonicalInstant} from '../shared/instant.js';
/** Current GET hints only. Never an authorization token, cached policy, or fallback to /me roles. */
const BOOLEAN_FIELDS=['reply','read_notes','add_note','change_priority','claim','release'];
const ACTION_FIELDS=['ticket_id','version',...BOOLEAN_FIELDS,'transitions'].sort().join(',');
const STATUS=['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'];
const PUBLIC=['received','in_progress','waiting_for_you','resolved','closed'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const bad=()=>{throw Error('Ações do chamado indisponíveis ou incompatíveis. Atualize o chamado antes de operar.');};
export function readTicketActions(ticket){
 if(!object(ticket)||!id(ticket.id)||!Number.isSafeInteger(ticket.version)||ticket.version<1||!PUBLIC.includes(ticket.status))bad();
 const a=ticket.available_actions;
 if(!object(a)||Object.keys(a).sort().join(',')!==ACTION_FIELDS||a.ticket_id!==ticket.id||a.version!==ticket.version
  ||!BOOLEAN_FIELDS.every(key=>typeof a[key]==='boolean')||!Array.isArray(a.transitions)||a.transitions.length>STATUS.length)bad();
 const operator=ticket.internal_status!==undefined;
 if(operator&&!STATUS.includes(ticket.internal_status))bad();
 if(!operator&&['read_notes','add_note','change_priority','claim','release'].some(key=>a[key]))bad();
 if(a.claim&&a.release)bad();
 const seen=new Set();
 const transitions=a.transitions.map(move=>{
  if(!object(move)||Object.keys(move).sort().join(',')!=='requires_reason,to'||!STATUS.includes(move.to)
   ||typeof move.requires_reason!=='boolean'||seen.has(move.to)
   ||!operator&&(ticket.status!=='resolved'||!['open','closed'].includes(move.to))
   ||move.requires_reason!==(ticket.status==='resolved'&&move.to==='open'))bad();
  seen.add(move.to);return {to:move.to,requires_reason:move.requires_reason};
 });
 return {ticket_id:ticket.id,version:ticket.version,...Object.fromEntries(BOOLEAN_FIELDS.map(key=>[key,a[key]])),transitions};
}
/** Missing snapshot pauses controls but must not redirect a private draft into public mode. */
export function composerMode(requested,a){
 if(!a)return requested;
 if(requested==='internal'&&!a.add_note)return 'public';
 if(requested==='public'&&!a.reply&&a.add_note)return 'internal';
 return requested;
}
export function hasWriteActions(a){
 return !!a&&(a.reply||a.add_note||a.change_priority||a.claim||a.release||a.transitions.length>0);
}
function conversationPage(page,ticketId,kind){
 const fail=()=>{throw Error('Conversa indisponível ou incompatível. Atualize o chamado.');};
 if(!object(page)||Object.keys(page).sort().join(',')!=='items,next_cursor'||!Array.isArray(page.items)||page.items.length>50
  ||!(page.next_cursor===null||typeof page.next_cursor==='string'&&/^[A-Za-z0-9_-]{1,700}$/.test(page.next_cursor))
  ||page.next_cursor!==null&&!page.items.length)fail();
 const keys=kind==='notes'?'body,created_at,id,ticket_id':'actor_type,body,created_at,id,ticket_id';
 const seen=new Set();
 for(const row of page.items){
  if(!object(row)||Object.keys(row).sort().join(',')!==keys||!id(row.id)||row.ticket_id!==ticketId||seen.has(row.id)
   ||typeof row.body!=='string'||!row.body.trim()||(row.body.length>24000||Array.from(row.body).length>12000)||/[\u0000\p{Cs}]/u.test(row.body)
   ||!isCanonicalInstant(row.created_at)
   ||kind==='messages'&&!['human_agent','customer','integration'].includes(row.actor_type))fail();
  seen.add(row.id);
 }
 return structuredClone(page);
}
/** Only reads. Isolates optional notes failure, never repeats commands or uses stale notes. */
export async function loadTicketDetail(ticketId,request,current=()=>true){
 if(!id(ticketId))bad();
 const ticket=await request('/tickets/'+ticketId);
 if(!current())return null;
 if(ticket?.id!==ticketId)bad();
 const actions=readTicketActions(ticket),empty=()=>({items:[],next_cursor:null});
 const [messages,noteResult]=await Promise.all([
  request('/tickets/'+ticketId+'/messages?limit=50').then(page=>conversationPage(page,ticketId,'messages')),
  actions.read_notes
   ?request('/tickets/'+ticketId+'/notes?limit=50')
     .then(page=>({page:conversationPage(page,ticketId,'notes'),unavailable:false}))
     .catch(()=>({page:empty(),unavailable:true}))
   :Promise.resolve({page:empty(),unavailable:false})
 ]);
 if(!current())return null;
 // A denied or broken note read cannot keep a stale writer/reader enabled until refresh.
 if(noteResult.unavailable){actions.read_notes=false;actions.add_note=false;}
 return {ticket,actions,messages,notes:noteResult.page,notesUnavailable:noteResult.unavailable};
}
