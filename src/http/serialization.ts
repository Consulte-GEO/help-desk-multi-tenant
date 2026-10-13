import {assignmentView} from '../application/ticket-assignment.ts';
import {ticketPriorities} from '../application/ticket-priority.ts';
import {publicInteraction} from '../domain/public-workflow.ts';
import type {Principal,Ticket,PublicMessage,InternalNote,TicketEvent,TicketStatus} from '../domain/model.ts';
import {isOperator} from '../domain/policy.ts';import {customerStatus} from '../domain/workflow.ts';
export function ticketDto(p:Principal,t:Ticket){return {id:t.id,account_id:t.accountId,product_instance_id:t.productInstanceId,service_code:t.serviceCode,subject:t.subject,description:t.description,status:customerStatus(t.status),...(isOperator(p,t.workspaceId,t.accountId)?{internal_status:t.status,assignment:assignmentView(p,t)}:{}),priority:t.priority,version:t.version,coverage_id:t.coverageId,contract_version_id:t.contractVersionId,created_at:t.createdAt,updated_at:t.updatedAt};}
export function messageDto(m:PublicMessage){return {id:m.id,ticket_id:m.ticketId,body:m.body,actor_type:m.actorType,created_at:m.createdAt};}
export function noteDto(n:InternalNote){return {id:n.id,ticket_id:n.ticketId,body:n.body,created_at:n.createdAt};}
export function eventDto(p:Principal,e:TicketEvent){
 const operator=isOperator(p,e.workspaceId,e.accountId);
 let data:Record<string,unknown>={};
 if(e.type==='ticket.assignment_changed'){
  if(!operator||e.customerVisible)throw Error('Internal assignment event not authorized');
  const {action,reason,version}=e.data;
  if((action!=='claim'&&action!=='release'&&action!=='transfer')||typeof reason!=='string'||!reason.trim()||[...reason].length>2000||/[\p{Cc}\p{Cs}]/u.test(reason)||!Number.isSafeInteger(version)||Number(version)<2)throw Error('Invalid assignment event');
  data={action,reason,version};
 }else if(e.type==='ticket.priority_changed'){
  const {from,to,version,reason}=e.data;
  if(!(ticketPriorities as readonly unknown[]).includes(from)||!(ticketPriorities as readonly unknown[]).includes(to)||!Number.isSafeInteger(version)||Number(version)<2)
   throw Error('Invalid priority event');
  data={from,to,version,...(operator&&typeof reason==='string'?{reason}:{})};
 }else if(operator)data=e.data;
 else if(e.type==='ticket.status_changed')data={status:customerStatus(e.data.to as TicketStatus)};
 if(Object.hasOwn(e.data,'public_interaction')){
  if(e.type!=='ticket.status_changed'||e.customerVisible!==true)throw Error('Invalid public interaction');
  data={...data,public_interaction:publicInteraction(e.data.public_interaction)};
 }
 return {id:e.id,type:e.type,created_at:e.createdAt,data};
}
