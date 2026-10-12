/** Bounded adapter for Supabase password/refresh/local-logout. Not an authorization engine. */
import {verifiedMfaFactors,hasAal2Claims,sameUserClaims,sessionAssuranceLevel} from '../shared/mfa.js';
const mfaCleanup=new WeakMap();
/** Internal cleanup channel; credentials never become enumerable error properties. */
export const mfaCleanupCredential=error=>mfaCleanup.get(error);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const messages=Object.freeze({
 invalid_auth_config:'Configuração de autenticação indisponível.',
 invalid_recovery_email:'Informe um e-mail cadastrado com texto válido.',
 recovery_request_unconfirmed:'O provedor retornou uma confirmação incompatível. A entrega não está confirmada; nenhum envio foi repetido.',
 recovery_request_unavailable:'Não foi possível confirmar a solicitação agora. A entrega pode estar pendente; nenhum envio foi repetido.',
 recovery_request_rejected:'O provedor não confirmou a solicitação. Verifique os requisitos de acesso ou use o canal de suporte; nenhuma entrega foi confirmada.',
 recovery_password_rejected:'O provedor recusou a nova senha. Verifique os requisitos da recuperação e da política de senha.',
 invalid_recovery_link:'Informe o link direto de recuperação deste provedor, antes de abri-lo. Links já consumidos, PKCE ou credenciais na URL não são usados nesta etapa.',
 recovery_failed:'O link não foi confirmado. Pode estar inválido, expirado ou já utilizado; obtenha outro pelo provedor.',
 invalid_recovered_password:'Informe uma nova senha com texto válido.',
 invalid_login:'Informe e-mail, senha e um workspace válido.',
 simple_workspace_required:'Seu acesso precisa de uma operação única definida. Procure o administrador.',
 simple_mfa_required:'Esta conta exige autenticação adicional. O acesso simples não está disponível para ela.',
 invalid_logout_scope:'Tipo de encerramento de sessão inválido.',
 invalid_password_change:'Informe a senha atual e uma nova senha diferente, com texto válido.',
 invalid_mfa:'Escolha seu autenticador e informe o código de seis dígitos.',
 mfa_failed:'O código não foi confirmado. Verifique seu autenticador e tente novamente.',
 mfa_unavailable:'O provedor recusou ou não confirmou a autenticação multifator. A entrada será encerrada; verifique os requisitos de acesso antes de tentar novamente.',
 mfa_addition_requires_verified:'Configure e confirme seu primeiro autenticador antes de adicionar outro.',
 mfa_factor_limit:'O catálogo atingiu o limite suportado de fatores. A gestão e remoção precisam de revisão no provedor.',
 mfa_enrollment_exists:'Já há MFA confirmado nesta conta. Use Adicionar outro autenticador para configurar mais um.',
 mfa_enrollment_rejected:'O provedor recusou o cadastro do autenticador. Verifique os requisitos de acesso.',
 mfa_enrollment_in_progress:'A configuração do autenticador está em andamento. Conclua ou encerre esta etapa.',
 mfa_required:'Confirme a autenticação multifator ao entrar novamente.',
 unsupported_mfa:'Sua conta exige MFA, mas não há autenticador TOTP confirmado compatível com esta etapa do Help Desk.',
 password_change_in_progress:'A alteração de senha está em andamento. Aguarde o resultado.',
 password_change_rejected:'O provedor recusou a alteração. Verifique a senha atual e os requisitos da nova senha.',
 password_change_reauthenticate:'O provedor exige nova autenticação. Entre novamente antes de alterar a senha.',
 password_change_requires_mfa:'O provedor exige autenticação com MFA para alterar a senha. Entre novamente confirmando seu autenticador cadastrado.',
 password_change_nonce_invalid:'O código de confirmação expirou ou foi recusado. Entre novamente e solicite outro código antes de alterar a senha.',
 invalid_password_nonce:'Informe um código de confirmação válido, sem espaços ou caracteres especiais.',
 auth_reauthentication_in_progress:'A solicitação de código está em andamento. Aguarde o resultado.',
 auth_reauthentication_rejected:'O provedor recusou a solicitação de código. Verifique seu canal de contato confirmado e os requisitos de acesso.',
 login_in_progress:'Uma autenticação já está em andamento. Aguarde ou cancele.',
 login_failed:'Não foi possível autenticar. Verifique suas credenciais e a configuração de acesso.',
 auth_unavailable:'Não foi possível renovar ou validar a sessão. Tente novamente.',
 auth_rate_limited:'O serviço de identidade limitou as solicitações. Aguarde antes de tentar novamente.',
 auth_response_invalid:'O serviço de identidade retornou uma sessão incompatível. Acesso não concedido.',
 session_rejected:'Sua sessão não é mais válida. Entre novamente.',
 session_paused:'A renovação da sessão está pausada. Tente renovar ou saia da sessão.',
 stale_session:'Operação cancelada por mudança de sessão.',
 auth_logout_unconfirmed:'A saída foi local, mas o encerramento no provedor não foi confirmado.',
 invalid_api_path:'Caminho de API não permitido.'
 ,membership_required:'Sua identidade não possui vínculo ativo com um workspace.'
});
export class HumanAuthError extends Error {
 constructor(code){super(messages[code]??messages.auth_unavailable);this.name='HumanAuthError';this.code=Object.hasOwn(messages,code)?code:'auth_unavailable';this.status=['membership_required','mfa_required','unsupported_mfa'].includes(this.code)?403:['session_rejected','login_failed'].includes(this.code)?401:this.code.startsWith('invalid_')||this.code==='mfa_failed'?400:this.code==='login_in_progress'?409:503;}
}
export function workspaceId(value){if(typeof value!=='string'||!UUID.test(value))throw new HumanAuthError('invalid_login');return value.toLowerCase();}
const tokenText=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&/^[A-Za-z0-9._~-]+$/.test(value);
const validText=value=>typeof value==='string'&&value.isWellFormed()&&!value.includes('\0');
export function validatePasswordChange(current,password,nonce=''){if(!validText(current)||!current.length||current.length>4096||!validText(password)||!password.length||password.length>4096||current===password)throw new HumanAuthError('invalid_password_change');if(typeof nonce!=='string'||(nonce!==''&&!/^[A-Za-z0-9_-]{1,128}$/.test(nonce)))throw new HumanAuthError('invalid_password_nonce');}
export function validateRecoveryEmail(email){if(!validText(email)||email.length>320||/[\u0000-\u001f\u007f]/.test(email)||! /^[^\s@]+@[^\s@]+$/.test(email.trim()))throw new HumanAuthError('invalid_recovery_email');return email.trim();}
export function validateRecoveredPassword(password){if(!validText(password)||!password.length||password.length>4096)throw new HumanAuthError('invalid_recovered_password');}
export function recoveryTokenHash(link,supabaseUrl){
 try{if(!validText(link)||link.length>4096||/[\u0000-\u001f\u007f]/.test(link))throw Error();const url=new URL(link.trim());
  if(url.origin!==new URL(supabaseUrl).origin||url.protocol!=='https:'||url.pathname!=='/auth/v1/verify'||url.username||url.password||url.hash)throw Error();
  const keys=[...url.searchParams.keys()];if(new Set(keys).size!==keys.length||keys.some(k=>!['token','token_hash','type','redirect_to'].includes(k))||url.searchParams.get('type')!=='recovery'||Number(url.searchParams.has('token'))+Number(url.searchParams.has('token_hash'))!==1)throw Error();
  const token=url.searchParams.get('token')??url.searchParams.get('token_hash');if(!/^[A-Za-z0-9_-]{16,256}$/.test(token??'')||token.startsWith('pkce_'))throw Error();return token;
 }catch{throw new HumanAuthError('invalid_recovery_link');}
}
function sessionFrom(value,started,now){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.token_type?.toLowerCase?.()!=='bearer'
 ||!tokenText(value.access_token,8192)||!JWT.test(value.access_token)||!tokenText(value.refresh_token,4096)
 ||!Number.isInteger(value.expires_in)||value.expires_in<1||value.expires_in>86400
 ||!value.user||typeof value.user!=='object'||!UUID.test(value.user.id??''))throw new HumanAuthError('auth_response_invalid');
 let expiresAt=started+value.expires_in*1000;
 if(value.expires_at!==undefined){if(!Number.isSafeInteger(value.expires_at)||value.expires_at<=0)throw new HumanAuthError('auth_response_invalid');expiresAt=Math.min(expiresAt,value.expires_at*1000);}
 if(expiresAt<=now+1000)throw new HumanAuthError('auth_response_invalid');
 // JWT shape is checked only for transport hygiene. Backend validates identity and live grants.
 let mfaFactors;try{mfaFactors=verifiedMfaFactors(value.user.factors);}catch{throw new HumanAuthError('auth_response_invalid');}
 return Object.freeze({accessToken:value.access_token,refreshToken:value.refresh_token,expiresAt,userId:value.user.id.toLowerCase(),mfaFactors});
}
async function jsonBody(response,signal){
 if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw new HumanAuthError('auth_response_invalid');
 const max=65536,length=response.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw new HumanAuthError('auth_response_invalid');
 if(!response.body)throw new HumanAuthError('auth_response_invalid');
 const reader=response.body.getReader(),chunks=[];let size=0;
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 if(signal.aborted){cancel();throw new HumanAuthError('auth_unavailable');}
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new HumanAuthError('auth_response_invalid');chunks.push(value);}
  if(signal.aborted)throw new HumanAuthError('auth_unavailable');
  const encoding=response.headers.get('content-encoding');
  if((!encoding||encoding==='identity')&&length!==null&&Number(length)!==size)throw new HumanAuthError('auth_response_invalid');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw new HumanAuthError('auth_response_invalid');}
 }finally{signal.removeEventListener('abort',cancel);cancel();}
}
export function createHumanAuthTransport(config,{fetcher=fetch,now=()=>Date.now(),timeoutMs=5000}={}){
 if(!config||typeof config.supabase_url!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(config.supabase_url)
 ||typeof config.publishable_key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(config.publishable_key)
 ||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>10000)throw new HumanAuthError('invalid_auth_config');
 const origin=new URL(config.supabase_url).origin,key=config.publishable_key;
 async function request(path,body,access,operation,expectedUser){
  const started=now(),controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new HumanAuthError('auth_unavailable'));},timeoutMs);});
  try{return await Promise.race([deadline,(async()=>{
   const headers={apikey:key,...(body?{'content-type':'application/json'}:{}),...(access?{authorization:'Bearer '+access}:{})};
   const response=await fetcher(origin+'/auth/v1'+path,{method:['password','recovery_password'].includes(operation)?'PUT':['reauth','enroll_read','enroll_add_read','security_read'].includes(operation)?'GET':'POST',headers,...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
   if(response.redirected)throw new HumanAuthError('auth_response_invalid');
   if(operation==='logout'){if(response.status!==204)throw new HumanAuthError('auth_logout_unconfirmed');return;}
   if(response.status===429)throw new HumanAuthError('auth_rate_limited');
   if(operation==='security_read'){
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const data=await jsonBody(response,controller.signal);
    if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string'||data.id.toLowerCase()!==expectedUser)throw new HumanAuthError('auth_response_invalid');
    try{verifiedMfaFactors(data.factors);}catch{throw new HumanAuthError('auth_response_invalid');}
    const observedAt=now();
    return Object.freeze({factors:Object.freeze((data.factors??[]).map(f=>Object.freeze({id:f.id.toLowerCase(),type:f.factor_type,status:f.status}))),currentLevel:sessionAssuranceLevel(access,expectedUser,observedAt),observedAt});
   }
   if(['enroll_read','enroll_add_read','enroll'].includes(operation)){
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if([400,403,422].includes(response.status))throw new HumanAuthError('mfa_enrollment_rejected');
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const data=await jsonBody(response,controller.signal);
    if(['enroll_read','enroll_add_read'].includes(operation)){
     if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string'||data.id.toLowerCase()!==expectedUser)throw new HumanAuthError('auth_response_invalid');
     let verified;try{verified=verifiedMfaFactors(data.factors);}catch{throw new HumanAuthError('auth_response_invalid');}
     if(operation==='enroll_add_read'){
      if(!verified.length)throw new HumanAuthError('mfa_addition_requires_verified');
      if(!hasAal2Claims(access,expectedUser,now()))throw new HumanAuthError('mfa_required');
      const pending=Object.freeze(data.factors.filter(f=>f.status==='unverified'&&f.factor_type==='totp').map(f=>Object.freeze({id:f.id.toLowerCase(),type:'totp'})));
      if(!pending.length&&data.factors.length>=20)throw new HumanAuthError('mfa_factor_limit');
      return Object.freeze({pending,ids:Object.freeze(data.factors.map(f=>f.id.toLowerCase()))});
     }
     if(verified.length)throw new HumanAuthError('mfa_enrollment_exists');
     return Object.freeze((data.factors??[]).filter(f=>f.status==='unverified'&&f.factor_type==='totp').map(f=>Object.freeze({id:f.id.toLowerCase(),type:'totp'})));
    }
    if(!data||typeof data!=='object'||Array.isArray(data)||!UUID.test(data.id??'')||data.type!=='totp'||typeof data.totp?.secret!=='string'||!/^\b[A-Z2-7]{16,128}\b$/.test(data.totp.secret))throw new HumanAuthError('auth_response_invalid');
    return Object.freeze({generated:true,factors:Object.freeze([Object.freeze({id:data.id.toLowerCase(),type:'totp'})]),secret:data.totp.secret});
   }
   if(operation==='challenge'){
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if([400,403,422].includes(response.status)){
     const error=await jsonBody(response,controller.signal),code=typeof error?.error_code==='string'?error.error_code:typeof error?.code==='string'?error.code:null;
     throw new HumanAuthError(['mfa_verification_failed','mfa_challenge_expired'].includes(code)?'mfa_failed':'mfa_unavailable');
    }
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const challenge=await jsonBody(response,controller.signal);
    if(!challenge||typeof challenge!=='object'||Array.isArray(challenge)||!UUID.test(challenge.id??'')||challenge.type!=='totp'||!Number.isSafeInteger(challenge.expires_at)||challenge.expires_at<=Math.floor(now()/1000))throw new HumanAuthError('auth_response_invalid');
    return challenge.id.toLowerCase();
   }
   if(operation==='mfa'){
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if([400,403,422].includes(response.status)){
     const error=await jsonBody(response,controller.signal),code=typeof error?.error_code==='string'?error.error_code:typeof error?.code==='string'?error.code:null;
     throw new HumanAuthError(['mfa_verification_failed','mfa_challenge_expired'].includes(code)?'mfa_failed':'mfa_unavailable');
    }
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const raw=await jsonBody(response,controller.signal);
    try{const value=sessionFrom(raw,started,now());if(value.userId!==expectedUser||!hasAal2Claims(value.accessToken,expectedUser,now()))throw new HumanAuthError('auth_response_invalid');return value;}
    catch(error){const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_response_invalid');
     if(raw&&typeof raw.user?.id==='string'&&raw.user.id.toLowerCase()===expectedUser&&tokenText(raw.access_token,8192)&&sameUserClaims(raw.access_token,expectedUser,now()))mfaCleanup.set(safe,Object.freeze({accessToken:raw.access_token,userId:expectedUser}));
     throw safe;
    }
   }
   if(operation==='reauth'){
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if([400,403,422].includes(response.status))throw new HumanAuthError('auth_reauthentication_rejected');
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const data=await jsonBody(response,controller.signal);
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>k!=='message_id')||(data.message_id!==undefined&&(!validText(data.message_id)||!data.message_id.length||data.message_id.length>256||/[\u0000-\u001f\u007f]/.test(data.message_id))))throw new HumanAuthError('auth_response_invalid');
    return;
   }
   if(operation==='recovery_request'){
    if([400,401,403,422].includes(response.status))throw new HumanAuthError('recovery_request_rejected');
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const data=await jsonBody(response,controller.signal);if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length)throw new HumanAuthError('auth_response_invalid');return;
   }
   if(operation==='recovery'){
    if([400,401,403,422].includes(response.status))throw new HumanAuthError('recovery_failed');
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const raw=await jsonBody(response,controller.signal);
    try{const value=sessionFrom(raw,started,now());if(!sameUserClaims(value.accessToken,value.userId,now()))throw new HumanAuthError('auth_response_invalid');return value;}
    catch(error){const safe=error instanceof HumanAuthError?error:new HumanAuthError('auth_response_invalid');if(typeof raw?.user?.id==='string'&&UUID.test(raw.user.id)&&tokenText(raw.access_token,8192)&&sameUserClaims(raw.access_token,raw.user.id.toLowerCase(),now()))mfaCleanup.set(safe,Object.freeze({accessToken:raw.access_token,userId:raw.user.id.toLowerCase()}));throw safe;}
   }
   if(['password','recovery_password'].includes(operation)){
    if([400,401,403,422].includes(response.status)){
     const error=await jsonBody(response,controller.signal),code=typeof error?.error_code==='string'?error.error_code:typeof error?.code==='string'?error.code:null;
     throw new HumanAuthError(code==='reauthentication_needed'?'password_change_reauthenticate':code==='insufficient_aal'?'password_change_requires_mfa':['reauthentication_not_valid','otp_expired'].includes(code)?'password_change_nonce_invalid':operation==='recovery_password'?'recovery_password_rejected':'password_change_rejected');
    }
    if(response.status!==200)throw new HumanAuthError('auth_unavailable');
    const user=await jsonBody(response,controller.signal);
    if(!user||typeof user!=='object'||Array.isArray(user)||typeof user.id!=='string'||user.id.toLowerCase()!==expectedUser)throw new HumanAuthError('auth_response_invalid');
    return;
   }
   if([400,401,403].includes(response.status))throw new HumanAuthError(operation==='login'?'login_failed':'session_rejected');
   if(response.status!==200)throw new HumanAuthError('auth_unavailable');
   const value=sessionFrom(await jsonBody(response,controller.signal),started,now());
   if(operation==='refresh'&&value.mfaFactors.length&&!hasAal2Claims(value.accessToken,value.userId,now()))throw new HumanAuthError('mfa_required');
   return value;
  })()]);}
  catch(error){if(error instanceof HumanAuthError)throw error;throw new HumanAuthError('auth_unavailable');}
  finally{clearTimeout(timer);controller.abort();}
 }
 return Object.freeze({
  async requestRecovery(email){const address=validateRecoveryEmail(email);try{return await request('/recover',{email:address},null,'recovery_request');}catch(error){if(error.code==='auth_response_invalid')throw new HumanAuthError('recovery_request_unconfirmed');if(error.code==='auth_unavailable')throw new HumanAuthError('recovery_request_unavailable');throw error;}},
  async verifyRecovery(link){return request('/verify',{token_hash:recoveryTokenHash(link,origin),type:'recovery'},null,'recovery');},
  async changeRecoveryPassword(access,userId,password){validateRecoveredPassword(password);if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId))throw new HumanAuthError('session_rejected');return request('/user',{password},access,'recovery_password',userId.toLowerCase());},
  async securityStatus(access,userId){
   if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId))throw new HumanAuthError('session_rejected');
   return request('/user',null,access,'security_read',userId.toLowerCase());
  },
  async enrollAdditionalMfa(access,userId){
   if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId))throw new HumanAuthError('session_rejected');
   const catalog=await request('/user',null,access,'enroll_add_read',userId.toLowerCase());
   if(catalog.pending.length)return Object.freeze({generated:false,factors:catalog.pending});
   const registration=await request('/factors',{factor_type:'totp',friendly_name:'Consulte Help Desk · '+crypto.randomUUID(),issuer:'Consulte Help Desk'},access,'enroll',userId.toLowerCase());
   if(catalog.ids.includes(registration.factors[0].id))throw new HumanAuthError('auth_response_invalid');
   return registration;
  },
  async enrollFirstMfa(access,userId){
   if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId))throw new HumanAuthError('session_rejected');
   const pending=await request('/user',null,access,'enroll_read',userId.toLowerCase());
   if(pending.length)return Object.freeze({generated:false,factors:pending});
   return request('/factors',{factor_type:'totp',friendly_name:'Consulte Help Desk',issuer:'Consulte Help Desk'},access,'enroll',userId.toLowerCase());
  },
  async verifyMfa(access,userId,factorId,code){
   if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId)||typeof factorId!=='string'||!UUID.test(factorId)||typeof code!=='string'||!/^\d{6}$/.test(code))throw new HumanAuthError('invalid_mfa');
   const id=factorId.toLowerCase(),challenge=await request('/factors/'+id+'/challenge',{},access,'challenge');
   return request('/factors/'+id+'/verify',{challenge_id:challenge,code},access,'mfa',userId.toLowerCase());
  },
  async reauthenticate(access){if(!tokenText(access,8192)||!JWT.test(access))throw new HumanAuthError('session_rejected');return request('/reauthenticate',null,access,'reauth');},
  async changePassword(access,userId,current,password,nonce=''){
   validatePasswordChange(current,password,nonce);
   if(!tokenText(access,8192)||!JWT.test(access)||typeof userId!=='string'||!UUID.test(userId))throw new HumanAuthError('session_rejected');
   return request('/user',{current_password:current,password,...(nonce?{nonce}:{})},access,'password',userId.toLowerCase());
  },
  async workspaces(access){
   if(!tokenText(access,8192)||!JWT.test(access))throw new HumanAuthError('session_rejected');
   const controller=new AbortController();let timer;
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new HumanAuthError('auth_unavailable'));},timeoutMs);});
   try{return await Promise.race([deadline,(async()=>{
    const response=await fetcher('/v1/workspaces',{headers:{authorization:'Bearer '+access},signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if(response.status===401)throw new HumanAuthError('session_rejected');
    if(response.status===429)throw new HumanAuthError('auth_rate_limited');
    if(response.status!==200||response.redirected)throw new HumanAuthError('auth_unavailable');
    const data=await jsonBody(response,controller.signal),seen=new Set();
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==1||!Array.isArray(data.items)||data.items.length>50)throw new HumanAuthError('auth_response_invalid');
    return data.items.map(item=>{
     if(!item||typeof item!=='object'||Object.keys(item).length!==2||!UUID.test(item.id??'')||!validText(item.name)||!item.name.trim()||item.name.length>160||/[\u0000-\u001f\u007f]/.test(item.name))throw new HumanAuthError('auth_response_invalid');
     const id=item.id.toLowerCase();if(seen.has(id))throw new HumanAuthError('auth_response_invalid');seen.add(id);return Object.freeze({id,name:item.name});
    });
   })()]);}catch(error){throw error instanceof HumanAuthError?error:new HumanAuthError('auth_unavailable');}
   finally{clearTimeout(timer);controller.abort();}
  },
  async signIn(email,password){
   if(!validText(email)||email.length>320||!email.trim()||!email.includes('@')||!validText(password)||!password.length||password.length>4096)throw new HumanAuthError('invalid_login');
   return request('/token?grant_type=password',{email:email.trim(),password},null,'login');
  },
  async refresh(token){if(!tokenText(token,4096))throw new HumanAuthError('session_rejected');return request('/token?grant_type=refresh_token',{refresh_token:token},null,'refresh');},
  async signOut(token,scope='local'){if(!['local','global'].includes(scope))throw new HumanAuthError('invalid_logout_scope');if(!tokenText(token,8192)||!JWT.test(token))throw new HumanAuthError('auth_logout_unconfirmed');await request('/logout?scope='+scope,null,token,'logout');}
 });
}
