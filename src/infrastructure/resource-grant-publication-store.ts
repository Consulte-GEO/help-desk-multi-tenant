import {HelpdeskError} from '../domain/errors.ts';
import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {parseResourceGrantTarget,normalizeResourceGrantSnapshot,normalizeResourceGrantState,resourceGrantRevision,
 type ResourcePublicationPlan,type ResourceGrantState,type ResourceGrantTarget} from '../domain/resource-publication.ts';
import type {ResourceGrantPublicationStore,ResourceGrantPublicationTransaction,ResourcePublicationReceipt} from '../application/resource-grant-publisher.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';
import {runTransaction} from './transaction.ts';
import type {SqlPool,SqlResult} from './sql.ts';

const invalid=()=>new HelpdeskError(503,'resource_publication_store_invalid','A persistência não confirmou uma publicação íntegra.');
const denied=()=>new HelpdeskError(403,'resource_publication_publisher_denied','Conexão sem autorização privada para publicar esta cobertura.');
const conflict=()=>new HelpdeskError(409,'resource_publication_conflict','A revisão ou a intenção de publicação já mudou.');
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
 const proto=Object.getPrototypeOf(value),own=Reflect.ownKeys(value);
 if((proto!==Object.prototype&&proto!==null)||own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw invalid();
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();result[key]=d.value;}
 return result;
}
function singleRow(result:SqlResult):Record<string,unknown>{
 if(!result||result.command!=='SELECT'||result.rowCount!==1||!Array.isArray(result.rows)||result.rows.length!==1)throw invalid();
 return result.rows[0]!;
}
const receiptKeys=['key','commandHash','targetHash','previousRevision','revision','snapshotHash','state','resourceCount','asOf','expiresAt'] as const;
function readReceipt(value:unknown):ResourcePublicationReceipt{
 try{
  const r=object(value,receiptKeys),before=resourceGrantRevision(r.previousRevision),after=resourceGrantRevision(r.revision);
  if(typeof r.key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(r.key)||!hash(r.commandHash)||!hash(r.targetHash)||!hash(r.snapshotHash)
   ||BigInt(after)<=BigInt(before)||!['active','revoked'].includes(r.state as string)||!Number.isSafeInteger(r.resourceCount)
   ||Number(r.resourceCount)<0||Number(r.resourceCount)>1000||(r.state==='revoked'&&r.resourceCount!==0)
   ||!isCanonicalInstant(r.asOf)||!isCanonicalInstant(r.expiresAt)||zonedInstantMicros(r.expiresAt)!<=zonedInstantMicros(r.asOf)!)throw invalid();
  return Object.freeze(r) as ResourcePublicationReceipt;
 }catch{throw invalid();}
}
/** Database error codes, not free-form database messages, determine the safe response. */
function databaseFailure(error:unknown):HelpdeskError{
 let code:unknown;
 try{code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}catch{return invalid();}
 if(code==='PGR01'||code==='40001'||code==='40P01'||code==='55P03')return conflict();
 if(code==='PGR02'||code==='42501')return denied();
 return invalid();
}
const roleSql=`select current_user::text as role,session_user::text as login,
 r.rolsuper as superuser,r.rolbypassrls as bypass_rls,r.rolcreaterole as create_role,r.rolcreatedb as create_db,r.rolinherit as inherit,r.rolreplication as replication,
 exists(select 1 from pg_auth_members m where m.member=r.oid) as member_of_role,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relowner=r.oid and n.nspname like 'helpdesk_%') as owns_private_objects,
 (exists(select 1 from pg_namespace n where n.nspowner=r.oid and n.nspname like 'helpdesk_%')
  or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proowner=r.oid and n.nspname like 'helpdesk_%')) as owns_objects
 from pg_roles r where r.rolname=current_user`;
const roleKeys=['role','login','superuser','bypass_rls','create_role','create_db','inherit','replication','member_of_role','owns_private_objects','owns_objects'] as const;

/** Private publication adapter, not the normal request pool and not a source authenticator.
 * Requires the reviewed CG03g SQL helpers and an explicitly provisioned restricted
 * helpdesk_resource_publisher login with a live DB allowlist for the connection/manifest.
 * No credential, role, grant, migration, handler or hosted resource is created here.
 * One transaction and one callback; the existing runner owns COMMIT/ROLLBACK/release.
 */
export function createPostgresResourceGrantPublicationStore(pool:SqlPool):ResourceGrantPublicationStore{
 if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function'||typeof pool.end!=='function')throw invalid();
 return Object.freeze({async runPublication<T>(input:ResourceGrantTarget,key:string,admit:()=>void,work:(transaction:ResourceGrantPublicationTransaction)=>Promise<T>):Promise<T>{
  const target=parseResourceGrantTarget(input),targetJson=canonicalJson(target),targetHash=requestHash(target);
  if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key)||typeof admit!=='function'||typeof work!=='function')throw invalid();
  let stopped:unknown,stoppedSet=false,admissionFailure:unknown;
  const fail=(error:unknown):never=>{if(!stoppedSet){stoppedSet=true;stopped=error;}throw stopped;};
  const guard=()=>{
   if(stoppedSet)throw stopped;
   try{const result:unknown=admit();if(result!==undefined){if(result instanceof Promise)void result.catch(()=>{});throw invalid();}}
   catch(error){admissionFailure=error;fail(error instanceof HelpdeskError?error:invalid());}
  };
  return runTransaction(pool,undefined,async client=>{
   const query=async(sql:string,args:unknown[]=[])=>{
    guard();let result:SqlResult;
    try{result=await client.query(sql,args);}catch(error){if(error===stopped||error===admissionFailure)throw error;return fail(databaseFailure(error));}
    guard();return result;
   };
   const role=object(singleRow(await query(roleSql)),roleKeys);
   if(role.role!=='helpdesk_resource_publisher'||role.login!==role.role||roleKeys.slice(2).some(k=>role[k]!==false))throw denied();
   const result=singleRow(await query('select helpdesk_auth.cg_publication_open($1::text,$2::text) as publication',[targetJson,key]));
   const opened=object(object(result,['publication']).publication,['receipt','current']);
   let saved:ResourcePublicationReceipt|null=null,current:ResourceGrantState|undefined;
   try{
    if(opened.receipt!==null){
     saved=readReceipt(opened.receipt);
     if(opened.current!==null||saved.key!==key||saved.targetHash!==targetHash||saved.commandHash!==requestHash({target,expectedRevision:saved.previousRevision}))throw invalid();
    }else{
     current=normalizeResourceGrantState(opened.current);
     if(current.snapshot&&requestHash(current.snapshot.target)!==targetHash)throw invalid();
    }
   }catch{throw invalid();}
   type Phase='find'|'state'|'replace'|'append'|'done'|'replay';
   const progress:{phase:Phase}={phase:'find'};let active=true,busy=false,staged:ResourcePublicationReceipt|undefined;
   const pending=new Set<Promise<unknown>>();
   const step=<R>(required:Phase,body:()=>Promise<R>):Promise<R>=>{
    const operation=(async()=>{
     if(!active)throw invalid();
     if(busy||progress.phase!==required)return fail(invalid());guard();busy=true;
     try{return await body();}catch(error){return fail(error instanceof HelpdeskError?error:invalid());}finally{busy=false;}
    })();
    pending.add(operation);void operation.then(()=>pending.delete(operation),()=>pending.delete(operation));
    return operation;
   };
   const tx:ResourceGrantPublicationTransaction=Object.freeze({
    findReceipt:()=>step('find',async()=>{progress.phase=saved?'replay':'state';return saved;}),
    readState:()=>step('state',async()=>{progress.phase='replace';return current!;}),
    replaceGrant:(value:ResourcePublicationPlan)=>step('replace',async()=>{
     let proposal:ResourcePublicationPlan;
     try{
      const p=object(value,['target','expectedRevision','snapshot','snapshotHash']);
      const normalized=normalizeResourceGrantSnapshot(p.snapshot),expected=resourceGrantRevision(p.expectedRevision);
      if(requestHash(parseResourceGrantTarget(p.target))!==targetHash||requestHash(normalized.target)!==targetHash||expected!==current!.revision
       ||p.snapshotHash!==requestHash(normalized))throw invalid();
      proposal=Object.freeze({target,expectedRevision:expected,snapshot:normalized,snapshotHash:requestHash(normalized)});
     }catch{throw invalid();}
     const response=singleRow(await query('select helpdesk_auth.cg_publication_replace($1::text,$2::text,$3::text,$4::text,$5::text) as publication',
      [targetJson,key,proposal.expectedRevision,canonicalJson(proposal.snapshot),proposal.snapshotHash]));
     const ack=object(object(response,['publication']).publication,['revision','snapshotHash']);
     try{if(BigInt(resourceGrantRevision(ack.revision))<=BigInt(proposal.expectedRevision)||ack.snapshotHash!==proposal.snapshotHash)throw invalid();}catch{throw invalid();}
     staged=readReceipt({key,commandHash:requestHash({target,expectedRevision:proposal.expectedRevision}),targetHash,previousRevision:proposal.expectedRevision,
      revision:ack.revision,snapshotHash:proposal.snapshotHash,state:proposal.snapshot.state,resourceCount:proposal.snapshot.resources.length,
      asOf:proposal.snapshot.asOf,expiresAt:proposal.snapshot.expiresAt});
     progress.phase='append';return Object.freeze({revision:staged.revision,snapshotHash:staged.snapshotHash});
    }),
    appendReceipt:(value:ResourcePublicationReceipt)=>step('append',async()=>{
     const receipt=readReceipt(value);if(canonicalJson(receipt)!==canonicalJson(staged))throw invalid();
     const result=singleRow(await query('select helpdesk_auth.cg_publication_append($1::text,$2::text,$3::text) as publication',[targetJson,key,canonicalJson(receipt)]));
     if(object(result,['publication']).publication!==true)throw invalid();progress.phase='done';return true;
    }),
   });
   let value:T;
   try{value=await work(tx);}finally{
    active=false;
    // A callback that forgot an await cannot release the client with a query in flight.
    if(pending.size){if(!stoppedSet){stoppedSet=true;stopped=invalid();}await Promise.allSettled([...pending]);}
   }
   guard();if(progress.phase!=='done'&&progress.phase!=='replay')throw invalid();return value;
  },guard);
 }} as ResourceGrantPublicationStore);
}
