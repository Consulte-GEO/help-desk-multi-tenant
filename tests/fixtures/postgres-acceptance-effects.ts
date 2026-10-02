/** Test-only private observer. No driver, network, credentials, writes or production endpoint. */
import {canonicalJson,requestHash} from '../../src/domain/canonical.ts';
import {zonedInstantMicros} from '../../shared/instant.js';
import {identifier,text,ifMatch} from '../../src/http/validation.ts';
import {priorityChangeInput} from '../../src/application/ticket-priority.ts';
import type {SqlResult} from '../../src/infrastructure/sql.ts';
export const effectCollections=['tickets','messages','notes','events','outbox','receipts','audit','effects'] as const;
export type EffectCollection=typeof effectCollections[number];
export type EffectRow=Record<string,unknown>;
export type EffectSnapshot=Record<EffectCollection,EffectRow[]>;
type QueryPort={query(sql:string,values?:unknown[]):Promise<SqlResult>};
const tables=['helpdesk_core.tickets','helpdesk_core.ticket_messages','helpdesk_core.internal_notes',
 'helpdesk_core.ticket_events','helpdesk_integration.outbox_events','helpdesk_integration.api_idempotency_keys',
 'helpdesk_audit.audit_events','helpdesk_audit.write_effects'] as const;
// A single SQL statement observes all collections in one database snapshot. JSONB preserves
// timestamps as strings rather than passing them through the driver's Date conversion.
const snapshotSql='SELECT jsonb_build_object('+effectCollections.map((name,i)=>
 `'${name}',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) FROM ${tables[i]} r WHERE r.workspace_id=$1::uuid)`
).join(',')+') AS snapshot';
const object=(value:unknown):value is EffectRow=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function invalid():never {throw Error('Invalid private effect snapshot.');}
function validate(value:unknown):EffectSnapshot {
 if(!object(value)||Object.keys(value).length!==effectCollections.length||!effectCollections.every(k=>Object.hasOwn(value,k)))invalid();
 for(const name of effectCollections){
  const rows=value[name];if(!Array.isArray(rows)||rows.length>1000)invalid();
  const identities=new Set<string>();
  for(const row of rows){
   if(!object(row)||typeof row.workspace_id!=='string')invalid();
   const id=typeof row.id==='string'&&row.id.length?row.id:
    name==='receipts'&&['principal_id','operation','key'].every(k=>typeof row[k]==='string'&&row[k])
     ?canonicalJson([row.principal_id,row.operation,row.key]):invalid();
   const identity=canonicalJson([row.workspace_id,id]);if(identities.has(identity))invalid();identities.add(identity);
  }
 }
 return value as EffectSnapshot;
}
const normalized=(value:EffectSnapshot)=>canonicalJson(Object.fromEntries(effectCollections.map(k=>[k,value[k].map(canonicalJson).sort()])));
export function assertNoWorkspaceEffects(before:unknown,after:unknown):void {
 const a=validate(before),b=validate(after);
 if(normalized(a)!==normalized(b))throw Error('Unexpected persistent workspace effects.');
}
/** Caller must be the existing fresh/local PostgreSQL suite, never a hosted HTTP consumer. */
export async function readWorkspaceEffects(source:QueryPort,workspaceId:string):Promise<EffectSnapshot> {
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(workspaceId))throw Error('Invalid test workspace.');
 let result:SqlResult;
 try{result=await source.query(snapshotSql,[workspaceId]);}catch{throw Error('Private effect observation failed.');}
 if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1)invalid();
 const snapshot=validate(result.rows[0]?.snapshot);
 if(effectCollections.some(k=>snapshot[k].some(row=>row.workspace_id!==workspaceId)))invalid();
 return snapshot;
}

/** Validate the first committed receipt against the actual normalized request and the
 * persisted resource at that instant. Return a detached private copy, never a log/DTO.
 * Snapshot reads remain the caller's responsibility; this helper cannot access a database.
 */
export async function assertReceiptMatchesWrite(value:unknown,request:Request,actorId:string,resultId:string):Promise<EffectRow> {
 try {
  const snapshot=validate(value),workspace=request.headers.get('x-workspace-id'),key=request.headers.get('idempotency-key');
  const need=(ok:unknown):void=>{if(!ok)throw Error();};
  need(typeof workspace==='string'&&typeof key==='string');
  const payload:unknown=await request.clone().json();need(object(payload));
  const body=payload as EffectRow,path=new URL(request.url).pathname;
  const creating=request.method==='POST'&&path==='/v1/tickets';
  const matched=/^\/v1\/tickets\/([a-f0-9-]{36})(\/messages)?$/.exec(path);
  const messaging=request.method==='POST'&&matched?.[2]==='/messages';
  const prioritizing=request.method==='PATCH'&&matched!==null&&matched[2]===undefined;
  need(creating||messaging||prioritizing);
  const operation=creating?'tickets.create':messaging?'messages.create:'+matched![1]:'priority.change:'+matched![1];
  const normalized=creating?{accountId:identifier(body.account_id),productInstanceId:identifier(body.product_instance_id),
   serviceCode:text(body,'service_code',1,80),subject:text(body,'subject',3,200),description:text(body,'description',1,12000),
   priority:text(body,'priority',1,10),...(body.coverage_id===undefined?{}:{coverageId:identifier(body.coverage_id)})}
   :messaging?{body:text(body,'body',1,12000)}:priorityChangeInput(body.priority,body.reason,ifMatch(request));
  const receipts=snapshot.receipts.filter(r=>r.workspace_id===workspace&&r.principal_id===actorId&&r.operation===operation&&r.key===key);
  need(receipts.length===1);const receipt=receipts[0]!;
  need(receipt.request_hash===requestHash(normalized)&&zonedInstantMicros(receipt.created_at)!==undefined);
  const rows=(messaging?snapshot.messages:snapshot.tickets).filter(r=>r.workspace_id===workspace&&r.id===resultId);
  need(rows.length===1);const row=rows[0]!;
  const expected:EffectRow=messaging?{
   id:row.id,workspaceId:row.workspace_id,accountId:row.account_id,ticketId:row.ticket_id,actorId:row.actor_id,
   actorType:row.actor_type,body:row.body,createdAt:row.created_at
  }:{id:row.id,workspaceId:row.workspace_id,accountId:row.account_id,productInstanceId:row.product_instance_id,
   serviceCode:row.service_code,createdBy:row.created_by,assignedTo:row.assigned_to,subject:row.subject,description:row.description,
   status:row.status,priority:row.priority,version:row.version,coverageId:row.coverage_id,contractVersionId:row.contract_version_id,
   contractSnapshot:row.contract_snapshot,createdAt:row.created_at,updatedAt:row.updated_at};
  const result=receipt.result;need(object(result));const actual=result as EffectRow;
  need(Object.keys(actual).length===Object.keys(expected).length);
  for(const field of Object.keys(expected)){
   need(Object.hasOwn(actual,field));
   if(field==='createdAt'||field==='updatedAt'){
    const at=zonedInstantMicros(actual[field]),persisted=zonedInstantMicros(expected[field]);
    need(at!==undefined&&persisted!==undefined&&at===persisted);
   }else need(canonicalJson(actual[field])===canonicalJson(expected[field]));
  }
  if(creating){
   const input=normalized as EffectRow;
   need(row.created_by===actorId&&row.version===1&&row.assigned_to===null&&row.status==='new'
    &&row.account_id===input.accountId&&row.product_instance_id===input.productInstanceId&&row.service_code===input.serviceCode
    &&row.subject===input.subject&&row.description===input.description&&row.priority===input.priority
    &&(!Object.hasOwn(input,'coverageId')||row.coverage_id===input.coverageId));
  }else if(messaging)need(row.ticket_id===matched![1]&&row.actor_id===actorId&&row.body===(normalized as EffectRow).body);
  else need(row.id===matched![1]&&row.priority===(normalized as EffectRow).priority
   &&row.version===Number((normalized as EffectRow).expectedVersion)+1);
  return structuredClone(receipt);
 } catch {throw Error('Private receipt correlation failed.');}
}
