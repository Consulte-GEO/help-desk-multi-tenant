import {createProductionRuntime} from '../../src/infrastructure/runtime.ts';
import {createHostedHandler} from '../../src/infrastructure/hosted-handler.ts';
import {consoleHttpObserver} from '../../src/observability/http.ts';
// Only the lazy handler is allocated here. No environment read, driver import or connection on module load.
declare const Netlify:{env:{get(name:string):string|undefined}};
const hosted=createHostedHandler(()=>createProductionRuntime({
 databaseUrl:Netlify.env.get('HELPDESK_DATABASE_URL'),supabaseUrl:Netlify.env.get('SUPABASE_URL'),
 publishableKey:Netlify.env.get('SUPABASE_PUBLISHABLE_KEY'),databaseCa:Netlify.env.get('HELPDESK_DATABASE_CA'),
 releaseApproved:Netlify.env.get('HELPDESK_RELEASE_APPROVED'),rateLimitHmacKey:Netlify.env.get('HELPDESK_RATE_LIMIT_HMAC_KEY')
}),consoleHttpObserver);
export default function handler(request:Request,context:{ip?:string}={}):Promise<Response>{
 return hosted(request,{clientIp:context.ip});
}
export const config={path:'/v1/*'};
