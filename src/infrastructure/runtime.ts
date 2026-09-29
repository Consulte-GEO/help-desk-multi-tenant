import {consoleHttpObserver} from '../observability/http.ts';
import {withControlTransactions} from './transaction.ts';
import {createPostgresRateLimiter} from './rate-limit.ts';
import type {SqlPool} from './sql.ts';import {PostgresUnitOfWork,assertSafeDatabaseRole,assertSchemaCompatibility,assertDatabaseSecurity,observePoolErrors} from './postgres.ts';import {createAuthentication} from './authentication.ts';import {HelpdeskService} from '../application/helpdesk.ts';import {createHttpHandler} from '../http/handler.ts';
import {validateRuntimeConfig} from './runtime-config.ts';
import type {RuntimeConfig} from './runtime-config.ts';
export {validateRuntimeConfig} from './runtime-config.ts';
export type {RuntimeConfig} from './runtime-config.ts';
export async function createProductionRuntime(input:RuntimeConfig){
 const c=validateRuntimeConfig(input);const driverName='pg';
 // The dynamic boundary permits dependency-free domain tests. Deployment must install and test pg.
 const driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 const pool=withControlTransactions(new driver.Pool({connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'helpdesk-api',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}}));
 observePoolErrors(pool,event=>console.warn(JSON.stringify(event)));
 try{await assertSafeDatabaseRole(pool);await assertSchemaCompatibility(pool);await assertDatabaseSecurity(pool);const auth=createAuthentication(pool,c);return createHttpHandler({service:new HelpdeskService(new PostgresUnitOfWork(pool)),rateLimiter:createPostgresRateLimiter(pool,c.rateLimitHmacKey),...auth,publicConfig:{supabaseUrl:c.supabaseUrl,publishableKey:c.publishableKey},observe:consoleHttpObserver});}
 catch(error){await pool.end().catch(()=>{});throw error;}
}
