import pg from 'pg';
import {createHostedImportProcess,readHostedConfiguration} from '../../../modules/import-process/hosted.ts';
import {createSupabaseArtifactStorage,createSupabaseInspectorTokenProvider,createArtifactInspector,createHttpContentScanner} from '../../../modules/import-process/storage.ts';

declare const Netlify:{env:{get(key:string):string|undefined}};
let runtime:ReturnType<typeof createHostedImportProcess>|undefined;
/** One small restricted pool per warm instance. Never use postgres/service_role. */
function getRuntime(){
 if(runtime)return runtime;
 const get=(key:string)=>Netlify.env.get(key),configuration=readHostedConfiguration(get);
 const databaseOptions={connectionString:configuration.databaseUrl,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,
  ssl:{rejectUnauthorized:true,...(configuration.databaseCa?{ca:configuration.databaseCa}:{})}};
 // Authority confirmation must never wait for a connection held by its own write.
 const pool=new pg.Pool({...databaseOptions,max:2}),authorityPool=new pg.Pool({...databaseOptions,max:1});
 pool.on('error',()=>{/* Idle connection failures are retried on the next request; never log credentials. */});
 authorityPool.on('error',()=>{});
 // Missing inspector credentials close inspection only; session/case operations
 // still run. Never accept the old static JWT or a runtime administrative key.
 const inspectorEmail=get('IMPORT_PROCESS_STORAGE_INSPECTOR_EMAIL'),inspectorPassword=get('IMPORT_PROCESS_STORAGE_INSPECTOR_PASSWORD'),inspectorUserId=get('IMPORT_PROCESS_STORAGE_INSPECTOR_USER_ID');
 const inspectorTokens=inspectorEmail&&inspectorPassword&&inspectorUserId?createSupabaseInspectorTokenProvider({
  supabaseUrl:configuration.supabaseUrl,publishableKey:configuration.publishableKey,email:inspectorEmail,password:inspectorPassword,userId:inspectorUserId}):undefined;
 const storage=createSupabaseArtifactStorage({supabaseUrl:configuration.supabaseUrl,publishableKey:configuration.publishableKey,
  accessToken:()=>{if(!inspectorTokens)throw Error('INSPECTOR_AUTH_UNAVAILABLE');return inspectorTokens.accessToken();}});
 const scannerUrl=get('IMPORT_PROCESS_SCANNER_URL'),scannerToken=get('IMPORT_PROCESS_SCANNER_TOKEN');
 const scanner=scannerUrl&&scannerToken?createHttpContentScanner({url:scannerUrl,token:scannerToken}):undefined;
 runtime=createHostedImportProcess({configuration,pool,authorityPool,inspector:createArtifactInspector({storage,scanner}),
  signUpload:(artifact,token,signal)=>createSupabaseArtifactStorage({supabaseUrl:configuration.supabaseUrl,publishableKey:configuration.publishableKey,accessToken:()=>token}).createSignedUpload(artifact,signal)});
 return runtime;
}
export default async function handler(request:Request){
 // A deploy with absent credentials still serves a closed module safely.
 if(Netlify.env.get('IMPORT_PROCESS_ENABLED')!=='true')return Response.json({code:'PROCESS_GATE_CLOSED'},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 try{return await getRuntime()(request);}catch{return Response.json({code:'PROCESS_CONFIGURATION_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
}
export const config={path:['/v1/import-processes','/v1/import-processes/*'],rateLimit:{action:'rate_limit',aggregateBy:'ip',windowLimit:180,windowSize:60}};
