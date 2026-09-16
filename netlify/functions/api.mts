import {randomUUID} from 'node:crypto';
import {createProductionRuntime} from '../../src/infrastructure/runtime.ts';
import {problemResponse} from '../../src/http/handler.ts';
import {HelpdeskError} from '../../src/domain/errors.ts';
// Minimal ambient host boundary; no keys or initialization side effects at module load.
declare const Netlify:{env:{get(name:string):string|undefined}};
let runtime:ReturnType<typeof createProductionRuntime>|undefined;
function getRuntime(){
 if(!runtime)runtime=createProductionRuntime({databaseUrl:Netlify.env.get('HELPDESK_DATABASE_URL'),supabaseUrl:Netlify.env.get('SUPABASE_URL'),publishableKey:Netlify.env.get('SUPABASE_PUBLISHABLE_KEY'),databaseCa:Netlify.env.get('HELPDESK_DATABASE_CA'),releaseApproved:Netlify.env.get('HELPDESK_RELEASE_APPROVED'),rateLimitHmacKey:Netlify.env.get('HELPDESK_RATE_LIMIT_HMAC_KEY')}).catch(error=>{runtime=undefined;throw error;});
 return runtime;
}
export default async function handler(request:Request,context:{ip?:string}={}):Promise<Response>{
 try{return await(await getRuntime())(request,{clientIp:context.ip});}catch(error){return problemResponse(error instanceof HelpdeskError?error:new HelpdeskError(503,'backend_unavailable','Backend ainda indisponível. Nenhum dado de demonstração foi carregado.'),randomUUID());}
}
export const config={path:'/v1/*'};
