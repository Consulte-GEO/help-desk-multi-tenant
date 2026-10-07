/** Memory-only creation snapshot. Identity is an isolation guard, never authorization. */
import {isCanonicalInstant} from '../shared/instant.js';
const same=(a,b)=>!!a&&!!b&&a.workspace===b.workspace&&a.principal===b.principal&&a.session===b.session;
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000\p{Cs}]/u.test(v);
export function validateCreateInput(input){
 if(!input||!identifier(input.account_id)||!identifier(input.product_instance_id)
  ||input.coverage_id!==undefined&&!identifier(input.coverage_id)
  ||!text(input.service_code,1,80)||!text(input.subject,3,200)||!text(input.description,1,12000)
  ||!['normal','low','high','urgent'].includes(input.priority))throw Error('invalid_create_input');
}
export function prepareCreateIntent(input,key,identity){
 validateCreateInput(input);
 const payload={account_id:input.account_id,product_instance_id:input.product_instance_id,service_code:input.service_code,subject:input.subject,description:input.description,priority:input.priority,...(input.coverage_id!==undefined?{coverage_id:input.coverage_id}:{})};
 return Object.freeze({key,identity:Object.freeze({...identity}),payload:Object.freeze(payload),body:JSON.stringify(payload),status:'prepared'});
}
export function retryCreateIntent(intent,identity){
 if(!same(intent?.identity,identity))throw Error('stale_session');
 return {path:'/tickets',method:'POST',headers:{'idempotency-key':intent.key},body:intent.body};
}
export function createTicketCreateState(makeKey=()=>crypto.randomUUID()){
 let identity=null,intent=null,pending=null;
 const current=op=>!!op&&pending===op&&same(op.identity,identity);
 return {
  reset(next){identity=next?Object.freeze({...next}):null;intent=null;pending=null;},
  intent:()=>intent,
  busy:()=>!!pending,
  prepare(input){
   if(!identity)throw Error('stale_session');
   if(intent&&intent.status!=='confirmed')throw Error('unresolved_create_intent');
   intent=prepareCreateIntent(input,makeKey(),identity);return intent;
  },
  begin(){if(pending||!intent||intent.status==='confirmed')return null;intent=Object.freeze({...intent,status:'dispatched'});pending=intent;return pending;},
  current,
  fail(op){if(!current(op))return false;intent=Object.freeze({...intent,status:'unknown'});pending=null;return true;},
  confirm(op,result){
   if(!current(op))return false;
   if(!result||!['id','account_id','product_instance_id','coverage_id','contract_version_id'].every(k=>identifier(result[k]))
    ||result.version!==1||result.status!=='received'
    ||result.internal_status!==undefined&&result.internal_status!=='new'
    ||result.assignment!==undefined&&(result.internal_status!=='new'||!result.assignment
     ||Object.keys(result.assignment).sort().join(',')!=='can_claim,can_release,state'
     ||result.assignment.state!=='unassigned'||typeof result.assignment.can_claim!=='boolean'||result.assignment.can_release!==false)
    ||!isCanonicalInstant(result.created_at)||!isCanonicalInstant(result.updated_at)
    ||!['account_id','product_instance_id','service_code','subject','description','priority'].every(k=>result[k]===op.payload[k])
    ||op.payload.coverage_id!==undefined&&result.coverage_id!==op.payload.coverage_id)throw Error('invalid_create_receipt');
   intent=Object.freeze({...intent,status:'confirmed'});pending=null;return true;
  }
 };
}
