/** Controlled PostgreSQL protocol double. It models only the documented FOR UPDATE
 * policy intersection and transaction boundaries needed by this regression.
 * It does NOT execute SQL, RLS, triggers, locks or the Supabase provider. */
import type {Principal,Ticket} from '../../src/domain/model.ts';
import type {SqlClient,SqlPool,SqlResult} from '../../src/infrastructure/sql.ts';
import {principal,ticket} from '../fixtures.ts';
export const id=(n:number)=>'18000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const noteWriter=()=>principal({id:id(11),workspaceId:id(1),workspaceRole:null,grants:[{accountId:id(101),role:'agent'}],scopes:['tickets:read','notes:write']});
export const currentTicket=()=>ticket({id:id(501),workspaceId:id(1),accountId:id(101),productInstanceId:id(401),createdBy:id(12),coverageId:id(701),contractVersionId:id(601),contractSnapshot:{contractId:id(301),version:1,policy:{label:'Synthetic'}}});
export function row(t:Ticket){return {id:t.id,workspace_id:t.workspaceId,account_id:t.accountId,product_instance_id:t.productInstanceId,service_code:t.serviceCode,created_by:t.createdBy,assigned_to:t.assignedTo,subject:t.subject,description:t.description,status:t.status,priority:t.priority,version:t.version,coverage_id:t.coverageId,contract_version_id:t.contractVersionId,contract_snapshot:t.contractSnapshot,created_at:t.createdAt,updated_at:t.updatedAt};}
type State={notes:unknown[][];events:unknown[][];cache:Map<string,{hash:string;result:unknown;expired:false}>};
export function noteDriver(p:Principal=noteWriter()){
 const t=currentTicket(),calls:{sql:string;values:unknown[]}[]=[],releases:(Error|undefined)[]=[];
 let state:State={notes:[],events:[],cache:new Map()},tx:State|undefined;
 let fail:((sql:string)=>SqlResult|undefined)|undefined;
 const result=(command:string,rows:Record<string,unknown>[]=[],rowCount:number|null=rows.length):SqlResult=>({command,rows,rowCount});
 const query=async(sql:string,values:unknown[]=[]):Promise<SqlResult>=>{
  calls.push({sql,values});
  if(sql==='BEGIN'){tx=structuredClone(state);return result('BEGIN',[],null);}
  if(sql==='ROLLBACK'){tx=undefined;return result('ROLLBACK',[],null);}
  if(sql==='COMMIT'){if(!tx)throw Error('No transaction');state=tx;tx=undefined;return result('COMMIT',[],null);}
  if(!tx)throw Error('Use a transaction');
  const override=fail?.(sql);if(override!==undefined)return override;
  if(sql.includes('set_config(')||sql.includes('pg_advisory_xact_lock'))return result('SELECT');
  if(sql.includes('lookup_idempotency'))return result('SELECT',[{record:tx.cache.get(JSON.stringify(values))??null}]);
  if(sql.includes('from helpdesk_core.tickets')){
   // PostgreSQL SELECT FOR UPDATE applies UPDATE policies as well as SELECT.
   const visible=p.scopes.includes('tickets:read')&&values[0]===t.workspaceId&&values[1]===t.id;
   const updateAllowed=!/for update/i.test(sql)||p.scopes.includes('tickets:write');
   return result('SELECT',visible&&updateAllowed?[row(t)]:[]);
  }
  if(sql.startsWith('insert into helpdesk_core.internal_notes')){tx.notes.push(structuredClone(values));return result('INSERT',[],1);}
  if(sql.startsWith('insert into helpdesk_core.ticket_events')){tx.events.push(structuredClone(values));return result('INSERT',[],1);}
  if(sql.startsWith('insert into helpdesk_integration.api_idempotency_keys')){
   tx.cache.set(JSON.stringify([values[2],values[3]]),{hash:String(values[4]),result:JSON.parse(String(values[5])),expired:false});return result('INSERT',[],1);
  }
  throw Error('Unexpected SQL in controlled fixture');
 };
 const client:SqlClient={query,release:e=>{releases.push(e);}};
 const pool:SqlPool={query:async()=>{throw Error('Pool query not expected');},connect:async()=>client,end:async()=>{}};
 return {p,t,pool,calls,releases,snapshot:()=>structuredClone(state),failWith:(f:typeof fail)=>{fail=f;}};
}
