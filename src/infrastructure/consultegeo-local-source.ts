import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import type {Principal} from '../domain/model.ts';
import {parseExternalResourceSelection} from '../domain/external-resource.ts';
import {createResourceAccessResolver,type ResourceAccessAuthority,type ResourceAccessQuery} from '../application/resource-access.ts';
import type {TicketResourceDirectory} from '../http/scoped-ticket-handler.ts';
import {runTransaction} from './transaction.ts';
import type {SqlPool} from './sql.ts';

/** Fixed server provenance for HelpDesk's local register. This does not qualify any external API. */
import {CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT} from '../domain/consultegeo-local-manifest.ts';
export {CONSULTEGEO_LOCAL_MANIFEST,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT} from '../domain/consultegeo-local-manifest.ts';
const invalid=()=>new HelpdeskError(503,'local_source_unavailable','Não foi possível confirmar o registro local de contas e obras.');
export type ConsulteGeoLocalRequestContext=Readonly<{accountId:string;accountName:string;productInstanceId:string;connectionId:string;tenantId:string;
 works:readonly Readonly<{id:string;name:string;ref:ReturnType<typeof parseExternalResourceSelection>[number]}>[]}>;

/** Reads only private current-actor SQL helpers on the ordinary restricted request pool.
 * The resolver validates the entire envelope again. Neither metadata nor a directory
 * result is a grant; business SQL rechecks the persisted decision under shared locks.
 * Persisted timestamps are passed through unchanged, including PostgreSQL microseconds.
 */
export function createPostgresLocalConsulteGeoSourcePorts(pool:SqlPool){
 if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function'||typeof pool.end!=='function')throw invalid();
 async function read(identity:{id:string;workspaceId:string},signal:AbortSignal,sql:string,args:unknown[]):Promise<unknown>{
  const who={id:uuidIdentifier(identity.id),workspaceId:uuidIdentifier(identity.workspaceId)};
  const admit=()=>{if(signal.aborted)throw invalid();};
  return runTransaction(pool,who,async client=>{
   const r=await client.query(sql,args);
   if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1||!Object.hasOwn(r.rows[0]!,'source'))throw invalid();
   return r.rows[0]!.source;
  },admit);
 }
 const authority:ResourceAccessAuthority=Object.freeze({async readAccess(query:ResourceAccessQuery,signal:AbortSignal){
  const refs=parseExternalResourceSelection(query.refs),first=refs[0]!;
  if(first.connectionId!==query.connectionId||first.tenantId!==query.tenantId)throw invalid();
  // A foreign fingerprint fails inside the transaction; no COMMIT acknowledges it.
  return runTransaction(pool,{id:uuidIdentifier(query.principalId),workspaceId:uuidIdentifier(query.workspaceId)},async client=>{
   const r=await client.query('select helpdesk_auth.cg_local_read_access($1::uuid,$2::text,$3::text) as source',[first.connectionId,first.tenantId,query.operation]);
   if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw invalid();const result=r.rows[0]!.source;
   if(result!==null&&(!result||typeof result!=='object'||Object.getOwnPropertyDescriptor(result,'manifestFingerprint')?.value!==CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT))throw invalid();
   return result;
  },()=>{if(signal.aborted)throw invalid();});
 }});
 const directory:TicketResourceDirectory=Object.freeze({async readTicketResources(principal:Principal,ticketId:string,signal:AbortSignal){
  if(principal.kind!=='human')throw invalid();
  return read(principal,signal,'select helpdesk_auth.cg_local_ticket_directory($1::uuid) as source',[uuidIdentifier(ticketId)]);
 }});
 return Object.freeze({manifestFingerprint:CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT,authority,directory,
  resolver:createResourceAccessResolver({authority,manifestFingerprint:CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT,maxAgeMicros:600_000_000n,timeoutMs:5000}),
  async readRequestContexts(principal:Principal,signal:AbortSignal):Promise<readonly ConsulteGeoLocalRequestContext[]>{
   if(principal.kind!=='human')throw invalid();
   const result=await read(principal,signal,'select helpdesk_auth.cg_local_request_contexts() as source',[]);
   if(!Array.isArray(result)||result.length>50)throw invalid();
   // SQL owns the exact shape; parse references before handing metadata to a picker.
   try{for(const c of result){uuidIdentifier(c.accountId);uuidIdentifier(c.productInstanceId);uuidIdentifier(c.connectionId);
    if(typeof c.accountName!=='string'||typeof c.tenantId!=='string'||!Array.isArray(c.works)||!c.works.length||c.works.length>1000)throw invalid();
    for(const work of c.works){const ref=parseExternalResourceSelection([work.ref])[0]!;
     if(ref.connectionId!==c.connectionId||ref.tenantId!==c.tenantId||ref.type!=='work'||ref.id!==work.id||typeof work.name!=='string')throw invalid();}
   }}catch{throw invalid();}
   return result as readonly ConsulteGeoLocalRequestContext[];
  }});
}
