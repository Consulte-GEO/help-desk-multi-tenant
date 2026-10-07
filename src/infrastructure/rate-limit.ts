import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import type {SqlPool} from './sql.ts';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';

/** Metadata supplied by the hosting adapter, never copied from HTTP headers. */
export type TrustedRequestContext={clientIp?:string};
export interface RateLimiter{
 beforeAuthentication(req:Request,context:TrustedRequestContext):Promise<void>;
 afterAuthentication(p:Principal):Promise<void>;
}
export class RateLimitError extends HelpdeskError{
 readonly retryAfterSeconds:number;
 constructor(seconds:number){super(429,'rate_limit_exceeded','Limite temporário de requisições atingido. Tente novamente após o intervalo informado.');this.retryAfterSeconds=seconds;}
}
export function normalizeClientIp(ip?:string):string{
 if(!ip||!isIP(ip))throw new HelpdeskError(503,'trusted_client_ip_required','Metadados confiáveis de ingresso indisponíveis.');
 if(isIP(ip)===4)return ip;
 const normalized=new URL(`https://[${ip}]/`).hostname.slice(1,-1);
 // IPv4-mapped IPv6 and its IPv4 representation must not get separate quotas.
 const mapped=/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalized);
 if(mapped){const hi=parseInt(mapped[1]!,16),lo=parseInt(mapped[2]!,16);return `${hi>>>8}.${hi&255}.${lo>>>8}.${lo&255}`;}
 return normalized;
}
export function createPostgresRateLimiter(pool:SqlPool,secret:string):RateLimiter{
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(secret))throw new HelpdeskError(503,'rate_limit_configuration_required','Configure a chave HMAC exclusiva do limitador no servidor.');
 const key=Buffer.from(secret,'base64url');
 const identity=(policy:string,subject:unknown)=>({policy,key:createHmac('sha256',key).update(JSON.stringify(['helpdesk-rate-v1',policy,subject])).digest('hex')});
 async function consume(budgets:{policy:string;key:string}[]):Promise<void>{
  let decision:unknown;
  try{decision=(await pool.query('select helpdesk_auth.consume_rate_limits($1::jsonb) as decision',[JSON.stringify(budgets)])).rows[0]?.decision;}
  catch{throw new HelpdeskError(503,'rate_limit_unavailable','Controle de requisições temporariamente indisponível.');}
  const d=decision as {allowed?:unknown;retry_after?:unknown}|null;
  if(d?.allowed===true&&d.retry_after===0)return;
  if(d?.allowed===false&&Number.isInteger(d.retry_after)&&Number(d.retry_after)>=1&&Number(d.retry_after)<=60)throw new RateLimitError(Number(d.retry_after));
  throw new HelpdeskError(503,'rate_limit_unavailable','Controle de requisições temporariamente indisponível.');
 }
 return {
  async beforeAuthentication(req,context){const ip=normalizeClientIp(context.clientIp);const budgets=[identity('ingress',ip)];
   if(['/v1/integration-tokens','/v1/workspaces'].includes(new URL(req.url).pathname.replace(/\/$/,'')))budgets.push(identity('token_exchange',ip));
   await consume(budgets);
  },
  async afterAuthentication(p){await consume([identity('workspace',p.workspaceId),identity('principal',[p.workspaceId,p.id])]);}
 };
}
