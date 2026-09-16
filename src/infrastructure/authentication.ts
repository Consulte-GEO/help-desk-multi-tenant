import {validatePrincipal} from './principal-validation.ts';
import {randomBytes} from 'node:crypto';import type {SqlPool} from './sql.ts';import type {Principal} from '../domain/model.ts';import {HelpdeskError} from '../domain/errors.ts';import {secretHash} from '../domain/canonical.ts';import {identifier} from '../http/validation.ts';
export function createAuthentication(pool:SqlPool,config:{supabaseUrl:string;publishableKey:string},fetcher:typeof fetch=fetch){
 async function authenticate(request:Request):Promise<Principal>{
  const match=/^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('authorization')??'');if(!match)throw new HelpdeskError(401,'unauthorized','Autenticação necessária.');
  const w=request.headers.get('x-workspace-id');if(!w)throw new HelpdeskError(400,'workspace_required','Informe X-Workspace-Id.');const workspace=identifier(w);const token=match[1]!;let value:unknown;
  if(token.startsWith('hd_key_'))throw new HelpdeskError(401,'session_required','Troque a credencial por uma sessão curta.');
  if(token.startsWith('hd_session_')){if(!/^hd_session_[A-Za-z0-9_-]{43}$/.test(token))throw new HelpdeskError(401,'unauthorized','Sessão inválida.');value=(await pool.query('select helpdesk_auth.resolve_session($1,$2) as principal',[secretHash(token),workspace])).rows[0]?.principal;}
  else{
   let result:Response;try{result=await fetcher(`${config.supabaseUrl}/auth/v1/user`,{headers:{authorization:`Bearer ${token}`,apikey:config.publishableKey},signal:AbortSignal.timeout(5000),redirect:'error'});}catch{throw new HelpdeskError(503,'auth_unavailable','Validação de identidade temporariamente indisponível.');}
   if(result.status>=500||result.status===429)throw new HelpdeskError(503,'auth_unavailable','Validação de identidade temporariamente indisponível.');
   if(!result.ok)throw new HelpdeskError(401,'unauthorized','Sessão inválida ou expirada.');
   let userId:string;
   try{const user:unknown=await result.json();if(!user||typeof user!=='object'||Array.isArray(user))throw Error();userId=identifier((user as {id:unknown}).id);}
   catch{throw new HelpdeskError(503,'auth_unavailable','Resposta inválida do serviço de identidade. Acesso não concedido.');}
   value=(await pool.query('select helpdesk_auth.resolve_human($1,$2) as principal',[userId,workspace])).rows[0]?.principal;
  }
  if(!value||typeof value!=='object')throw new HelpdeskError(403,'membership_required','Acesso não autorizado ao workspace.');
  return validatePrincipal(value,workspace,token.startsWith('hd_session_')?'integration':'human');
 }
 async function exchangeToken(key:string){
  if(!/^hd_key_[A-Za-z0-9_-]{43,128}$/.test(key))throw new HelpdeskError(401,'unauthorized','Credencial inválida.');
  const token='hd_session_'+randomBytes(32).toString('base64url');const row=(await pool.query('select helpdesk_auth.exchange_key($1,$2) as result',[secretHash(key),secretHash(token)])).rows[0]?.result as {workspaceId:string;expiresAt:string}|null;
  if(!row)throw new HelpdeskError(401,'unauthorized','Credencial inválida ou revogada.');
  return {access_token:token,token_type:'Bearer',expires_at:row.expiresAt,workspace_id:row.workspaceId};
 }
 return {authenticate,exchangeToken};
}
