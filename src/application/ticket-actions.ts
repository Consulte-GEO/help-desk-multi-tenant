import type {Principal, Ticket, TicketStatus} from '../domain/model.ts';
import {statuses} from '../domain/model.ts';
import {canReadTicket, canReadInternalNote, canWriteInternalNote, hasScope, isOperator} from '../domain/policy.ts';
import {canTransition} from '../domain/workflow.ts';
import {deny} from '../domain/errors.ts';
import {assignmentView} from './ticket-assignment.ts';

export type TicketActions = {
 ticket_id: string;
 version: number;
 reply: boolean;
 read_notes: boolean;
 add_note: boolean;
 change_priority: boolean;
 claim: boolean;
 release: boolean;
 transitions: {to: TicketStatus; requires_reason: boolean}[];
};

/**
 * Presentation of current application rules, NOT an authorization token or a reservation.
 * Only attach to an authorized, current GET; never persist in an idempotency snapshot.
 * Commands still reauthorize and validate the current version/state in their transaction.
 */
export function ticketActions(p: Principal, t: Ticket): TicketActions {
 if (!canReadTicket(p,t)) deny();
 const operator = isOperator(p,t.workspaceId,t.accountId);
 const write = hasScope(p,'tickets:write');
 const assignment = assignmentView(p,t);
 return {
  ticket_id: t.id,
  version: t.version,
  // Conversations do not implicitly reopen a closed/resolved ticket.
  reply: write,
  read_notes: canReadInternalNote(p,t),
  add_note: canWriteInternalNote(p,t),
  change_priority: operator && write && t.status !== 'closed' && t.status !== 'cancelled',
  claim: assignment.can_claim,
  release: assignment.can_release,
  transitions: write ? statuses
   .filter(to => canTransition(t.status,to,operator ? 'agent' : 'customer'))
   .map(to => ({to, requires_reason: t.status === 'resolved' && to === 'open'})) : []
 };
}
