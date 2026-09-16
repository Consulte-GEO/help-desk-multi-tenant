import type {CatalogWindow,SupportCatalogEntry} from './support-catalog.ts';
import type {PageWindow} from './pagination.ts';
import type {Principal,Coverage,Ticket,PublicMessage,InternalNote,TicketEvent,OutboxEvent} from '../domain/model.ts';
export type SupportContext={accountId:string;productInstanceId:string;serviceCode:string};
export type CreateTicket=SupportContext&{subject:string;description:string;priority:Ticket['priority'];coverageId?:string};
export type StoredResult={principalId:string;workspaceId:string;operation:string;key:string;hash:string;result:unknown;expired?:boolean;denied?:boolean};
export type Cursor={id:string;at:string;filter:string};
export interface Store{
  supportContexts(window:CatalogWindow,at:string):Promise<SupportCatalogEntry[]>;
  coverages(context:SupportContext):Promise<Coverage[]>;
  getTicket(id:string,lock?:boolean):Promise<Ticket|null>;
  listTickets(limit:number,cursor:Cursor|null,accountId?:string):Promise<Ticket[]>;
  insertTicket(ticket:Ticket):Promise<void>;
  updateTicket(ticket:Ticket,expectedVersion:number):Promise<void>;
  lockIdempotency(operation:string,key:string):Promise<void>;
  getIdempotency(operation:string,key:string):Promise<StoredResult|null>;
  saveIdempotency(record:StoredResult):Promise<void>;
  addMessage(message:PublicMessage):Promise<void>;
  addNote(note:InternalNote):Promise<void>;
  messages(ticketId:string,window?:PageWindow):Promise<PublicMessage[]>;
  notes(ticketId:string,window?:PageWindow):Promise<InternalNote[]>;
  addEvent(event:TicketEvent):Promise<void>;
  events(ticketId:string,includeInternal:boolean,window?:PageWindow):Promise<TicketEvent[]>;
  enqueue(event:OutboxEvent):Promise<void>;
}
export interface UnitOfWork{run<T>(principal:Principal,work:(store:Store)=>Promise<T>):Promise<T>;}
