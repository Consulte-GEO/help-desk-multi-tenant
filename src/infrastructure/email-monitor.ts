import type {Principal} from '../domain/model.ts';import type {SqlPool} from './sql.ts';import type {EmailMonitorInput,EmailMonitorQueries} from '../http/email-monitor.ts';
import {runTransaction,assertBorrowedTransactionIdentity,rejectTransactionValidation} from './transaction.ts';import {parseEmailMonitorFilter,parseEmailMonitorResult,emailMonitorFailure} from '../domain/email-monitor.ts';
import {createPortalCursorCodec} from '../domain/portal-query.ts';import {requestHash} from '../domain/canonical.ts';import {copyFormData} from '../../shared/form-rules.js';import {uuidIdentifier} from '../domain/input-values.ts';import {HelpdeskError} from '../domain/errors.ts';
/** Uses the ordinary authenticated request pool. No worker credentials, direct
 * domain grants, raw callbacks or externally supplied function names. */
export function createPostgresEmailMonitorQueries(o:{pool:SqlPool;cursorKey:Uint8Array;clock?:()=>string}):EmailMonitorQueries{
 const clock=o.clock??(()=>new Date().toISOString()),codec=createPortalCursorCodec(o.cursorKey,clock);
 return Object.freeze({async read(p:Principal,input:EmailMonitorInput,signal?:AbortSignal,admission?:()=>void){const fingerprint=requestHash(copyFormData(p));const started=performance.now();const check=()=>{admission?.();if(signal?.aborted)throw emailMonitorFailure('request_cancelled',409);if(performance.now()-started>=5000)throw emailMonitorFailure();if(requestHash(copyFormData(p))!==fingerprint||p.kind!=='human'||!p.scopes.includes('tickets:read')||p.workspaceRole!=='admin'&&!p.grants.some(g=>g.role==='agent'))throw emailMonitorFailure('email_monitor_forbidden',403);};try{
  check();const filter=parseEmailMonitorFilter(input.filter);if(filter.recipient!==null&&p.workspaceRole!=='admin')throw emailMonitorFailure('email_monitor_forbidden',403);
  if(!['collection','delivery','recipient'].includes(input.mode))throw emailMonitorFailure();if(input.eventId!==null)uuidIdentifier(input.eventId);if(input.intentId!==null)uuidIdentifier(input.intentId);
  const asOf=clock(),{cursor,...withoutCursor}=filter;
  const filterHash=requestHash({filter:withoutCursor,mode:input.mode,eventId:input.eventId,intentId:input.intentId,identity:fingerprint});
  return await runTransaction(o.pool,p,async c=>{const guard=()=>{check();assertBorrowedTransactionIdentity(c,p);};const query=async(after:{at:string;id:string}|null)=>{
   guard();const result=await c.query('select helpdesk_auth.hdn_email_monitor($1::jsonb) as result',[JSON.stringify({mode:input.mode,filter:{...filter,cursor:null},eventId:input.eventId,intentId:input.intentId,after,asOf})]);guard();
   if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1||!Object.hasOwn(result.rows[0]!,'result'))throw emailMonitorFailure();if(result.rows[0]!.result===null)throw emailMonitorFailure('not_found',404);return parseEmailMonitorResult(result.rows[0]!.result,input.mode,p);
  };
  try{let view=await query(null);const ctx={principalId:p.id,workspaceId:p.workspaceId,filterHash,accessRevision:String(view.snapshotHash)};
   if(cursor){let after;try{after=codec.open(cursor,ctx);}catch{throw emailMonitorFailure('email_monitor_cursor_changed',409);}const next=await query(after);if(next.snapshotHash!==view.snapshotHash)throw emailMonitorFailure('email_monitor_cursor_changed',409);view=next;}
   guard();const {snapshotHash:_privateHash,...response}=view;
   if(input.mode!=='recipient'){const items=view.items as Record<string,unknown>[],hasMore=items.length>filter.limit,page=items.slice(0,filter.limit);response.items=page;const last=page.at(-1);response.nextCursor=hasMore&&last?codec.seal({at:String(input.mode==='collection'?last.createdAt:view.createdAt),id:String(input.mode==='collection'?last.eventId:last.id)},ctx):null;}
   guard();return response;
  }catch(error){return rejectTransactionValidation(c,error);}
  },check);
 }catch(error){if(error instanceof HelpdeskError&&['email_monitor_forbidden','email_monitor_cursor_changed','invalid_email_monitor_filter','not_found','request_cancelled','release_gate_closed'].includes(error.code))throw error;const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;if(code==='42501')throw emailMonitorFailure('email_monitor_forbidden',403);if(code==='P0002')throw emailMonitorFailure('not_found',404);if(code==='22023')throw emailMonitorFailure('invalid_email_monitor_filter',400);throw emailMonitorFailure();}
 }});
}
