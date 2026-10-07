/** Memory-only session state. No roles from Auth/JWT, no cross-tab storage, no request replay. */
import {HumanAuthError,workspaceId,validatePasswordChange,mfaCleanupCredential} from './human-auth.js';
export function createHumanSession(transport,{now=()=>Date.now(),onChange=()=>{}}={}){
 let generation=0,phase='signed_out',workspace=null,session=null,pending=null,refreshAt=0,ending=null;
 const state=()=>Object.freeze({phase,generation,workspace,expiresAt:session?.expiresAt??null,workspaceOptions:phase==='selecting_workspace'?pending.options:Object.freeze([]),mfaFactors:phase==='verifying_mfa'?pending.factors:Object.freeze([]),mfaBusy:phase==='verifying_mfa'&&pending.busy===true,enrollmentFactors:phase==='enrolling_mfa'?pending.factors??Object.freeze([]):Object.freeze([]),enrollmentBusy:phase==='enrolling_mfa'&&pending.busy===true});
 const notify=()=>{try{Promise.resolve(onChange(state())).catch(()=>{});}catch{}};
 function clear(nextPhase='signed_out'){pending?.rejectChoice?.(new HumanAuthError('stale_session'));generation++;phase=nextPhase;workspace=null;session=null;pending=null;refreshAt=0;notify();}
 function install(value){session=value;refreshAt=value.expiresAt-Math.min(60000,Math.floor((value.expiresAt-now())/2));}
 function proof(){return Object.freeze({accessToken:session.accessToken,workspace,generation});}
 const current=p=>!!session&&p?.generation===generation&&p?.workspace===workspace;
 const sameCredential=p=>current(p)&&p.accessToken===session.accessToken;
 const canDispatch=p=>current(p)&&phase==='active'&&p.accessToken===session.accessToken&&session.expiresAt>now();
 function usable(value){return value&&typeof value.accessToken==='string'&&typeof value.refreshToken==='string'&&typeof value.userId==='string'&&Number.isFinite(value.expiresAt)&&value.expiresAt>now()+1000;}
 async function signIn(fields){
  if(phase!=='signed_out')throw new HumanAuthError('login_in_progress');
  let selected=fields.workspace?workspaceId(fields.workspace):null;
  if(!selected&&typeof transport.workspaces!=='function')throw new HumanAuthError('invalid_login');
  const email=fields.email,password=fields.password;
  generation++;const id=generation;phase='signing_in';workspace=selected;notify();
  const op={id,raw:Promise.resolve().then(()=>transport.signIn(email,password)),result:null};pending=op;
  let issued;
  try{let value=await op.raw;issued=value;if(id!==generation)throw new HumanAuthError('stale_session');if(!usable(value))throw new HumanAuthError('auth_response_invalid');op.issued=value;
   const factors=value.mfaFactors??[];if(!Array.isArray(factors))throw new HumanAuthError('auth_response_invalid');
   if(factors.length){
    op.kind='mfa';op.factors=Object.freeze(factors.filter(f=>f.type==='totp').map(f=>Object.freeze({...f})));
    if(!op.factors.length||typeof transport.verifyMfa!=='function')throw new HumanAuthError('unsupported_mfa');
    const completed=new Promise((resolve,reject)=>{op.choose=resolve;op.rejectChoice=reject;});phase='verifying_mfa';notify();
    value=await completed;issued=value;op.issued=value;
    if(id!==generation)throw new HumanAuthError('stale_session');phase='signing_in';notify();
   }
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
  catch(error){if(id!==generation)throw new HumanAuthError('stale_session');
   const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   if(op.kind==='mfa'){const result=await signOut();if(generation!==id+1)throw new HumanAuthError('stale_session');safe.logoutUnconfirmed=result!=='confirmed';throw safe;}
   clear();
   if(issued&&typeof issued.accessToken==='string'){try{await transport.signOut(issued.accessToken);}catch{safe.logoutUnconfirmed=true;}}
   throw safe;
  }
  finally{if(pending===op)pending=null;}
 }
 async function verifyMfa(factorId,code){
  const op=pending,id=generation;
  if(phase!=='verifying_mfa'||!op||op.id!==id)throw new HumanAuthError('stale_session');
  if(op.busy)throw new HumanAuthError('login_in_progress');
  if(!op.factors.some(f=>f.id===factorId)||typeof code!=='string'||!/^\d{6}$/.test(code))throw new HumanAuthError('invalid_mfa');
  if(!usable(op.issued)){op.rejectChoice(new HumanAuthError('session_rejected'));throw new HumanAuthError('session_rejected');}
  const issued=op.issued;op.busy=true;op.raw=Promise.resolve().then(()=>transport.verifyMfa(issued.accessToken,issued.userId,factorId,code));notify();
  try{const value=await op.raw;if(id!==generation)throw new HumanAuthError('stale_session');
   if(!usable(value)||value.userId!==issued.userId)throw new HumanAuthError('auth_response_invalid');op.issued=value;op.choose(value);
  }catch(error){if(id!==generation)throw new HumanAuthError('stale_session');const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   if(!['mfa_failed','auth_rate_limited'].includes(safe.code))op.rejectChoice(safe);throw safe;
  }finally{if(pending===op){op.busy=false;notify();}}
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
    if(error instanceof HumanAuthError&&['session_rejected','auth_response_invalid','mfa_required'].includes(error.code))clear();
    else{phase='paused';notify();}
    throw error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   }finally{if(pending===op)pending=null;}
  })();notify();return op.result;
 }
 async function authorization(){
  if(!session)throw new HumanAuthError('session_rejected');
  if(phase==='enrolling_mfa')throw new HumanAuthError('mfa_enrollment_in_progress');
  if(phase==='changing_password')throw new HumanAuthError('password_change_in_progress');
  if(phase==='reauthenticating')throw new HumanAuthError('auth_reauthentication_in_progress');
  if(phase==='paused')throw new HumanAuthError('session_paused');
  if(phase==='refreshing')return pending.result;
  if(now()>=refreshAt)return rotate();
  return proof();
 }
 async function resume(){if(!session)throw new HumanAuthError('session_rejected');if(phase==='enrolling_mfa')throw new HumanAuthError('mfa_enrollment_in_progress');if(phase==='changing_password')throw new HumanAuthError('password_change_in_progress');if(phase==='reauthenticating')throw new HumanAuthError('auth_reauthentication_in_progress');if(phase==='refreshing')return pending.result;return rotate();}
 async function beginMfaEnrollment(){
  if(typeof transport.enrollFirstMfa!=='function')throw new HumanAuthError('auth_unavailable');
  const id=generation,p=await authorization();if(id!==generation||!current(p))throw new HumanAuthError('stale_session');if(phase!=='active')throw new HumanAuthError('mfa_enrollment_in_progress');
  const issued=session,op={id,kind:'enrollment',issued,busy:true,raw:Promise.resolve().then(()=>transport.enrollFirstMfa(issued.accessToken,issued.userId))};pending=op;phase='enrolling_mfa';notify();
  try{const registration=await op.raw;if(id!==generation)throw new HumanAuthError('stale_session');
   if(!registration||!Array.isArray(registration.factors)||!registration.factors.length)throw new HumanAuthError('auth_response_invalid');
   op.factors=Object.freeze(registration.factors.map(f=>Object.freeze({...f})));op.raw=Promise.resolve();op.busy=false;notify();return registration;
  }catch(error){if(id!==generation)throw new HumanAuthError('stale_session');const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   if(safe.code==='mfa_enrollment_exists'){pending=null;phase='active';notify();throw safe;}
   const logout=await signOut();if(generation!==id+1)throw new HumanAuthError('stale_session');safe.logoutUnconfirmed=logout==='unconfirmed';throw safe;
  }
 }
 async function confirmMfaEnrollment(factorId,code){
  const op=pending,id=generation;if(phase!=='enrolling_mfa'||!op||op.id!==id)throw new HumanAuthError('stale_session');if(op.busy)throw new HumanAuthError('mfa_enrollment_in_progress');
  if(!op.factors?.some(f=>f.id===factorId)||typeof code!=='string'||!/^\d{6}$/.test(code))throw new HumanAuthError('invalid_mfa');
  const issued=op.issued;op.busy=true;op.raw=Promise.resolve().then(()=>transport.verifyMfa(issued.accessToken,issued.userId,factorId,code));notify();let failure;
  try{const value=await op.raw;if(id!==generation)throw new HumanAuthError('stale_session');if(!usable(value)||value.userId!==issued.userId)throw new HumanAuthError('auth_response_invalid');}
  catch(error){if(id!==generation)throw new HumanAuthError('stale_session');failure=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');
   if(['mfa_failed','auth_rate_limited'].includes(failure.code)){op.busy=false;notify();throw failure;}
  }
  const logout=await signOut();if(generation!==id+1)throw new HumanAuthError('stale_session');if(failure){failure.logoutUnconfirmed=logout==='unconfirmed';throw failure;}return Object.freeze({confirmed:true,logout});
 }
 async function reauthenticate(){
  if(typeof transport.reauthenticate!=='function')throw new HumanAuthError('auth_unavailable');
  const id=generation,p=await authorization();
  if(id!==generation||!current(p))throw new HumanAuthError('stale_session');
  if(phase!=='active')throw new HumanAuthError('auth_reauthentication_in_progress');
  const op={id,kind:'reauth',raw:Promise.resolve().then(()=>transport.reauthenticate(p.accessToken))};
  pending=op;phase='reauthenticating';notify();let failure;
  try{await op.raw;}catch(error){failure=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');}
  if(id!==generation)throw new HumanAuthError('stale_session');
  if(failure?.code==='session_rejected'){
   const logout=await signOut();if(generation!==id+1)throw new HumanAuthError('stale_session');failure.logoutUnconfirmed=logout==='unconfirmed';throw failure;
  }
  if(pending===op)pending=null;phase='active';notify();if(failure)throw failure;
 }
 async function changePassword(currentPassword,password,nonce=''){
  validatePasswordChange(currentPassword,password,nonce);
  if(typeof transport.changePassword!=='function')throw new HumanAuthError('auth_unavailable');
  const id=generation,p=await authorization();
  if(id!==generation||!current(p))throw new HumanAuthError('stale_session');
  if(phase!=='active')throw new HumanAuthError('password_change_in_progress');
  const old=session;
  const op={id,kind:'password',raw:Promise.resolve().then(()=>transport.changePassword(old.accessToken,old.userId,currentPassword,password,nonce))};
  pending=op;phase='changing_password';notify();
  let failure;
  try{await op.raw;}catch(error){failure=error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');}
  if(id!==generation)throw new HumanAuthError('stale_session');
  const logout=await signOut();
  if(generation!==id+1)throw new HumanAuthError('stale_session');
  if(failure){failure.logoutUnconfirmed=logout==='unconfirmed';throw failure;}
  return Object.freeze({changed:true,logout});
 }
 async function signOut({scope='local'}={}){
  if(!['local','global'].includes(scope))throw new HumanAuthError('invalid_logout_scope');
  if(ending)return ending;
  const old=session,wait=pending,block=scope==='global'||['password','reauth','mfa','enrollment'].includes(wait?.kind);clear(block?'signing_out':'signed_out');
  // Await an already-issued login/rotation so the newest returned token is revoked, never installed.
  // Transport has a deadline. The UI is cleared synchronously before this await.
  const finish=(async()=>{
   let target=old?.accessToken??wait?.issued?.accessToken;const userId=old?.userId??wait?.issued?.userId;
   if(wait){try{const value=await wait.raw;if(usable(value)&&(!userId||value.userId===userId))target=value.accessToken;}catch(error){const cleanup=mfaCleanupCredential(error);if(cleanup&&userId&&cleanup.userId===userId)target=cleanup.accessToken;}}
   if(!target)return wait?'unconfirmed':'not_requested';
   try{await transport.signOut(target,scope);return 'confirmed';}catch{return 'unconfirmed';}
  })();
  if(!block)return finish;
  // A global request can revoke a newly-created provider session. Do not allow login
  // in this page until its bounded result arrives; duplicate requests join it.
  ending=finish;
  try{return await finish;}finally{ending=null;phase='signed_out';notify();}
 }
 function reject(p){if(!current(p)||p.accessToken!==session.accessToken)return false;if(['password','reauth','enrollment'].includes(pending?.kind)){void signOut();return true;}clear();return true;}
 function selectWorkspace(value){if(phase!=='selecting_workspace'||pending?.id!==generation)throw new HumanAuthError('stale_session');const selected=workspaceId(value);if(!pending.options.some(x=>x.id===selected))throw new HumanAuthError('invalid_login');pending.choose(selected);}
 return Object.freeze({state,signIn,selectWorkspace,verifyMfa,beginMfaEnrollment,confirmMfaEnrollment,authorization,resume,reauthenticate,changePassword,signOut,reject,current,canDispatch,sameCredential});
}
