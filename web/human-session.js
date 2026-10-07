/** Memory-only session state. No roles from Auth/JWT, no cross-tab storage, no request replay. */
import {HumanAuthError,workspaceId} from './human-auth.js';
export function createHumanSession(transport,{now=()=>Date.now(),onChange=()=>{}}={}){
 let generation=0,phase='signed_out',workspace=null,session=null,pending=null,refreshAt=0,ending=null;
 const state=()=>Object.freeze({phase,generation,workspace,expiresAt:session?.expiresAt??null,workspaceOptions:phase==='selecting_workspace'?pending.options:Object.freeze([])});
 const notify=()=>{try{Promise.resolve(onChange(state())).catch(()=>{});}catch{}};
 function clear(nextPhase='signed_out'){pending?.rejectChoice?.(new HumanAuthError('stale_session'));generation++;phase=nextPhase;workspace=null;session=null;pending=null;refreshAt=0;notify();}
 function install(value){session=value;refreshAt=value.expiresAt-Math.min(60000,Math.floor((value.expiresAt-now())/2));}
 function proof(){return Object.freeze({accessToken:session.accessToken,workspace,generation});}
 const current=p=>!!session&&p?.generation===generation&&p?.workspace===workspace;
 function usable(value){return value&&typeof value.accessToken==='string'&&typeof value.refreshToken==='string'&&typeof value.userId==='string'&&Number.isFinite(value.expiresAt)&&value.expiresAt>now()+1000;}
 async function signIn(fields){
  if(phase!=='signed_out')throw new HumanAuthError('login_in_progress');
  let selected=fields.workspace?workspaceId(fields.workspace):null;
  if(!selected&&typeof transport.workspaces!=='function')throw new HumanAuthError('invalid_login');
  const email=fields.email,password=fields.password;
  generation++;const id=generation;phase='signing_in';workspace=selected;notify();
  const op={id,raw:Promise.resolve().then(()=>transport.signIn(email,password)),result:null};pending=op;
  let issued;
  try{const value=await op.raw;issued=value;if(id!==generation)throw new HumanAuthError('stale_session');if(!usable(value))throw new HumanAuthError('auth_response_invalid');
   if(!selected){
    const items=await transport.workspaces(value.accessToken);if(id!==generation)throw new HumanAuthError('stale_session');
    if(!items.length)throw new HumanAuthError('membership_required');
    if(items.length===1)selected=workspaceId(items[0].id);
    else{op.options=Object.freeze(items.map(x=>Object.freeze({...x})));phase='selecting_workspace';
     const choice=new Promise((resolve,reject)=>{op.choose=resolve;op.rejectChoice=reject;});notify();selected=await choice;
    }
   }
   if(id!==generation)throw new HumanAuthError('stale_session');if(!usable(value))throw new HumanAuthError('session_rejected');
   workspace=selected;install(value);phase='active';notify();
  }
  catch(error){if(id!==generation)throw new HumanAuthError('stale_session');clear();
   const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   if(issued&&typeof issued.accessToken==='string'){try{await transport.signOut(issued.accessToken);}catch{safe.logoutUnconfirmed=true;}}
   throw safe;
  }
  finally{if(pending===op)pending=null;}
 }
 function rotate(){
  if(pending?.id===generation&&phase==='refreshing')return pending.result;
  const old=session,id=generation;phase='refreshing';
  const op={id,raw:Promise.resolve().then(()=>transport.refresh(old.refreshToken)),result:null};pending=op;
  op.result=(async()=>{
   try{const value=await op.raw;if(id!==generation)throw new HumanAuthError('stale_session');
    if(!usable(value)||value.userId!==old.userId){clear();throw new HumanAuthError('session_rejected');}
    install(value);phase='active';notify();return proof();
   }catch(error){
    if(id!==generation)throw new HumanAuthError('stale_session');
    if(error instanceof HumanAuthError&&['session_rejected','auth_response_invalid'].includes(error.code))clear();
    else{phase='paused';notify();}
    throw error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   }finally{if(pending===op)pending=null;}
  })();notify();return op.result;
 }
 async function authorization(){
  if(!session)throw new HumanAuthError('session_rejected');
  if(phase==='paused')throw new HumanAuthError('session_paused');
  if(phase==='refreshing')return pending.result;
  if(now()>=refreshAt)return rotate();
  return proof();
 }
 async function resume(){if(!session)throw new HumanAuthError('session_rejected');if(phase==='refreshing')return pending.result;return rotate();}
 async function signOut({scope='local'}={}){
  if(!['local','global'].includes(scope))throw new HumanAuthError('invalid_logout_scope');
  if(ending)return ending;
  const old=session,wait=pending;clear(scope==='global'?'signing_out':'signed_out');
  // Await an already-issued login/rotation so the newest returned token is revoked, never installed.
  // Transport has a deadline. The UI is cleared synchronously before this await.
  const finish=(async()=>{
   let target=old?.accessToken;
   if(wait){try{const value=await wait.raw;if(usable(value)&&(!old||value.userId===old.userId))target=value.accessToken;}catch{}}
   if(!target)return wait?'unconfirmed':'not_requested';
   try{await transport.signOut(target,scope);return 'confirmed';}catch{return 'unconfirmed';}
  })();
  if(scope==='local')return finish;
  // A global request can revoke a newly-created provider session. Do not allow login
  // in this page until its bounded result arrives; duplicate requests join it.
  ending=finish;
  try{return await finish;}finally{ending=null;phase='signed_out';notify();}
 }
 function reject(p){if(!current(p)||p.accessToken!==session.accessToken)return false;clear();return true;}
 function selectWorkspace(value){if(phase!=='selecting_workspace'||pending?.id!==generation)throw new HumanAuthError('stale_session');const selected=workspaceId(value);if(!pending.options.some(x=>x.id===selected))throw new HumanAuthError('invalid_login');pending.choose(selected);}
 return Object.freeze({state,signIn,selectWorkspace,authorization,resume,signOut,reject,current});
}
