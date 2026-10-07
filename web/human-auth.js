/** Bounded adapter for Supabase password/refresh/local-logout. Not an authorization engine. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const messages=Object.freeze({
 invalid_auth_config:'Configuração de autenticação indisponível.',
 invalid_login:'Informe e-mail, senha e um workspace válido.',
 invalid_logout_scope:'Tipo de encerramento de sessão inválido.',
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
 constructor(code){super(messages[code]??messages.auth_unavailable);this.name='HumanAuthError';this.code=Object.hasOwn(messages,code)?code:'auth_unavailable';this.status=this.code==='membership_required'?403:['session_rejected','login_failed'].includes(this.code)?401:this.code.startsWith('invalid_')?400:this.code==='login_in_progress'?409:503;}
}
export function workspaceId(value){if(typeof value!=='string'||!UUID.test(value))throw new HumanAuthError('invalid_login');return value.toLowerCase();}
const tokenText=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&/^[A-Za-z0-9._~-]+$/.test(value);
const validText=value=>typeof value==='string'&&value.isWellFormed()&&!value.includes('\0');
function sessionFrom(value,started,now){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.token_type?.toLowerCase?.()!=='bearer'
 ||!tokenText(value.access_token,8192)||!JWT.test(value.access_token)||!tokenText(value.refresh_token,4096)
 ||!Number.isInteger(value.expires_in)||value.expires_in<1||value.expires_in>86400
 ||!value.user||typeof value.user!=='object'||!UUID.test(value.user.id??''))throw new HumanAuthError('auth_response_invalid');
 let expiresAt=started+value.expires_in*1000;
 if(value.expires_at!==undefined){if(!Number.isSafeInteger(value.expires_at)||value.expires_at<=0)throw new HumanAuthError('auth_response_invalid');expiresAt=Math.min(expiresAt,value.expires_at*1000);}
 if(expiresAt<=now+1000)throw new HumanAuthError('auth_response_invalid');
 // JWT shape is checked only for transport hygiene. Backend validates identity and live grants.
 return Object.freeze({accessToken:value.access_token,refreshToken:value.refresh_token,expiresAt,userId:value.user.id.toLowerCase()});
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
 async function request(path,body,access,operation){
  const started=now(),controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new HumanAuthError('auth_unavailable'));},timeoutMs);});
  try{return await Promise.race([deadline,(async()=>{
   const headers={apikey:key,...(body?{'content-type':'application/json'}:{}),...(access?{authorization:'Bearer '+access}:{})};
   const response=await fetcher(origin+'/auth/v1'+path,{method:'POST',headers,...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
   if(response.redirected)throw new HumanAuthError('auth_response_invalid');
   if(operation==='logout'){if(response.status!==204)throw new HumanAuthError('auth_logout_unconfirmed');return;}
   if(response.status===429)throw new HumanAuthError('auth_rate_limited');
   if([400,401,403].includes(response.status))throw new HumanAuthError(operation==='login'?'login_failed':'session_rejected');
   if(response.status!==200)throw new HumanAuthError('auth_unavailable');
   return sessionFrom(await jsonBody(response,controller.signal),started,now());
  })()]);}
  catch(error){if(error instanceof HumanAuthError)throw error;throw new HumanAuthError('auth_unavailable');}
  finally{clearTimeout(timer);controller.abort();}
 }
 return Object.freeze({
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
