/** TEST-ONLY composition. Production handler, service, scope resolver, adapter and
 * transaction executor are real. Identity, authority and the physical SQL driver
 * below are deliberately synthetic; this does NOT prove SQL/RLS or hosted Auth.
 * No environment secret, external network, production URL or runtime import.
 */
import {markingFixture,id,AT} from './marking.ts';
import {createResourceAccessResolver} from '../../../src/application/resource-access.ts';
import {createExecutionChecklistService} from '../../../src/application/execution-checklist.ts';
import {createExecutionChecklistHttpHandler} from '../../../src/http/execution-checklist.ts';
import {decideExecutionChecklistMark,type ChecklistRecord} from '../../../src/domain/execution-checklist-mark.ts';
import {HelpdeskError} from '../../../src/domain/errors.ts';
import {requestHash} from '../../../src/domain/canonical.ts';
import type {SqlPool,SqlResult} from '../../../src/infrastructure/sql.ts';
import type {ChecklistMarkReceipt} from '../../../src/application/execution-checklist.ts';

// An internal HTTPS name for constructing Request objects, not a network target.
// The owned loopback server maps ONLY its own origin to it for HTTP tests.
export const CHECKLIST_FIXTURE_ORIGIN='https://checklist-fixture.example.test';
export const CHECKLIST_FIXTURE_AUTH='Bearer synthetic-checklist-human';
const modes=['normal','lost','conflict','forbidden','markup','bad_scope','bad_receipt',
 'gate_during_mark','gate_after_commit','closed','unassigned','missing_evidence','malformed_page'] as const;
type Mode=typeof modes[number];
type Stored={record:ChecklistRecord;receipts:Map<string,{key:string;hash:string;command:unknown;result:ChecklistMarkReceipt}>;audits:number};
export function createChecklistCompositionFixture(){
 const f=markingFixture(),refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];
 let mode:Mode='normal';
 let state:Stored={record:structuredClone(f.record),receipts:new Map(),audits:0};
 const metrics={authChecks:0,resourceReads:0,scopeChecks:0,sqlMarks:0,commits:0,rollbacks:0,releases:0};
 const calls:string[]=[],attempts:{key:string;body:string}[]=[];
 const failure=(code:string,status=503)=>new HelpdeskError(status,code,'PRIVATE_TRANSPORT_MARKER');
 const scope={ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',
  manifestFingerprint:'a'.repeat(64),asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',refs};
 const resolver=createResourceAccessResolver({manifestFingerprint:scope.manifestFingerprint,maxAgeMicros:60_000_000n,timeoutMs:5000,clock:()=>AT,
  authority:{async readAccess(query){
   metrics.resourceReads++;
   return {principal:structuredClone(f.principal),binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},
    accessRevision:'1',manifestFingerprint:scope.manifestFingerprint,operation:query.operation,asOf:scope.asOf,expiresAt:scope.expiresAt,resources:refs};
  }}});
 const result=(value:unknown):SqlResult=>({command:'SELECT',rowCount:1,rows:[{result:structuredClone(value)}]});
 const control=(command:string):SqlResult=>({command,rowCount:0,rows:[]});
 const pool:SqlPool={
  async connect(){
   let stage:Stored|null=null,dirty=false;
   return {
    async query(sql,values=[]){
     calls.push(sql);
     if(sql==='BEGIN'){stage=structuredClone(state);dirty=false;return control('BEGIN');}
     if(sql==='ROLLBACK'){stage=null;dirty=false;metrics.rollbacks++;return control('ROLLBACK');}
     if(sql==='COMMIT'){
      if(!stage)throw Error('Synthetic driver: transaction required');
      const wasDirty=dirty;if(dirty)state=stage;stage=null;dirty=false;metrics.commits++;
      if(wasDirty&&mode==='gate_after_commit')mode='closed';
      if(wasDirty&&mode==='lost'){mode='normal';throw Error('Synthetic COMMIT acknowledgement lost');}
      return control('COMMIT');
     }
     if(!stage)throw Error('Synthetic driver: no active transaction');
     if(sql.startsWith('select set_config')){
      if(values[0]!==f.principal.workspaceId||values[1]!==f.principal.id)throw Error('Synthetic driver identity mismatch');
      return {command:'SELECT',rowCount:1,rows:[]};
     }
     if(sql==='select helpdesk_auth.cg_lock_ticket_scope($1,$2) as scope'){
      metrics.scopeChecks++;
      return {command:'SELECT',rowCount:1,rows:[{scope:{...scope,operation:values[1],...(mode==='bad_scope'?{workspaceId:id(99)}:{})}}]};
     }
     if(sql.includes('pg_roles'))return result({role:'helpdesk_app',login:'helpdesk_app',superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});
     if(sql==='select helpdesk_auth.hdn_lock_execution_checklist($1) as result')return result(stage.record);
     if(sql==='select helpdesk_auth.hdn_checklist_receipt($1,$2) as result')return result(stage.receipts.get(String(values[1]))??null);
     if(sql==='select helpdesk_auth.hdn_checklist_evidence($1,$2) as result'){
      const selected=values[1] as string[];
      if(selected.some(ref=>ref!==f.evidence.reference))throw Object.assign(Error('Synthetic foreign note'),{code:'HD004'});
      return result(mode==='missing_evidence'?[]:selected.length?[f.evidence]:[]);
     }
     if(sql.includes('FROM helpdesk_core.internal_notes n')){
      const rows=values[5]!==null?[]:[{id:id(90),at:f.evidence.at,...(mode==='malformed_page'?{body:'PRIVATE_TRANSPORT_MARKER'}:{})}];
      return {command:'SELECT',rowCount:rows.length,rows};
     }
     if(sql==='select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5) as result'){
      metrics.sqlMarks++;
      const command=values[1] as Parameters<typeof decideExecutionChecklistMark>[2];
      const selectors=(command as {evidenceRefs:string[]}).evidenceRefs;
      const decision=decideExecutionChecklistMark(f.principal,stage.record,command,selectors.length?[f.evidence]:[],AT);
      stage.record={...stage.record,snapshot:decision.snapshot};stage.audits++;dirty=true;
      const receipt:ChecklistMarkReceipt={ticketId:id(6),workspaceId:id(1),accountId:id(3),actorId:id(2),itemId:decision.entry.itemId,status:decision.entry.status,
       ticketVersion:stage.record.context.ticketVersion,checklistRevision:decision.snapshot.revision,auditId:id(100+stage.audits),at:AT,replayed:false};
      stage.receipts.set(String(values[3]),{key:String(values[3]),hash:String(values[2]),command:structuredClone(command),result:receipt});
      if(mode==='gate_during_mark')mode='closed';
      return result({receipt:mode==='bad_receipt'?{...receipt,actorId:id(91)}:receipt,record:stage.record});
     }
     throw Error('Unexpected statement in the synthetic checklist driver');
    },
    release(){metrics.releases++;},
   };
  },
  async query(){throw Error('Synthetic pool.query is not a unit of work');},async end(){},
 };
 const service=createExecutionChecklistService({pool,resolver});
 const handler=createExecutionChecklistHttpHandler({origin:CHECKLIST_FIXTURE_ORIGIN,enabled:()=>mode!=='closed',
  async authenticate(request){
   metrics.authChecks++;
   if(request.headers.get('authorization')!==CHECKLIST_FIXTURE_AUTH)throw failure('unauthorized',401);
   if(mode==='forbidden')throw failure('checklist_forbidden',403);
   return structuredClone(f.principal);
  },rateLimiter:{async beforeAuthentication(){},async afterAuthentication(){}},
  directory:{async readTicketResources(_p,target){
   if(target!==f.context.ticketId)throw failure('checklist_forbidden',403);
   // Explicit fault at a private port; not a real change in the PostgreSQL row.
   if(mode==='conflict')throw failure('checklist_version_conflict',412);
   return structuredClone(refs);
  }},service});
 return Object.freeze({
  handler,
  audience:()=>({principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:f.context.ticketId,canWrite:true}),
  attempt(key:string,body:string){attempts.push({key,body});},
  counts:()=>({boundary:'real-handler-service-resolver-store-runner',writes:state.audits,attempts:structuredClone(attempts),...metrics}),
  setMode(value:string){
   if(!modes.includes(value as Mode))return false;mode=value as Mode;
   if(mode==='markup'){
    const template=structuredClone(state.record.template);(template.items[0] as {label:string}).label='<img src=x onerror="window.injected=true">';
    state.record={...state.record,template,context:{...state.record.context,reference:{...state.record.context.reference,sha256:requestHash(template)}}};
   }
   if(mode==='unassigned')state.record={...state.record,assignedTo:null};
   return true;
  },
 });
}
