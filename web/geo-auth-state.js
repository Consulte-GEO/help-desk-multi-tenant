/** Memory-only adapter for hd_person sessions. No storage, clipboard, cookie token,
 * URL credential or automatic mutation retry. The host must mount the portal in
 * this same document; navigating to a new page intentionally loses credentials. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function instant(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(v))return false;const ms=v.slice(0,23)+'Z';return Number.isFinite(Date.parse(ms))&&new Date(ms).toISOString()===ms;}
function session(v){
 const keys=['principal_id','workspace_id','access_token','refresh_token','expires_at','absolute_expires_at','return_path'];
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||!uuid.test(v.principal_id)||!uuid.test(v.workspace_id)||!/^hd_person_[A-Za-z0-9_-]{43}$/.test(v.access_token)||!/^hd_person_refresh_[A-Za-z0-9_-]{43}$/.test(v.refresh_token)||!instant(v.expires_at)||!instant(v.absolute_expires_at)||typeof v.return_path!=='string'||!/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(v.return_path))throw Error('Invalid session response');
 return {...v};
}
export function captureGeoCallback(location,history){
 let url;try{url=new URL(String(location.href??location));history.replaceState(null,'',url.pathname);}catch{return null;}
 // Always clean BEFORE validation or network; neither description nor provider
 // errors are reflected into the document, analytics, or a retry URL.
 if(url.pathname!=='/auth/geo/callback'||url.hash||[...url.searchParams.keys()].some(k=>!['code','state','iss'].includes(k)||url.searchParams.getAll(k).length!==1))return null;
 const code=url.searchParams.get('code'),state=url.searchParams.get('state'),iss=url.searchParams.get('iss');
 if(!code||code.length>4096||!state||!/^[A-Za-z0-9_-]{43}$/.test(state)||!iss||iss.length>2048)return null;
 return Object.freeze({code,state,iss});
}
export function createGeoAuthController(o){
 if(typeof o.request!=='function')throw Error('A same-origin request adapter is required');
 let stored=null,generation=0,busy=false,attempted=false,destroyed=false,active=null,refreshing=null;
 let message='Confirme a entrada para continuar.';
 const view=()=>({authenticated:stored!==null,busy,message,audience:stored?{principalId:stored.principal_id,workspaceId:stored.workspace_id}:null});
 const emit=()=>{if(!destroyed)try{o.onState?.(view());}catch{/* presentation never submits */}};
 const clear=()=>{stored=null;};
 const adopt=(r,prior)=>{const parsed=session(r);if(prior&&(parsed.principal_id!==prior.principal_id||parsed.workspace_id!==prior.workspace_id))throw Error('Audience changed');stored=parsed;try{o.onSession?.(Object.freeze({...parsed}));}catch{clear();throw Error('Portal mount failed');}};
 async function complete(callback,workspaceId){
  if(attempted||busy||destroyed)return false;attempted=true;const token=++generation;active=new AbortController();busy=true;message='Validando a entrada…';emit();
  try{if(!callback||typeof callback.code!=='string'||typeof callback.state!=='string'||typeof callback.iss!=='string'||workspaceId!==undefined&&!uuid.test(workspaceId))throw Error();
   const body=JSON.stringify({code:callback.code,state:callback.state,iss:callback.iss,...(workspaceId?{workspace_id:workspaceId}:{})});
   const r=await o.request('/v1/auth/geo/complete',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body,signal:active.signal});if(token!==generation||destroyed)return false;if(!r.ok)throw Error();const data=await r.json();if(token!==generation||destroyed)return false;adopt(data,null);message='Identidade confirmada. Acesso sujeito às permissões atuais.';return true;
  }catch{if(token===generation&&!destroyed){clear();message='Entrada não confirmada. Inicie um novo fluxo; o código não será repetido.';}return false;}
  finally{if(token===generation&&!destroyed){busy=false;active=null;emit();}}
 }
 function refresh(){
  if(refreshing)return refreshing;if(!stored||busy||destroyed)return Promise.resolve(false);
  const prior={...stored},token=generation;active=new AbortController();busy=true;message='Renovando sessão…';emit();
  refreshing=(async()=>{try{
   const r=await o.request('/v1/auth/geo/refresh',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({refresh_token:prior.refresh_token}),signal:active.signal});if(token!==generation||destroyed)return false;if(!r.ok)throw Error();const data=await r.json();if(token!==generation||destroyed)return false;adopt(data,prior);message='Sessão renovada.';return true;
  }catch{if(token===generation&&!destroyed){clear();message='Renovação não confirmada. Entre novamente; o token não será reutilizado.';}return false;}
  finally{if(token===generation&&!destroyed){busy=false;active=null;emit();}refreshing=null;}})();return refreshing;
 }
 async function logout(){
  const old=stored?.access_token;generation++;active?.abort();active=null;refreshing=null;clear();busy=false;message='Sessão local encerrada.';emit();
  if(!old)return true;try{const r=await o.request('/v1/auth/geo/logout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',authorization:'Bearer '+old},body:'{}'});return r.ok;}catch{return false;}
 }
 function destroy(){generation++;active?.abort();active=null;refreshing=null;clear();busy=false;destroyed=true;}
 return Object.freeze({view,complete,refresh,logout,destroy,accessToken:()=>stored?.access_token??null});
}
