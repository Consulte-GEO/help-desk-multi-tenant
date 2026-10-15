import {freezeFormData} from '../../shared/form-rules.js';
import {uuidIdentifier} from '../domain/input-values.ts';
import {instantMicros} from '../domain/business-calendar.ts';
import {notificationRecord,notificationDigest,deliveryFailure} from '../domain/notification-delivery.ts';
import {statuses} from '../domain/model.ts';
const invalid=()=>deliveryFailure('delivery_routing_unavailable');
const identifier=(v:unknown)=>{const id=uuidIdentifier(v);if(id!==v)throw invalid();return id;};
const revision=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<1)throw invalid();return Number(v);};
/** Consume only facts and recipient decisions read under the owned transaction.
 * Names, contact addresses, role labels or browser JSON are not audience proof.
 * SQL independently enforces this policy during materialization and dispatch.
 */
export function resolveInternalNotificationRecipients(rawEvent:unknown,rawAuthority:unknown):readonly string[]{
 try{
  const e=notificationRecord(rawEvent,['kind','workspaceId','accountId','ticketId','requesterId','sourceVersion','resourceHash','sourceAssigneeId']);
  const a=notificationRecord(rawAuthority,['workspaceId','accountId','ticketId','resourceHash','at','status','assignment','queue','decisions']);
  if(!['internal.queue_created','internal.assignment_changed','support.customer_reply'].includes(String(e.kind)))throw invalid();
  for(const k of ['workspaceId','accountId','ticketId'])if(identifier(e[k])!==identifier(a[k]))throw invalid();
  const requester=identifier(e.requesterId),sourceVersion=revision(e.sourceVersion);notificationDigest(e.resourceHash);
  if(a.resourceHash!==e.resourceHash)throw invalid();const now=instantMicros(a.at);
  if(!statuses.includes(a.status as typeof statuses[number]))throw invalid();
  const assignment=notificationRecord(a.assignment,['principalId','version']);revision(assignment.version);
  const current=assignment.principalId===null?null:identifier(assignment.principalId),source=e.sourceAssigneeId===null?null:identifier(e.sourceAssigneeId);
  const queue=notificationRecord(a.queue,['revision','memberIds','maxRecipients']);revision(queue.revision);const maximum=revision(queue.maxRecipients);
  if(maximum>10||!Array.isArray(queue.memberIds)||queue.memberIds.length>maximum||new Set(queue.memberIds).size!==queue.memberIds.length)throw invalid();
  const members=queue.memberIds.map(identifier);
  if(!Array.isArray(a.decisions)||a.decisions.length>100)throw invalid();
  const decisions=new Map<string,{allowed:boolean}>();
  for(const item of a.decisions){
   const d=notificationRecord(item,['principalId','workspaceId','accountId','ticketId','resourceHash','human','active','operator','canAct','expiresAt']);
   const id=identifier(d.principalId);if(decisions.has(id)||['workspaceId','accountId','ticketId','resourceHash'].some(k=>d[k]!==e[k]))throw invalid();
   for(const k of ['human','active','operator','canAct'])if(typeof d[k]!=='boolean')throw invalid();
   decisions.set(id,{allowed:d.human===true&&d.active===true&&d.operator===true&&d.canAct===true&&instantMicros(d.expiresAt)>now});
  }
  if(['resolved','closed','cancelled'].includes(String(a.status)))return freezeFormData([]);
  if(Number(assignment.version)>sourceVersion)return freezeFormData([]);
  let candidates:string[];
  if(e.kind==='internal.queue_created'){if(current!==null)return freezeFormData([]);candidates=members;}
  else if(e.kind==='internal.assignment_changed'){
   if(source===null||current!==source||assignment.version!==sourceVersion)return freezeFormData([]);candidates=[source];
  }else{
   if(current!==source)return freezeFormData([]);candidates=(source===null?members:[source]).filter(id=>id!==requester);
  }
  const recipients=candidates.filter(id=>{const decision=decisions.get(id);if(!decision)throw invalid();return decision.allowed;});
  return freezeFormData(recipients);
 }catch{throw invalid();}
}
