/** Executable reference model for memory tests. This does NOT emulate PostgreSQL. */
import type {Ticket,TicketEvent,OutboxEvent,PublicMessage,InternalNote,Principal} from './model.ts';
import {isDeepStrictEqual} from 'node:util';
import {HelpdeskError} from './errors.ts';
import {isPersistableText} from './input-values.ts';

type Effect={
 workspaceId:string; accountId:string; ticketId:string; actorId:string; type:string;
 version:number; data:Record<string,unknown>; applied:boolean; public:boolean;
};
type Resource=Pick<Effect,'workspaceId'|'accountId'|'ticketId'>;
function mismatch():never {
 throw new HelpdeskError(503,'transaction_effect_mismatch','Operação interrompida: efeitos transacionais inconsistentes.');
}
const scope=(t:Ticket,p:Principal)=>({workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id});
const sameResource=(a:Resource,b:Resource)=>a.workspaceId===b.workspaceId&&a.accountId===b.accountId&&a.ticketId===b.ticketId;

/** New instance per transaction. Historical events cannot satisfy new write obligations. */
export class TransactionEffects {
 private effects:Effect[]=[];

 private add(effect:Effect):void {
  if(this.effects.some(e=>sameResource(e,effect)&&e.type!=='note.created'&&effect.type!=='note.created'&&e.version===effect.version))mismatch();
  this.effects.push(effect);
 }

 ticket(before:Ticket|null,after:Ticket,p:Principal):void {
  if(after.workspaceId!==p.workspaceId)mismatch();
  const common=scope(after,p);
  if(!before){
   if(after.version!==1||after.status!=='new'||after.assignedTo!==null||after.createdBy!==p.id)mismatch();
   this.add({...common,type:'ticket.created',version:1,data:{version:1},applied:true,public:true});
   return;
  }
  if(after.version!==before.version+1||after.subject!==before.subject||after.description!==before.description)mismatch();
  const changes=[after.status!==before.status,after.priority!==before.priority,after.assignedTo!==before.assignedTo];
  if(changes.filter(Boolean).length>1)mismatch();
  if(changes[0]){
   this.add({...common,type:'ticket.status_changed',version:after.version,data:{from:before.status,to:after.status},applied:true,public:true});
  }else if(changes[1]){
   this.add({...common,type:'ticket.priority_changed',version:after.version,data:{from:before.priority,to:after.priority,version:after.version},applied:true,public:true});
  }else if(changes[2]){
   this.add({...common,type:'ticket.assignment_changed',version:after.version,
    data:{action:after.assignedTo===null?'release':'claim',from:before.assignedTo,to:after.assignedTo,version:after.version},applied:true,public:false});
  }else{
   // Public messages are inserted before advancing their parent's version.
   const effect=this.effects.find(e=>sameResource(e,common)&&e.type==='message.created'&&e.version===after.version&&e.actorId===p.id&&!e.applied);
   if(!effect)mismatch();
   effect.applied=true;
  }
 }

 conversation(t:Ticket,m:PublicMessage|InternalNote,kind:'message'|'note',p:Principal):void {
  if(m.workspaceId!==t.workspaceId||m.accountId!==t.accountId||m.ticketId!==t.id||m.actorId!==p.id)mismatch();
  this.add({...scope(t,p),type:kind+'.created',version:kind==='message'?t.version+1:t.version,
   data:kind==='message'?{messageId:m.id,actorType:(m as PublicMessage).actorType}:{noteId:m.id},
   applied:kind==='note',public:kind==='message'});
 }

 /** Each newly appended event/outbox must be consumed exactly once, with no orphans. */
 validate(events:TicketEvent[],outbox:OutboxEvent[]):void {
  const unused=[...events],out=[...outbox];
  if(new Set(events.map(e=>`${e.workspaceId}:${e.id}`)).size!==events.length||new Set(outbox.map(e=>`${e.workspaceId}:${e.id}`)).size!==outbox.length)mismatch();
  for(const effect of this.effects){
   if(!effect.applied)mismatch();
   const index=unused.findIndex(e=>sameResource(effect,e)&&e.actorId===effect.actorId&&e.type===effect.type&&e.customerVisible===effect.public&&this.dataMatches(effect,e));
   if(index<0)mismatch();
   const event=unused.splice(index,1)[0]!;
   const outboundIndex=out.findIndex(o=>o.workspaceId===event.workspaceId&&o.id===event.id);
   if(!effect.public){
    if(outboundIndex>=0)mismatch();
    continue;
   }
   if(outboundIndex<0)mismatch();
   const outbound=out.splice(outboundIndex,1)[0]!;
   const expected={specversion:'1.0',id:event.id,source:`helpdesk/workspaces/${event.workspaceId}`,
    type:`com.helpdesk.${event.type}.v1`,subject:`tickets/${event.ticketId}`,time:event.createdAt,
    datacontenttype:'application/json',data:{ticket_id:event.ticketId,version:effect.version}};
   if(!sameResource(effect,outbound)||outbound.type!==event.type||outbound.createdAt!==event.createdAt
    ||!isPersistableText(outbound.requestId)||!outbound.requestId.length||!isDeepStrictEqual(outbound.payload,expected))mismatch();
  }
  if(unused.length||out.length)mismatch();
 }

 private dataMatches(effect:Effect,event:TicketEvent):boolean {
  if(['ticket.status_changed','ticket.priority_changed','ticket.assignment_changed'].includes(effect.type)){
   const {reason,...data}=event.data;
   const reopening=effect.type==='ticket.status_changed'&&effect.data.from==='resolved'&&effect.data.to==='open';
   return isPersistableText(reason)&&reason.length<=2000&&(!reopening||!!reason.trim())
    &&(effect.type==='ticket.status_changed'||!!reason.trim())&&isDeepStrictEqual(data,effect.data);
  }
  return isDeepStrictEqual(event.data,effect.data);
 }
}
