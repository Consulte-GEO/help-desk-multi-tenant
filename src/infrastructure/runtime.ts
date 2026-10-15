import {createHash} from 'node:crypto';
import {createConsulteGeoRuntimeHandlers,validateConsulteGeoRuntimeConfig,type ConsulteGeoSourcePorts} from './consultegeo-runtime.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from './consultegeo-local-source.ts';
import {assertRuntimeDatabase} from './authentication-database.ts';
import {consoleHttpObserver} from '../observability/http.ts';
import {withControlTransactions} from './transaction.ts';
import {createPostgresRateLimiter} from './rate-limit.ts';
import type {SqlPool} from './sql.ts';import {PostgresUnitOfWork,observePoolErrors} from './postgres.ts';import {createAuthentication} from './authentication.ts';import {HelpdeskService} from '../application/helpdesk.ts';import {createHttpHandler} from '../http/handler.ts';
import {validateRuntimeConfig,validateBackendConfig} from './runtime-config.ts';
import {createImplementationSupportHandler} from '../http/implementation-support.ts';
import {createPostgresImplementationSupportStore} from './implementation-support.ts';
import {createImplementationSupportAi} from './implementation-support-ai.ts';
import type {RuntimeConfig} from './runtime-config.ts';
export {validateRuntimeConfig} from './runtime-config.ts';
export type {RuntimeConfig} from './runtime-config.ts';
export async function createProductionRuntime(input:RuntimeConfig){
 return createRuntime(validateRuntimeConfig(input),false,validateConsulteGeoRuntimeConfig(input),input.registrationReview==='true');
}
// Authentication keeps the same restricted database and security checks while business remains closed.
export async function createHostedRuntime(input:RuntimeConfig){
 return input.releaseApproved==='true'?createProductionRuntime(input):createRuntime(validateBackendConfig(input),true,validateConsulteGeoRuntimeConfig(input),false);
}
/** Developer-selected built-in local authority only, on the actual restricted pool. */
export function createConfiguredConsulteGeoSource(mode:'local'|undefined,pool:SqlPool):ConsulteGeoSourcePorts|undefined{
 return mode==='local'?Object.freeze({...createPostgresLocalConsulteGeoSourcePorts(pool),mode:'local' as const}):undefined;
}
async function createRuntime(c:ReturnType<typeof validateBackendConfig>,authenticationOnly:boolean,modules:ReturnType<typeof validateConsulteGeoRuntimeConfig>,registrationReview:boolean){
 const driverName='pg';
 // The dynamic boundary permits dependency-free domain tests. Deployment must install and test pg.
 const driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 const pool=withControlTransactions(new driver.Pool({connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'helpdesk-api',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}}));
 observePoolErrors(pool,event=>console.warn(JSON.stringify(event)));
 try{const schema=await assertRuntimeDatabase(pool,{authenticationOnly,...modules});const source=createConfiguredConsulteGeoSource(modules.sourceMode,pool),auth=createAuthentication(pool,c),rateLimiter=createPostgresRateLimiter(pool,c.rateLimitHmacKey);const legacy=createHttpHandler({authenticationOnly,service:new HelpdeskService(new PostgresUnitOfWork(pool)),rateLimiter,...auth,publicConfig:{supabaseUrl:c.supabaseUrl,publishableKey:c.publishableKey},observe:consoleHttpObserver});const original=createConsulteGeoRuntimeHandlers({pool,authentication:auth,rateLimiter,origin:modules.origin,emailCursorKey:createHash('sha256').update('helpdesk-email-monitor-cursor-v2\0'+c.rateLimitHmacKey).digest(),flags:{business:()=>!authenticationOnly,administration:()=>modules.administration,workflow:()=>modules.workflow,intake:()=>modules.intake,review:()=>schema==='0.25.0'||schema==='0.26.0'||schema==='0.27.0',emailMonitoring:()=>schema==='0.27.0',registrationReview:()=>(schema==='0.26.0'||schema==='0.27.0')&&registrationReview},source,legacy,observe:consoleHttpObserver});
 const implantation=modules.origin?createImplementationSupportHandler({origin:modules.origin,authenticate:auth.authenticate,afterAuthentication:p=>rateLimiter.afterAuthentication(p),store:createPostgresImplementationSupportStore(pool),ai:createImplementationSupportAi(),enabled:()=>!authenticationOnly&&schema==='0.27.0'}):undefined;
 return async(req:Request,context?:{clientIp?:string})=>{const path=new URL(req.url).pathname;if(path==='/v1/implementation-support'||path.startsWith('/v1/implementation-support/')){if(!implantation)return Response.json({code:'implementation_support_unavailable'},{status:503,headers:{'cache-control':'no-store'}});try{await rateLimiter.beforeAuthentication(req,context??{});return await implantation(req);}catch{return Response.json({code:'implementation_support_unavailable'},{status:503,headers:{'cache-control':'no-store'}});}}return original(req,context??{});};}
 catch(error){await pool.end().catch(()=>{});throw error;}
}
