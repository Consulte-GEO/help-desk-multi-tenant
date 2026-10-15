import {getSupabaseAsync} from './supabaseClient';
import {createAuthenticatedProcessTransport} from '../../../modules/import-process-client/host-session.ts';
import {createImportProcessClient} from '../../../modules/import-process-client/client.ts';
import {registerImportProcessSession} from '../../../modules/import-process-client/vuex-binding.ts';
import type {VuexStorePort} from '../../../modules/import-process-client/vuex-binding.ts';
import {createSessionRecoveryJournal} from '../../../modules/import-process-client/recovery-journal.ts';
import {record,uuid,integer,text,copyJson} from '../../../modules/import-process/canonical.ts';

export interface SavedImportProcess {caseId:string;workspaceId:string;accountId:string;workRef:string|null;purpose:string;status:string;version:number;updatedAt:string;}
interface AuthorizedScope {workspaceId:string;accountId:string;requesterId:string;workRef:string|null;role:'requester'|'support';}
/** Mount only from live same-origin session capabilities; never local demo data. */
export async function startImportProcessHost(store:VuexStorePort){
 const sb=await getSupabaseAsync();if(!sb)throw Error('SESSION_REQUIRED');
 let binding:ReturnType<typeof registerImportProcessSession>|undefined,disposed=false,openGeneration=0;
 let opening:AbortController|undefined;
 const transport=createAuthenticatedProcessTransport({origin:window.location.origin,credential:async()=>{
  const {data,error}=await sb.auth.getSession();
  return error||!data.session?null:{actorId:data.session.user.id,accessToken:data.session.access_token};
 },fetch:window.fetch.bind(window),onEnd:()=>{openGeneration++;opening?.abort();binding?.endSession();}});
 const client=createImportProcessClient({sessionFetch:transport.sessionFetch});
 const subscription=sb.auth.onAuthStateChange((_event,session)=>{
  if(!session||transport.actorId!==null&&session.user.id!==transport.actorId)transport.endSession();
 }).data.subscription;
 function dispose(logout=false){if(disposed)return;disposed=true;openGeneration++;opening?.abort();subscription.unsubscribe();if(logout)binding?.endSession();else binding?.dispose();transport.endSession();}
 async function json(path:string){
  const response=await transport.sessionFetch(path,{method:'GET',headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok||!/^application\/json\b/.test(response.headers.get('content-type')||'')||!response.body)throw Error('PROCESS_UNAVAILABLE');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let count=0;
  try{while(true){const value=await reader.read();if(value.done)break;count+=value.value.byteLength;if(count>131072)throw Error('INVALID_RESPONSE');chunks.push(value.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(count);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  return copyJson(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 }
 try{
  const session=record(await json('/v1/import-processes/session'),['actorId','scopes','enabled','sourceIntegration']);
  const actorId=uuid(session.actorId);
  if(actorId!==transport.actorId||session.enabled!==true||session.sourceIntegration!=='prepared'||!Array.isArray(session.scopes)||session.scopes.length>32)throw Error('INVALID_SESSION');
  const scopes=session.scopes.map(raw=>{
   const s=record(raw,['workspaceId','accountId','requesterId','workRef','role']);[s.workspaceId,s.accountId,s.requesterId].forEach(uuid);
   if(s.workRef!==null)text(s.workRef);if(!['requester','support'].includes(String(s.role)))throw Error('INVALID_SESSION');return s as unknown as AuthorizedScope;
  });
  return {
   async list():Promise<{cases:SavedImportProcess[];more:boolean}>{
    const result=record(await json('/v1/import-processes'),['cases','more']);
    if(!Array.isArray(result.cases)||result.cases.length>100||typeof result.more!=='boolean')throw Error('INVALID_LIST');
    const cases=result.cases.map(raw=>{
     const c=record(raw,['caseId','workspaceId','accountId','workRef','purpose','status','version','updatedAt']);[c.caseId,c.workspaceId,c.accountId].forEach(uuid);integer(c.version,1);text(c.updatedAt);
     if(c.workRef!==null)text(c.workRef);if(!['new_work','history','reports','reconciliation'].includes(String(c.purpose))||!['draft','cancelled'].includes(String(c.status)))throw Error('INVALID_LIST');
     if(!scopes.some(s=>s.workspaceId===c.workspaceId&&s.accountId===c.accountId&&s.workRef===c.workRef))throw Error('SCOPE_CHANGED');return c as unknown as SavedImportProcess;
    });return {cases,more:result.more};
   },
   async open(caseId:string){
    if(disposed)throw Error('SESSION_CHANGED');uuid(caseId);
    const generation=++openGeneration;opening?.abort();const control=new AbortController();opening=control;
    const current=()=>{if(disposed||generation!==openGeneration||control.signal.aborted)throw Error('SESSION_CHANGED');};
    const {process:p}=await client.getCase(caseId,control.signal);current();
    if(!scopes.some(s=>s.workspaceId===p.workspaceId&&s.accountId===p.accountId&&s.requesterId===p.requesterId&&s.workRef===p.workRef))throw Error('SCOPE_CHANGED');
    binding?.endSession();
    const guarded={...client,async getCase(id:string,signal?:AbortSignal){const current=await client.getCase(id,signal);if(current.process.workspaceId!==p.workspaceId||current.process.accountId!==p.accountId||current.process.requesterId!==p.requesterId||current.process.workRef!==p.workRef)throw Error('SCOPE_CHANGED');return current;}};
    binding=registerImportProcessSession({enabled:true,store,client:guarded,newId:()=>crypto.randomUUID(),recovery:{identity:{actorId,workspaceId:p.workspaceId,accountId:p.accountId},journal:createSessionRecoveryJournal(window.sessionStorage)}});
    // Initialize before the route changes so a component watcher cannot reopen
    // the previous route's case while the new namespace is still idle.
    const actions=store as VuexStorePort&{dispatch(type:string,payload?:unknown):Promise<unknown>};
    const recovered=await actions.dispatch('importProcess/restorePending');current();
    if(!recovered){await actions.dispatch('importProcess/open',{caseId});current();}
   },
   dispose:()=>dispose(),endSession:()=>dispose(true),scopeCount:scopes.length,
  };
 }catch(error){dispose();throw error;}
}
