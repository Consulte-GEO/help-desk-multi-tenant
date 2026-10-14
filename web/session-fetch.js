/** Sends each business request once. A 401 must not trigger automatic mutation replay. */
import {HumanAuthError} from './human-auth.js';
export function createSessionFetch(session,fetcher=fetch){
 const proofs=new WeakMap();
 const request=async(path,options={})=>{
  if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\\r\n#]/.test(path))throw new HumanAuthError('invalid_api_path');
  const url=new URL('/v1'+path,'https://helpdesk.invalid');
  if(!url.pathname.startsWith('/v1/')||url.origin!=='https://helpdesk.invalid')throw new HumanAuthError('invalid_api_path');
  let proof;
  try{proof=await session.authorization();if(!session.current(proof))throw new HumanAuthError('stale_session');}
  catch(error){const safe=error instanceof HumanAuthError?new HumanAuthError(error.code):new HumanAuthError('auth_unavailable');safe.requestSent=false;throw safe;}
  const headers=new Headers(options.headers);headers.set('authorization','Bearer '+proof.accessToken);headers.set('x-workspace-id',proof.workspace);
  // Some hosted ingress paths consume standard conditional headers. Carry the
  // same pinned version independently; the server refuses conflicting copies.
  const version=headers.get('if-match');if(version!==null&&['POST','PUT','PATCH','DELETE'].includes(String(options.method??'GET').toUpperCase()))headers.set('x-helpdesk-if-match',version);
  const init={...options,headers,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'};
  // Acquiring a proof can yield before a sensitive operation reserves the session.
  // Gate dispatch separately; current() must still recognize already-issued responses.
  if(!session.canDispatch(proof)){const safe=new HumanAuthError('stale_session');safe.requestSent=false;throw safe;}
  const response=await fetcher('/v1'+path,init);
  if(!session.current(proof))throw new HumanAuthError('stale_session');
  if(response.status===401)session.reject(proof);
  proofs.set(response,proof);
  return response;
 };
 request.currentResponse=response=>session.sameCredential(proofs.get(response));
 return request;
}
