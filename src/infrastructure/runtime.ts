import type {SqlPool} from './sql.ts';import {PostgresUnitOfWork,assertSafeDatabaseRole} from './postgres.ts';import {createAuthentication} from './authentication.ts';import {HelpdeskService} from '../application/helpdesk.ts';import {createHttpHandler} from '../http/handler.ts';import {HelpdeskError} from '../domain/errors.ts';
export type RuntimeConfig={databaseUrl?:string;supabaseUrl?:string;publishableKey?:string;databaseCa?:string;releaseApproved?:string};
export function validateRuntimeConfig(c:RuntimeConfig):{databaseUrl:string;supabaseUrl:string;publishableKey:string;databaseCa?:string}{
 if(c.releaseApproved!=='true')throw new HelpdeskError(503,'release_gate_closed','Ambiente ainda não liberado para atendimento.');
 if(!c.databaseUrl||!c.supabaseUrl||!c.publishableKey)throw new HelpdeskError(503,'configuration_required','Configuração do backend incompleta.');
 let db:URL,supabase:URL;try{db=new URL(c.databaseUrl);supabase=new URL(c.supabaseUrl);}catch{throw new HelpdeskError(503,'invalid_configuration','Configuração do backend inválida.');}
 if(!['postgres:','postgresql:'].includes(db.protocol)||decodeURIComponent(db.username).split('.')[0]!=='helpdesk_app'||!db.password)throw new HelpdeskError(503,'unsafe_database_configuration','Configure o login PostgreSQL restrito do Help Desk.');
 // PostgreSQL/Supavisor usernames may contain the project suffix; current_user is verified separately.
 if(['sslmode','sslcert','sslkey','sslrootcert'].some(key=>db.searchParams.has(key)))throw new HelpdeskError(503,'unsafe_tls_configuration','Configure TLS pelo backend, sem parâmetros SSL na URL.');
 if(supabase.protocol!=='https:'||supabase.username||supabase.password||supabase.search||supabase.hash||!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(c.supabaseUrl)||!c.publishableKey.startsWith('sb_publishable_'))throw new HelpdeskError(503,'invalid_auth_configuration','Configure a URL oficial e uma chave publicável do projeto.');
 return {databaseUrl:c.databaseUrl,supabaseUrl:supabase.origin,publishableKey:c.publishableKey,...(c.databaseCa?{databaseCa:c.databaseCa}:{})};
}
export async function createProductionRuntime(input:RuntimeConfig){
 const c=validateRuntimeConfig(input);const driverName='pg';
 // The dynamic boundary permits dependency-free domain tests. Deployment must install and test pg.
 const driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 const pool=new driver.Pool({connectionString:c.databaseUrl,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'helpdesk-api',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}});
 try{await assertSafeDatabaseRole(pool);const auth=createAuthentication(pool,c);return createHttpHandler({service:new HelpdeskService(new PostgresUnitOfWork(pool)),...auth,publicConfig:{supabaseUrl:c.supabaseUrl,publishableKey:c.publishableKey},observe:event=>console.info(JSON.stringify({component:'helpdesk.http',...event}))});}
 catch(error){await pool.end().catch(()=>{});throw error;}
}
