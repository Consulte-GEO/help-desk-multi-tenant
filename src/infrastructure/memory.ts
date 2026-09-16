import type {PageWindow} from '../application/pagination.ts';
import type {Principal,Coverage,Ticket,PublicMessage,InternalNote,TicketEvent,OutboxEvent} from '../domain/model.ts';
import type {UnitOfWork,Store,StoredResult,SupportContext,Cursor} from '../application/ports.ts';
import {canReadTicket} from '../domain/policy.ts';
import {HelpdeskError} from '../domain/errors.ts';
export type MemoryState={coverages:Coverage[];tickets:Ticket[];messages:PublicMessage[];notes:InternalNote[];events:TicketEvent[];outbox:OutboxEvent[];idempotency:StoredResult[]};
function windowRows<T extends {id:string;createdAt:string}>(rows:T[],window:PageWindow={limit:100,cursor:null}):T[]{
 const c=window.cursor;return rows.filter(r=>!c||r.createdAt<c.at||(r.createdAt===c.at&&r.id<c.id))
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,window.limit);
}
/** Test/demo adapter only. Its mutex verifies application invariants, not PostgreSQL locking/RLS. */
export class MemoryUnitOfWork implements UnitOfWork{
 private state:MemoryState;private tail:Promise<void>=Promise.resolve();failOutbox=false;
 constructor(seed:Partial<MemoryState>={}){this.state=structuredClone({coverages:[],tickets:[],messages:[],notes:[],events:[],outbox:[],idempotency:[],...seed});}
 snapshot():MemoryState{return structuredClone(this.state);}
 seedCoverage(c:Coverage):void{this.state.coverages=this.state.coverages.filter(x=>x.id!==c.id||x.workspaceId!==c.workspaceId);this.state.coverages.push(structuredClone(c));}
 seedTicket(t:Ticket):void{this.state.tickets=this.state.tickets.filter(x=>x.id!==t.id||x.workspaceId!==t.workspaceId);this.state.tickets.push(structuredClone(t));}
 async run<T>(p:Principal,work:(store:Store)=>Promise<T>):Promise<T>{
  let release!:()=>void;const prior=this.tail;this.tail=new Promise<void>(r=>{release=r;});await prior;
  const next=structuredClone(this.state);
  const visible=(t:Ticket)=>canReadTicket(p,t);
  const store:Store={
   coverages:async(c:SupportContext)=>next.coverages.filter(x=>x.workspaceId===p.workspaceId&&x.accountId===c.accountId&&x.productInstanceId===c.productInstanceId&&x.serviceCode===c.serviceCode),
   getTicket:async id=>next.tickets.find(t=>t.id===id&&visible(t))??null,
   listTickets:async(limit:number,cursor:Cursor|null,accountId?:string)=>next.tickets.filter(t=>visible(t)&&(!accountId||t.accountId===accountId)&&(!cursor||t.createdAt<cursor.at||(t.createdAt===cursor.at&&t.id<cursor.id))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,limit),
   insertTicket:async t=>{next.tickets.push(structuredClone(t));},
   updateTicket:async(t,expected)=>{const i=next.tickets.findIndex(x=>x.id===t.id&&x.workspaceId===t.workspaceId&&x.accountId===t.accountId&&x.version===expected);if(i<0)throw new HelpdeskError(412,'version_conflict','Versão alterada.');next.tickets[i]=structuredClone(t);},
   lockIdempotency:async()=>{},
   getIdempotency:async(operation,key)=>next.idempotency.find(x=>x.principalId===p.id&&x.workspaceId===p.workspaceId&&x.operation===operation&&x.key===key)??null,
   saveIdempotency:async record=>{next.idempotency.push(structuredClone(record));},
   addMessage:async m=>{next.messages.push(structuredClone(m));},addNote:async n=>{next.notes.push(structuredClone(n));},
   messages:async (id,window)=>windowRows(next.messages.filter(m=>m.workspaceId===p.workspaceId&&m.ticketId===id),window),notes:async (id,window)=>windowRows(next.notes.filter(n=>n.workspaceId===p.workspaceId&&n.ticketId===id),window),
   addEvent:async e=>{next.events.push(structuredClone(e));},events:async(id,internal,window)=>windowRows(next.events.filter(e=>e.workspaceId===p.workspaceId&&e.ticketId===id&&(internal||e.customerVisible)),window),
   enqueue:async e=>{if(this.failOutbox)throw new Error('Injected outbox failure');next.outbox.push(structuredClone(e));}
  };
  try{const result=await work(store);this.state=next;return structuredClone(result);}finally{release();}
 }
}
