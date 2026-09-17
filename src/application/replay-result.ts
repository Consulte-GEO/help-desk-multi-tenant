import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {canonicalJson} from '../domain/canonical.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {isPersistableText} from '../domain/input-values.ts';
import {statuses} from '../domain/model.ts';
import type {Principal, Ticket, PublicMessage, InternalNote} from '../domain/model.ts';
import type {CreateTicket, StoredResult} from './ports.ts';
import {ticketPriorities} from './ticket-priority.ts';

/** An inconsistent cache is NOT a miss and never authorizes another write. */
export function invalidReplayResult():never {
  throw new HelpdeskError(503,'invalid_idempotency_result',
    'Não foi possível confirmar o reenvio com segurança. Consulte o chamado antes de tentar novamente com a mesma chave.');
}
export function replayRecord(value:unknown):value is Record<string,unknown> {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    && Object.getPrototypeOf(value)===Object.prototype;
}
function keys(value:Record<string,unknown>, required:readonly string[], optional:readonly string[]=[]):void {
  if(required.some(k=>!Object.hasOwn(value,k)) || Object.keys(value).some(k=>!required.includes(k)&&!optional.includes(k))) invalidReplayResult();
}
const identifier=(value:unknown):value is string=>typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
const validTime=(value:unknown):value is string=>typeof value==='string'
  && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const text=(value:unknown,min:number,max:number):value is string=>isPersistableText(value)
  && value.trim().length>=min && value.length<=max*2 && Array.from(value).length<=max;

/** The record namespace is checked independently of the adapter's cache key. */
export function validateReplayEnvelope(value:unknown,p:Principal,operation:string,key:string):asserts value is StoredResult {
  if(!replayRecord(value))invalidReplayResult();
  keys(value,['workspaceId','principalId','operation','key','hash','result'],['expired','denied']);
  if(value.workspaceId!==p.workspaceId || value.principalId!==p.id || value.operation!==operation || value.key!==key
    || (value.denied!==undefined && typeof value.denied!=='boolean')
    || (value.expired!==undefined && typeof value.expired!=='boolean')
    || (value.denied===true && value.expired===true)) invalidReplayResult();
  // Terminal records deliberately do not need a response or request digest.
  if(value.denied===true || value.expired===true)return;
  if(typeof value.hash!=='string'||!/^[a-f0-9]{64}$/.test(value.hash)||value.result===null||value.result===undefined)invalidReplayResult();
}

const ticketKeys=['id','workspaceId','accountId','productInstanceId','serviceCode','createdBy',
  'subject','description','status','priority','version','coverageId','contractVersionId','contractSnapshot','createdAt','updatedAt'] as const;
/** Validates a saved domain snapshot, not the HTTP DTO or current action hints. */
export function validateTicketReplayShape(value:unknown):asserts value is Ticket {
  if(!replayRecord(value))invalidReplayResult();
  // Old snapshots predate assignedTo; leave it absent, rather than rewriting history.
  keys(value,ticketKeys,['assignedTo']);
  for(const field of ['id','workspaceId','accountId','productInstanceId','createdBy','coverageId','contractVersionId']) {
    if(!identifier(value[field]))invalidReplayResult();
  }
  if(!text(value.serviceCode,1,80)||!text(value.subject,3,200)||!text(value.description,1,12000)
    ||typeof value.status!=='string'||!(statuses as readonly string[]).includes(value.status)
    ||typeof value.priority!=='string'||!(ticketPriorities as readonly string[]).includes(value.priority)
    ||!Number.isSafeInteger(value.version)||Number(value.version)<1
    ||(Object.hasOwn(value,'assignedTo') && value.assignedTo!==null && !identifier(value.assignedTo))
    ||!validTime(value.createdAt)||!validTime(value.updatedAt))invalidReplayResult();
  const snapshot=value.contractSnapshot;
  if(!replayRecord(snapshot))invalidReplayResult();
  keys(snapshot,['contractId','version','policy']);
  if(!identifier(snapshot.contractId)||!Number.isSafeInteger(snapshot.version)||Number(snapshot.version)<1
    ||!replayRecord(snapshot.policy))invalidReplayResult();
}

/** Only fields immutable in the current domain are compared to the authorized resource.
 * Mutable priority/status/owner remain the ORIGINAL response, even after later writes.
 * If a future feature edits subject/description/contract, this contract needs explicit versioning.
 */
/** Legacy snapshots may use an explicit offset or fewer fractional digits. Compare
 * their exact instant without mutating the snapshot or accepting Date rollover.
 * Epoch milliseconds are exact for four-digit years; the remaining microseconds
 * are added as integers, never converted through floating point seconds.
 */
function historicalInstant(value:string):bigint|undefined {
  const match=/^((?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match)return undefined;
  const fraction=(match[2]??'').padEnd(6,'0');
  const local=match[1]+'.'+fraction+'Z';
  if(!isCanonicalInstant(local))return undefined;
  const zone=match[3]!;let offset=0;
  if(zone!=='Z'){
    const hours=Number(zone.slice(1,3)),minutes=Number(zone.slice(4,6));
    if(hours>23||minutes>59)return undefined;
    offset=(hours*60+minutes)*(zone[0]==='-'?-1:1);
  }
  return BigInt(Date.parse(local.slice(0,23)+'Z'))*1000n+BigInt(fraction.slice(3))-BigInt(offset)*60000000n;
}
function sameCreatedInstant(saved:string,current:string):boolean {
  if(isCanonicalInstant(saved)&&isCanonicalInstant(current))return compareInstants(saved,current)===0;
  const previous=historicalInstant(saved),actual=historicalInstant(current);
  return previous!==undefined&&actual!==undefined&&previous===actual;
}
export function validateTicketReplay(value:unknown,current:Ticket):asserts value is Ticket {
  validateTicketReplayShape(value);
  for(const field of ['id','workspaceId','accountId','productInstanceId','serviceCode','createdBy',
    'coverageId','contractVersionId','subject','description'] as const) {
    if(value[field]!==current[field])invalidReplayResult();
  }
  if(value.version>current.version || !sameCreatedInstant(value.createdAt,current.createdAt))invalidReplayResult();
  try {
    if(canonicalJson(value.contractSnapshot)!==canonicalJson(current.contractSnapshot))invalidReplayResult();
  } catch {invalidReplayResult();}
}
export function validateCreatedReplay(value:unknown,current:Ticket,p:Principal,input:CreateTicket):asserts value is Ticket {
  validateTicketReplay(value,current);
  if(value.accountId!==input.accountId || value.productInstanceId!==input.productInstanceId
    ||value.serviceCode!==input.serviceCode || value.createdBy!==p.id || value.subject!==input.subject
    ||value.description!==input.description || value.priority!==input.priority || value.status!=='new'
    ||value.version!==1 || (value.assignedTo??null)!==null
    ||(input.coverageId!==undefined && value.coverageId!==input.coverageId))invalidReplayResult();
}
export type TicketReplayCommand=
  | {kind:'priority';priority:Ticket['priority'];expectedVersion:number}
  | {kind:'assignment';action:'claim'|'release';expectedVersion:number}
  | {kind:'transition';to:Ticket['status'];expectedVersion:number};
export function validateChangedReplay(value:unknown,current:Ticket,p:Principal,command:TicketReplayCommand):asserts value is Ticket {
  validateTicketReplay(value,current);
  const changed=value.version===command.expectedVersion+1;
  const unchanged=value.version===command.expectedVersion;
  if(command.kind==='transition') {
    if(!changed||value.status!==command.to)invalidReplayResult();
  } else {
    if((!changed&&!unchanged)||value.status==='closed'||value.status==='cancelled')invalidReplayResult();
    if(command.kind==='priority' && value.priority!==command.priority)invalidReplayResult();
    if(command.kind==='assignment' && value.assignedTo!==(command.action==='claim'?p.id:null))invalidReplayResult();
  }
}

const childKeys=['id','workspaceId','accountId','ticketId','actorId','body','createdAt'] as const;
export function validateMessageReplay(value:unknown,t:Ticket,p:Principal,body:string,kind:'message'|'note'):asserts value is PublicMessage|InternalNote {
  if(!replayRecord(value))invalidReplayResult();
  keys(value,kind==='message'?[...childKeys,'actorType']:childKeys);
  if(!identifier(value.id)||value.workspaceId!==t.workspaceId||value.accountId!==t.accountId
    ||value.ticketId!==t.id||value.actorId!==p.id||value.body!==body
    ||!text(value.body,1,12000)||!validTime(value.createdAt))invalidReplayResult();
  if(kind==='message') {
    // Role changes do not rewrite historical authorship. Human/integration identities stay distinct.
    const types=p.kind==='integration'?['integration']:['customer','human_agent'];
    if(typeof value.actorType!=='string'||!types.includes(value.actorType))invalidReplayResult();
  }
}
