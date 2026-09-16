import {discoverSupportContexts} from './support-catalog.ts';
import type {CatalogOptions,CatalogPage} from './support-catalog.ts';
import {pagination,page} from './pagination.ts';
import type {PageOptions,Page} from './pagination.ts';
import {randomUUID} from 'node:crypto';
import type {Principal,Ticket,TicketStatus,PublicMessage,InternalNote,TicketEvent} from '../domain/model.ts';
import type {UnitOfWork,Store,SupportContext,CreateTicket} from './ports.ts';
import {resolveCoverage} from '../domain/contracts.ts';
import {canAccessAccount,canUseProduct,canReadTicket,canReadInternalNote,canWriteInternalNote,hasScope,isOperator} from '../domain/policy.ts';
import {canTransition} from '../domain/workflow.ts';
import {requestHash} from '../domain/canonical.ts';
import {HelpdeskError,deny} from '../domain/errors.ts';
function requireText(value:string,min:number,max:number,label:string):void{
 if(typeof value!=='string'||value.trim().length<min||value.length>max)throw new HelpdeskError(400,'invalid_input',`${label} inválido.`);
}
export class HelpdeskService{
 readonly db:UnitOfWork;readonly clock:()=>Date;
 constructor(db:UnitOfWork,clock:()=>Date=()=>new Date()){this.db=db;this.clock=clock;}
 supportContexts(p:Principal,options:CatalogOptions):Promise<CatalogPage>{return discoverSupportContexts(this.db,this.clock,p,options);}
 private now():string{return this.clock().toISOString();}
 private account(p:Principal,c:SupportContext,scope:string):void{
  if(!hasScope(p,scope)||(scope==='tickets:write'&&!hasScope(p,'tickets:read')))throw new HelpdeskError(403,'forbidden','Operação não autorizada.');
  if(!canAccessAccount(p,p.workspaceId,c.accountId)||!canUseProduct(p,c.productInstanceId))deny();
 }
 private async accessible(s:Store,p:Principal,id:string,lock=false):Promise<Ticket>{const t=await s.getTicket(id,lock);if(!t||!canReadTicket(p,t))deny();return t;}
 private async idempotent<T>(s:Store,p:Principal,operation:string,key:string,payload:unknown,work:()=>Promise<T>):Promise<{value:T;replayed:boolean}>{
  if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw new HelpdeskError(400,'invalid_idempotency_key','Idempotency-Key deve ter 16 a 128 caracteres seguros.');
  const hash=requestHash(payload);
  await s.lockIdempotency(operation,key);
  const prior=await s.getIdempotency(operation,key);
  if(prior){if(prior.denied)deny();if(prior.expired)throw new HelpdeskError(409,'idempotency_expired','Chave expirada. Consulte o recurso antes de iniciar uma nova operação.');if(prior.hash!==hash)throw new HelpdeskError(409,'idempotency_conflict','Chave já utilizada com outro conteúdo.');return {value:structuredClone(prior.result) as T,replayed:true};}
  const value=await work();
  await s.saveIdempotency({principalId:p.id,workspaceId:p.workspaceId,operation,key,hash,result:structuredClone(value)});
  return {value,replayed:false};
 }
 async resolve(p:Principal,c:SupportContext){this.account(p,c,'contexts:resolve');return this.db.run(p,async s=>resolveCoverage((await s.coverages(c)).filter(x=>x.workspaceId===p.workspaceId&&x.accountId===c.accountId&&x.productInstanceId===c.productInstanceId&&x.serviceCode===c.serviceCode),this.now()));}
 async create(p:Principal,input:CreateTicket,key:string,requestId:string):Promise<{ticket:Ticket;replayed:boolean}>{
  this.account(p,input,'tickets:write');requireText(input.subject,3,200,'Assunto');requireText(input.description,1,12000,'Descrição');
  if(!['low','normal','high','urgent'].includes(input.priority))throw new HelpdeskError(400,'invalid_input','Prioridade inválida.');
  return this.db.run(p,async s=>{
   const result=await this.idempotent(s,p,'tickets.create',key,input,async()=>{
    // Contract/coverage is queried inside the same transaction; pg adapter locks source rows.
    const locked=await s.coverages(input);const at=this.now();const resolved=resolveCoverage(locked.filter(x=>x.workspaceId===p.workspaceId&&x.accountId===input.accountId&&x.productInstanceId===input.productInstanceId&&x.serviceCode===input.serviceCode),at);
    if(resolved.status==='no_coverage')throw new HelpdeskError(422,'no_coverage','Nenhuma cobertura vigente.');
    if(resolved.status==='ambiguous'&&!input.coverageId)throw new HelpdeskError(409,'ambiguous_coverage','Selecione uma cobertura contratual.');
    const selected=input.coverageId?resolved.candidates.find(x=>x.id===input.coverageId):resolved.candidates[0];
    if(!selected)throw new HelpdeskError(422,'coverage_ineligible','Cobertura não elegível para este contexto.');
    const ticket:Ticket={id:randomUUID(),workspaceId:p.workspaceId,accountId:input.accountId,productInstanceId:input.productInstanceId,serviceCode:input.serviceCode,createdBy:p.id,subject:input.subject,description:input.description,status:'new',priority:input.priority,version:1,coverageId:selected.id,contractVersionId:selected.contractVersionId,contractSnapshot:structuredClone({contractId:selected.contractId,version:selected.contractVersion,policy:selected.policy}),createdAt:at,updatedAt:at};
    await s.insertTicket(ticket);await this.event(s,p,ticket,'ticket.created',{version:1},true,requestId);return ticket;
   });
   // A cached result is not an authorization grant; RLS is consulted again on replay.
   if(result.replayed)await this.accessible(s,p,result.value.id);
   return {ticket:result.value,replayed:result.replayed};
  });
 }
 async get(p:Principal,id:string):Promise<Ticket>{return this.db.run(p,s=>this.accessible(s,p,id));}
 async list(p:Principal,options:{limit:number;cursor?:string;accountId?:string}):Promise<{items:Ticket[];nextCursor:string|null}>{
  if(!hasScope(p,'tickets:read'))throw new HelpdeskError(403,'forbidden','Operação não autorizada.');
  if(options.accountId!==undefined&&!canAccessAccount(p,p.workspaceId,options.accountId))deny();
  const {window,filter}=pagination(options,{workspace:p.workspaceId,principal:p.id,account:options.accountId??null});
  return this.db.run(p,async s=>{
   const rows=(await s.listTickets(window.limit,window.cursor,options.accountId)).filter(t=>canReadTicket(p,t));
   return page(rows,options.limit,filter);
  });
 }
 private async event(s:Store,p:Principal,t:Ticket,type:string,data:Record<string,unknown>,customerVisible:boolean,requestId:string):Promise<void>{
  const id=randomUUID(),createdAt=this.now();await s.addEvent({id,workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id,type,customerVisible,data,createdAt});
  if(customerVisible)await s.enqueue({id,workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,type,requestId,createdAt,payload:{specversion:'1.0',id,source:`helpdesk/workspaces/${t.workspaceId}`,type:`com.helpdesk.${type}.v1`,subject:`tickets/${t.id}`,time:createdAt,datacontenttype:'application/json',data:{ticket_id:t.id,version:t.version}}});
 }
 async conversation<K extends 'messages'|'notes'|'timeline'>(p:Principal,id:string,kind:K,options:PageOptions):Promise<Page<{messages:PublicMessage;notes:InternalNote;timeline:TicketEvent}[K]>>{
  return this.db.run(p,async s=>{
   const t=await this.accessible(s,p,id),internal=canReadInternalNote(p,t);
   if(kind==='notes'&&!internal)throw new HelpdeskError(403,'forbidden','Notas internas são restritas à equipe.');
   const {window,filter}=pagination(options,{version:1,kind,ticket:id,workspace:p.workspaceId,principal:p.id,internal});
   const rows=kind==='messages'?await s.messages(id,window):kind==='notes'?await s.notes(id,window):await s.events(id,internal,window);
   return page<PublicMessage|InternalNote|TicketEvent>(rows,options.limit,filter) as Page<{messages:PublicMessage;notes:InternalNote;timeline:TicketEvent}[K]>;
  });
 }
 // Bounded compatibility for internal callers; HTTP clients receive a next_cursor.
 async messages(p:Principal,id:string):Promise<PublicMessage[]>{return (await this.conversation(p,id,'messages',{limit:100})).items;}
 async notes(p:Principal,id:string):Promise<InternalNote[]>{return (await this.conversation(p,id,'notes',{limit:100})).items;}
 async timeline(p:Principal,id:string):Promise<TicketEvent[]>{return (await this.conversation(p,id,'timeline',{limit:100})).items;}
 async addMessage(p:Principal,id:string,body:string,key:string,requestId:string){requireText(body,1,12000,'Mensagem');if(!hasScope(p,'tickets:write'))throw new HelpdeskError(403,'forbidden','Operação não autorizada.');return this.db.run(p,async s=>{
  // Always authorize the resource before replaying its cached response.
  const t=await this.accessible(s,p,id,true);
  const result=await this.idempotent(s,p,`messages.create:${id}`,key,{body},async()=>{
   const message:PublicMessage={id:randomUUID(),workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id,actorType:isOperator(p,t.workspaceId,t.accountId)?'human_agent':p.kind==='integration'?'integration':'customer',body,createdAt:this.now()};
   await s.addMessage(message);const updated={...t,version:t.version+1,updatedAt:this.now()};await s.updateTicket(updated,t.version);await this.event(s,p,updated,'message.created',{messageId:message.id,actorType:message.actorType},true,requestId);return message;
  });return {message:result.value,replayed:result.replayed};
 });}
 async addNote(p:Principal,id:string,body:string,key:string,requestId:string){requireText(body,1,12000,'Nota');return this.db.run(p,async s=>{
  const t=await this.accessible(s,p,id,true);if(!canWriteInternalNote(p,t))throw new HelpdeskError(403,'forbidden','Notas internas são restritas à equipe.');
  const result=await this.idempotent(s,p,`notes.create:${id}`,key,{body},async()=>{const note:InternalNote={id:randomUUID(),workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id,body,createdAt:this.now()};await s.addNote(note);await this.event(s,p,t,'note.created',{noteId:note.id},false,requestId);return note;});return {note:result.value,replayed:result.replayed};
 });}
 async transition(p:Principal,id:string,to:TicketStatus,expectedVersion:number,reason:string,key:string,requestId:string){
  if(!hasScope(p,'tickets:write'))throw new HelpdeskError(403,'forbidden','Operação não autorizada.');
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw new HelpdeskError(428,'precondition_required','Informe a versão atual em If-Match.');
  if(typeof reason!=='string'||reason.length>2000)throw new HelpdeskError(400,'invalid_input','Motivo inválido.');
  return this.db.run(p,async s=>{
   const t=await this.accessible(s,p,id,true);
   const result=await this.idempotent(s,p,`transitions.create:${id}`,key,{to,expectedVersion,reason},async()=>{
    if(t.version!==expectedVersion)throw new HelpdeskError(412,'version_conflict','Chamado alterado por outra operação. Atualize os dados.');
    if(!canTransition(t.status,to,isOperator(p,t.workspaceId,t.accountId)?'agent':'customer'))throw new HelpdeskError(409,'invalid_transition','Transição não permitida.');
    if(t.status==='resolved'&&to==='open'&&!reason.trim())throw new HelpdeskError(400,'reopen_reason_required','Informe o motivo da reabertura.');
    const updated={...t,status:to,version:t.version+1,updatedAt:this.now()};await s.updateTicket(updated,t.version);
    await this.event(s,p,updated,'ticket.status_changed',{from:t.status,to,reason},true,requestId);return updated;
   });return {ticket:result.value,replayed:result.replayed};
  });
 }
}
