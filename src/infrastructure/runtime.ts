import {createConsulteGeoRuntimeHandlers,validateConsulteGeoRuntimeConfig,type ConsulteGeoSourcePorts} from './consultegeo-runtime.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from './consultegeo-local-source.ts';
import {assertRuntimeDatabase} from './authentication-database.ts';
import {consoleHttpObserver} from '../observability/http.ts';
import {withControlTransactions} from './transaction.ts';
import {createPostgresRateLimiter} from './rate-limit.ts';
import type {SqlPool} from './sql.ts';import {PostgresUnitOfWork,observePoolErrors} from './postgres.ts';import {createAuthentication} from './authentication.ts';import {HelpdeskService} from '../application/helpdesk.ts';import {createHttpHandler} from '../http/handler.ts';
import {validateRuntimeConfig,validateBackendConfig} from './runtime-config.ts';
import type {RuntimeConfig} from './runtime-config.ts';
export {validateRuntimeConfig} from './runtime-config.ts';
export type {RuntimeConfig} from './runtime-config.ts';
export async function createProductionRuntime(input:RuntimeConfig){
 return createRuntime(validateRuntimeConfig(input),false,validateConsulteGeoRuntimeConfig(input));
}
// Authentication keeps the same restricted database and security checks while business remains closed.
export async function createHostedRuntime(input:RuntimeConfig){
 return input.releaseApproved==='true'?createProductionRuntime(input):createRuntime(validateBackendConfig(input),true,validateConsulteGeoRuntimeConfig(input));
}
/** Developer-selected built-in local authority only, on the actual restricted pool. */
export function createConfiguredConsulteGeoSource(mode:'local'|undefined,pool:SqlPool):ConsulteGeoSourcePorts|undefined{
 return mode==='local'?Object.freeze({...createPostgresLocalConsulteGeoSourcePorts(pool),mode:'local' as const}):undefined;
}
async function createRuntime(c:ReturnType<typeof validateBackendConfig>,authenticationOnly:boolean,modules:ReturnType<typeof validateConsulteGeoRuntimeConfig>){
 const driverName='pg';
 // The dynamic boundary permits dependency-free domain tests. Deployment must install and test pg.
 const driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 const pool=withControlTransactions(new driver.Pool({connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'helpdesk-api',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}}));
 observePoolErrors(pool,event=>console.warn(JSON.stringify(event)));
 try{const schema=await assertRuntimeDatabase(pool,{authenticationOnly,...modules});const source=createConfiguredConsulteGeoSource(modules.sourceMode,pool),auth=createAuthentication(pool,c),rateLimiter=createPostgresRateLimiter(pool,c.rateLimitHmacKey);const legacy=createHttpHandler({authenticationOnly,service:new HelpdeskService(new PostgresUnitOfWork(pool)),rateLimiter,...auth,publicConfig:{supabaseUrl:c.supabaseUrl,publishableKey:c.publishableKey},observe:consoleHttpObserver});return createConsulteGeoRuntimeHandlers({pool,authentication:auth,rateLimiter,origin:modules.origin,flags:{business:()=>!authenticationOnly,administration:()=>modules.administration,workflow:()=>modules.workflow,intake:()=>modules.intake,review:()=>schema==='0.25.0'},source,legacy,observe:consoleHttpObserver});}
 catch(error){await pool.end().catch(()=>{});throw error;}
}
