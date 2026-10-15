import {uuid} from '../import-process/canonical.ts';
export interface ProcessCredential {actorId:string;accessToken:string;}
/** Browser transport: the server still authenticates and authorizes every call.
 * The bearer remains in the provider closure, never Vuex or a recovery marker. */
export function createAuthenticatedProcessTransport(o:{origin:string;credential:()=>Promise<ProcessCredential|null>;fetch:typeof fetch;onEnd?:()=>void}){
 const origin=new URL(o.origin);
 if(origin.origin!==o.origin||origin.protocol!=='https:'||origin.username||origin.password)throw Error('INVALID_PROCESS_ORIGIN');
 let live=true,actorId:string|undefined;
 const lifetime=new AbortController();
 const endSession=()=>{if(!live)return;live=false;lifetime.abort();o.onEnd?.();};
 const assertLive=(signal?:AbortSignal)=>{if(!live||signal?.aborted)throw Error('SESSION_CHANGED');};
 const sessionFetch:typeof fetch=async(input,init={})=>{
  // Only paths minted by the process client are accepted; absolute and traversal
  // input is rejected before URL normalization and before consulting credentials.
  if(typeof input!=='string'||!/^\/v1\/import-processes(?:\/[A-Za-z0-9-]+)*$/.test(input))throw Error('INVALID_PROCESS_URL');
  assertLive(init.signal??undefined);
  const credential=await o.credential();assertLive(init.signal??undefined);
  if(!credential){endSession();throw Error('SESSION_REQUIRED');}
  const currentActor=uuid(credential.actorId);
  if(typeof credential.accessToken!=='string'||!credential.accessToken||/[\s\u0000-\u001f\u007f]/.test(credential.accessToken))throw Error('SESSION_REQUIRED');
  if(actorId!==undefined&&actorId!==currentActor){endSession();throw Error('SESSION_CHANGED');}
  actorId=currentActor;
  const headers=new Headers(init.headers);headers.set('authorization','Bearer '+credential.accessToken);
  const signal=init.signal?AbortSignal.any([lifetime.signal,init.signal]):lifetime.signal;
  const response=await o.fetch(origin.origin+input,{...init,headers,signal,credentials:'omit',redirect:'error',cache:'no-store'});
  assertLive(signal);
  if(response.status===401)endSession();
  return response;
 };
 return {sessionFetch,endSession,get actorId(){return actorId??null;}};
}
