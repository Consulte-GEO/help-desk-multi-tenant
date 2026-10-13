import type {Principal,PublicMessage,TicketEvent} from '../domain/model.ts';
import type {SqlClient,SqlPool} from './sql.ts';import type {PageWindow} from '../application/pagination.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';import {isCanonicalInstant} from '../../shared/instant.js';
import {HelpdeskError} from '../domain/errors.ts';import {formRecord} from '../domain/form-schema.ts';
import {parseExternalResourceSelection} from '../domain/external-resource.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {runTransaction,rejectTransactionValidation} from './transaction.ts';
const fail=()=>new HelpdeskError(503,'public_workflow_read_unavailable','Não foi possível carregar a conversa pública.');
import {publicInteraction} from '../domain/public-workflow.ts';

/** Every RPC returns one bounded JSON envelope. No ledger SELECT or audit dump. */
export function createPostgresPublicWorkflowReader(client:SqlClient,principal:Principal){const p=freezeFormData(copyFormData(principal)) as Principal;
 async function read(id:string,w:PageWindow,internal:boolean|undefined){try{
  uuidIdentifier(id);if(!Number.isInteger(w.limit)||w.limit<1||w.limit>101)throw fail();if(w.cursor){uuidIdentifier(w.cursor.id);if(!isCanonicalInstant(w.cursor.at))throw fail();}
  const events=internal!==undefined,values=[id,...(events?[internal]:[]),w.cursor?.at??null,w.cursor?.id??null,w.limit];
  const r=await client.query('select helpdesk_auth.'+(events?'hdn_public_events':'hdn_public_messages')+'('+values.map((_,i)=>'$'+(i+1)).join(',')+') as result',values);
  if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw fail();const a=formRecord(r.rows[0],['result']).result;
  if(!Array.isArray(a)||a.length>w.limit||Reflect.ownKeys(a).length!==a.length+1)throw fail();const ids=new Set<string>();
  const rows=a.map(raw=>{const x=formRecord(raw,['id','workspaceId','accountId','ticketId','actorId','createdAt',...(events?['type','customerVisible','data']:['actorType','body'])]);
   for(const k of ['id','workspaceId','accountId','ticketId','actorId'])uuidIdentifier(x[k]);
   if(x.workspaceId!==p.workspaceId||x.ticketId!==id||ids.has(String(x.id))||!isCanonicalInstant(x.createdAt))throw fail();ids.add(String(x.id));
   if(events){if(!['ticket.created','message.created','note.created','ticket.status_changed','ticket.priority_changed','ticket.assignment_changed'].includes(x.type as string)||typeof x.customerVisible!=='boolean'||!internal&&!x.customerVisible||!x.data||typeof x.data!=='object'||Array.isArray(x.data))throw fail();const d=x.data as Record<string,unknown>;if(Object.hasOwn(d,'public_interaction')){if(x.type!=='ticket.status_changed'||x.customerVisible!==true)throw fail();publicInteraction(d.public_interaction);}}
   else if(!['customer','human_agent','integration'].includes(x.actorType as string)||!isPersistableText(x.body)||!x.body.trim()||x.body.length>24000||[...x.body].length>12000)throw fail();
   return freezeFormData(copyFormData(x));});return rows;
 }catch{return rejectTransactionValidation(client,fail());}}
 return Object.freeze({messages:async(id:string,w:PageWindow)=>await read(id,w,undefined) as PublicMessage[],events:async(id:string,internal:boolean,w:PageWindow)=>await read(id,w,internal) as TicketEvent[]});
}
/** Server metadata port. Relation authorization precedes resource disclosure;
 * the resolver and scoped transaction must still authorize the complete refs. */
export function createPostgresTicketResourceDirectory(pool:SqlPool){return Object.freeze({async readTicketResources(p:Principal,id:string,signal:AbortSignal){const admission=()=>{if(signal.aborted)throw new HelpdeskError(409,'request_cancelled','Requisição cancelada.');};return runTransaction(pool,p,async c=>{try{uuidIdentifier(id);const r=await c.query('select helpdesk_auth.hdn_ticket_directory($1) as result',[id]);if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw fail();const x=formRecord(formRecord(r.rows[0],['result']).result,['ticketId','workspaceId','accountId','refs']);if(x.ticketId!==id||x.workspaceId!==p.workspaceId)throw fail();uuidIdentifier(x.accountId);const refs=parseExternalResourceSelection(x.refs);return freezeFormData({...x,refs});}catch{return rejectTransactionValidation(c,new HelpdeskError(503,'resource_directory_unavailable','Não foi possível conferir os recursos do chamado.'));}},admission);}});}
