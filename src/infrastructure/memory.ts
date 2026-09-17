import {compareInstants} from '../../shared/instant.js';
import {TransactionEffects} from '../domain/transaction-effects.ts';
import {matchesTicketSearch} from '../application/ticket-search.ts';
import {compareContext} from '../application/support-catalog.ts';
import type {SupportCatalogEntry} from '../application/support-catalog.ts';
import {resolveCoverage} from '../domain/contracts.ts';
import type {PageWindow} from '../application/pagination.ts';
import type {Principal,Coverage,Ticket,PublicMessage,InternalNote,TicketEvent,OutboxEvent} from '../domain/model.ts';
import type {UnitOfWork,Store,StoredResult,SupportContext,Cursor} from '../application/ports.ts';
import {canReadTicket,canAccessAccount,canUseProduct,hasScope} from '../domain/policy.ts';
import {HelpdeskError} from '../domain/errors.ts';
export type MemoryState={supportContexts:SupportCatalogEntry[];coverages:Coverage[];tickets:Ticket[];messages:PublicMessage[];notes:InternalNote[];events:TicketEvent[];outbox:OutboxEvent[];idempotency:StoredResult[]};
function windowRows<T extends {id:string;createdAt:string}>(rows:T[],window:PageWindow={limit:100,cursor:null}):T[]{
 const c=window.cursor;return rows.filter(r=>!c||compareInstants(r.createdAt,c.at)<0||(compareInstants(r.createdAt,c.at)===0&&r.id<c.id))
  .sort((a,b)=>compareInstants(b.createdAt,a.createdAt)||(a.id===b.id?0:a.id<b.id?1:-1)).slice(0,window.limit);
}
/** Test/demo adapter only. Its mutex verifies application invariants, not PostgreSQL locking/RLS. */
export class MemoryUnitOfWork implements UnitOfWork{
 private state:MemoryState;private tail:Promise<void>=Promise.resolve();failOutbox=false;
 constructor(seed:Partial<MemoryState>={}){this.state=structuredClone({supportContexts:[],coverages:[],tickets:[],messages:[],notes:[],events:[],outbox:[],idempotency:[],...seed});}
 snapshot():MemoryState{return structuredClone(this.state);}
 seedCoverage(c:Coverage):void{this.state.coverages=this.state.coverages.filter(x=>x.id!==c.id||x.workspaceId!==c.workspaceId);this.state.coverages.push(structuredClone(c));}
 seedTicket(t:Ticket):void{this.state.tickets=this.state.tickets.filter(x=>x.id!==t.id||x.workspaceId!==t.workspaceId);this.state.tickets.push(structuredClone(t));}
 async run<T>(p:Principal,work:(store:Store)=>Promise<T>):Promise<T>{
  let release!:()=>void;const prior=this.tail;this.tail=new Promise<void>(r=>{release=r;});await prior;
  const next=structuredClone(this.state);
  const effects=new TransactionEffects(),eventStart=next.events.length,outboxStart=next.outbox.length;
  const visible=(t:Ticket)=>canReadTicket(p,t);
  const store:Store={
   supportContexts:async(window,at)=>{
    if(!hasScope(p,'contexts:resolve'))return [];
    const eligible=resolveCoverage(next.coverages,at).candidates;
    const seen=new Set<string>();
    return next.supportContexts.filter(c=>{
     if(c.workspaceId!==p.workspaceId||!canAccessAccount(p,c.workspaceId,c.accountId)||!canUseProduct(p,c.productInstanceId)
      ||window.accountId!==undefined&&c.accountId!==window.accountId||window.after&&compareContext(c,window.after)<=0)return false;
     const key=JSON.stringify([c.accountId,c.productInstanceId,c.serviceCode]);if(seen.has(key))return false;
     if(!eligible.some(x=>x.workspaceId===c.workspaceId&&x.accountId===c.accountId&&x.productInstanceId===c.productInstanceId&&x.serviceCode===c.serviceCode))return false;
     seen.add(key);return true;
    }).sort(compareContext).slice(0,window.limit);
   },
   coverages:async(c:SupportContext)=>next.coverages.filter(x=>x.workspaceId===p.workspaceId&&x.accountId===c.accountId&&x.productInstanceId===c.productInstanceId&&x.serviceCode===c.serviceCode),
   getTicket:async id=>next.tickets.find(t=>t.id===id&&visible(t))??null,
   listTickets:async(limit:number,cursor:Cursor|null,accountId?:string,filters={})=>next.tickets.filter(t=>visible(t)&&matchesTicketSearch(t,filters,p)&&(!accountId||t.accountId===accountId)&&(!cursor||compareInstants(t.createdAt,cursor.at)<0||(compareInstants(t.createdAt,cursor.at)===0&&t.id<cursor.id))).sort((a,b)=>compareInstants(b.createdAt,a.createdAt)||(a.id===b.id?0:a.id<b.id?1:-1)).slice(0,limit),
   insertTicket:async t=>{effects.ticket(null,t,p);next.tickets.push(structuredClone(t));},
   updateTicket:async(t,expected)=>{const i=next.tickets.findIndex(x=>x.id===t.id&&x.workspaceId===t.workspaceId&&x.accountId===t.accountId&&x.version===expected);if(i<0)throw new HelpdeskError(412,'version_conflict','Versão alterada.');effects.ticket(next.tickets[i]!,t,p);next.tickets[i]=structuredClone(t);},
   updatePriority:async(t,expected)=>{const i=next.tickets.findIndex(x=>x.id===t.id&&x.workspaceId===t.workspaceId&&x.accountId===t.accountId&&x.version===expected);if(i<0)throw new HelpdeskError(412,'version_conflict','Versão alterada.');effects.ticket(next.tickets[i]!,t,p);next.tickets[i]={...next.tickets[i]!,priority:t.priority,version:t.version,updatedAt:t.updatedAt};},
   updateAssignment:async(t,expected)=>{const i=next.tickets.findIndex(x=>x.id===t.id&&x.workspaceId===t.workspaceId&&x.accountId===t.accountId&&x.version===expected);if(i<0)throw new HelpdeskError(412,'version_conflict','Versão alterada.');effects.ticket(next.tickets[i]!,t,p);next.tickets[i]={...next.tickets[i]!,assignedTo:t.assignedTo,version:t.version,updatedAt:t.updatedAt};},
   lockIdempotency:async()=>{},
   getIdempotency:async(operation,key)=>next.idempotency.find(x=>x.principalId===p.id&&x.workspaceId===p.workspaceId&&x.operation===operation&&x.key===key)??null,
   saveIdempotency:async record=>{next.idempotency.push(structuredClone(record));},
   addMessage:async m=>{const t=next.tickets.find(t=>t.id===m.ticketId&&t.workspaceId===m.workspaceId&&t.accountId===m.accountId);if(!t)throw new Error('Missing parent');effects.conversation(t,m,'message',p);next.messages.push(structuredClone(m));},addNote:async n=>{const t=next.tickets.find(t=>t.id===n.ticketId&&t.workspaceId===n.workspaceId&&t.accountId===n.accountId);if(!t)throw new Error('Missing parent');effects.conversation(t,n,'note',p);next.notes.push(structuredClone(n));},
   messages:async (id,window)=>windowRows(next.messages.filter(m=>m.workspaceId===p.workspaceId&&m.ticketId===id),window),notes:async (id,window)=>windowRows(next.notes.filter(n=>n.workspaceId===p.workspaceId&&n.ticketId===id),window),
   addEvent:async e=>{next.events.push(structuredClone(e));},events:async(id,internal,window)=>windowRows(next.events.filter(e=>e.workspaceId===p.workspaceId&&e.ticketId===id&&(internal||e.customerVisible)),window),
   enqueue:async e=>{if(this.failOutbox)throw new Error('Injected outbox failure');next.outbox.push(structuredClone(e));}
  };
  try{const result=await work(store);effects.validate(next.events.slice(eventStart),next.outbox.slice(outboxStart));this.state=next;return structuredClone(result);}finally{release();}
 }
}
