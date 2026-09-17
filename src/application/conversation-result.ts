import {isCanonicalInstant} from '../../shared/instant.js';
import {HelpdeskError} from '../domain/errors.ts';
import {isPersistableText} from '../domain/input-values.ts';
import type {Ticket,PublicMessage,InternalNote,TicketEvent} from '../domain/model.ts';

type ConversationRow = PublicMessage | InternalNote | TicketEvent;
const identifier = (v:unknown):v is string => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const eventTypes = new Set(['ticket.created','message.created','note.created','ticket.status_changed','ticket.priority_changed','ticket.assignment_changed']);
const internalTypes = new Set(['note.created','ticket.assignment_changed']);
function incompatible():never {
  throw new HelpdeskError(503,'invalid_conversation_result','Não foi possível carregar a conversa com segurança. Tente atualizar o chamado.');
}

/** Authorizing the parent is necessary but not enough: validate every returned child. */
export function validateConversationResult(
  rows: unknown, ticket:Ticket, kind:'messages'|'notes'|'timeline', internal:boolean, maxRows:number
): asserts rows is ConversationRow[] {
  if (!Array.isArray(rows) || rows.length>maxRows) incompatible();
  const ids = new Set<string>();
  for (const value of rows) {
    if (!value || typeof value!=='object' || Array.isArray(value)) incompatible();
    const r=value as Record<string,unknown>;
    if (r.workspaceId!==ticket.workspaceId || r.accountId!==ticket.accountId || r.ticketId!==ticket.id
      || !identifier(r.id) || !identifier(r.actorId) || ids.has(r.id)
      || !isCanonicalInstant(r.createdAt)) incompatible();
    ids.add(r.id);
    if (kind==='timeline') {
      if (typeof r.type!=='string' || !eventTypes.has(r.type) || typeof r.customerVisible!=='boolean'
        || r.customerVisible===internalTypes.has(r.type) || (!internal && !r.customerVisible)
        || !r.data || typeof r.data!=='object' || Array.isArray(r.data)) incompatible();
    } else {
      if (!isPersistableText(r.body) || !r.body.trim() || r.body.length>24000 || Array.from(r.body).length>12000
        || (kind==='notes' && !internal)) incompatible();
      if (kind==='messages' && !['customer','human_agent','integration'].includes(String(r.actorType))) incompatible();
    }
  }
}
