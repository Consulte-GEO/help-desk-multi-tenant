import type {Ticket} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
export const ticketPriorities = ['low','normal','high','urgent'] as const;

/** A deliberately narrow command, not a generic merge of caller properties into a ticket. */
export function priorityChangeInput(priority:unknown,reason:unknown,expectedVersion:unknown):{
 priority:Ticket['priority'];reason:string;expectedVersion:number
}{
 if(!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<1)
  throw new HelpdeskError(428,'precondition_required','Informe a versão atual em If-Match.');
 if(typeof priority!=='string'||!(ticketPriorities as readonly string[]).includes(priority))
  throw new HelpdeskError(400,'invalid_input','Prioridade inválida.');
 if(typeof reason!=='string'||!reason.trim()||[...reason.trim()].length>2000||/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(reason))
  throw new HelpdeskError(400,'invalid_input','Informe um motivo interno de 1 a 2000 caracteres, sem caracteres de controle.');
 return {priority:priority as Ticket['priority'],reason:reason.trim(),expectedVersion:Number(expectedVersion)};
}
