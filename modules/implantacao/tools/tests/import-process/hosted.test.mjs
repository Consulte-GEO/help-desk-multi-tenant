import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedImportProcess,readHostedConfiguration} from '../../../modules/import-process/hosted.ts';
import {id,scope} from './fixtures.mjs';

const env={IMPORT_PROCESS_ENABLED:'true',IMPORT_PROCESS_ORIGIN:'https://setupobras.netlify.app',IMPORT_PROCESS_SUPABASE_URL:'https://yglcnirbnbwjqpvalqif.supabase.co',IMPORT_PROCESS_PUBLISHABLE_KEY:'sb_publishable_example',IMPORT_PROCESS_DATABASE_URL:'postgresql://setup_import_app:secret@db.yglcnirbnbwjqpvalqif.supabase.co:5432/postgres',IMPORT_PROCESS_DATABASE_CA:'-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----'};
const grant={workspace_id:scope.workspaceId,account_id:scope.accountId,requester_id:id(4),actor_id:id(4),work_ref:null,role:'requester',access_version:1,expires_at:null};
function fixture({grants=[grant],user={id:id(4),app_metadata:{}},authStatus=200}={}){
 const queries=[];
 const pool={async connect(){return {release(){},async query(sql,args=[]){queries.push({sql,args});
  if(sql.includes('pg_catalog.pg_roles'))return {rows:[{name:'setup_import_app',superuser:false,bypass:false}],rowCount:1};
  if(sql.includes('FROM setup_import.access_grants'))return {rows:grants,rowCount:grants.length};
  if(sql.includes('INSERT INTO setup_import.admission'))return {rows:[{admitted:true}],rowCount:1};
  return {rows:[],rowCount:0};
 }}}};
 const requests=[];
 const host=createHostedImportProcess({configuration:readHostedConfiguration(k=>env[k]),pool,inspector:{inspect:async()=>{throw Error('SCANNER_UNAVAILABLE')}},fetch:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(user),{status:authStatus})}});
 return {host,queries,requests};
}
const request=(path='/session',token='jwt.example.signature')=>new Request('https://setupobras.netlify.app/v1/import-processes'+path,{headers:{authorization:`Bearer ${token}`}});
test('production configuration fails closed without restricted TLS and explicit gate',()=>{
 assert.equal(readHostedConfiguration(k=>({...env,IMPORT_PROCESS_DATABASE_CA:''})[k]).databaseCa,'');
 assert.throws(()=>readHostedConfiguration(k=>({...env,IMPORT_PROCESS_DATABASE_CA:'invalid'})[k]),/DATABASE_CA_REQUIRED/);
 for(const url of ['postgresql://postgres:secret@db.yglcnirbnbwjqpvalqif.supabase.co/postgres','postgresql://setup_import_app:secret@evil.example/postgres','postgresql://setup_import_app:secret@db.yglcnirbnbwjqpvalqif.supabase.co/postgres?sslmode=no-verify'])assert.throws(()=>readHostedConfiguration(k=>({...env,IMPORT_PROCESS_DATABASE_URL:url})[k]),/INVALID_DATABASE_URL/);
 assert.equal(readHostedConfiguration(k=>({...env,IMPORT_PROCESS_ENABLED:'false'})[k]).enabled,false);
});
test('session derives scopes only from stored actor grants and validates token at Auth server',async()=>{
 const x=fixture();const response=await x.host(request());assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.actorId,id(4));assert.deepEqual(body.scopes,[{workspaceId:scope.workspaceId,accountId:scope.accountId,requesterId:id(4),workRef:null,role:'requester'}]);assert.equal(JSON.stringify(body).includes('signature'),false);
 assert.equal(x.requests[0].url,env.IMPORT_PROCESS_SUPABASE_URL+'/auth/v1/user');assert.equal(x.requests[0].options.headers.authorization,'Bearer jwt.example.signature');
 assert(x.queries.some(q=>q.sql.includes("set_config('setup_import.actor_id'")));
});
test('authenticated account without a provisioned binding receives no scopes',async()=>{const x=fixture({grants:[]});const r=await x.host(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).scopes,[])});
test('case directory is bounded and empty without authorized grants',async()=>{const x=fixture({grants:[]});const r=await x.host(request(''));assert.equal(r.status,200);assert.deepEqual(await r.json(),{cases:[],more:false})});
test('expired/invalid Supabase token never reaches database',async()=>{const x=fixture({authStatus:401,user:{message:'expired'}});const r=await x.host(request());assert.equal(r.status,401);assert.equal(x.queries.length,0)});
test('support grant also requires live administrator metadata',async()=>{const x=fixture({grants:[{...grant,role:'support',requester_id:id(5)}]});const r=await x.host(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).scopes,[])});
test('untrusted client scope cannot create access',async()=>{const x=fixture({grants:[]});const operationId=id(20);const r=await x.host(new Request('https://setupobras.netlify.app/v1/import-processes',{method:'POST',headers:{authorization:'Bearer jwt.example.signature',origin:env.IMPORT_PROCESS_ORIGIN,'content-type':'application/json','idempotency-key':operationId},body:JSON.stringify({operationId,expectedVersion:0,scope,purpose:'new_work',target:{system:'prepared',contractVersion:'1'},snapshot:{schemaVersion:'1',records:[],decisions:[],findings:[],artifactIds:[]},reason:'Test'})}));assert.equal(r.status,403);assert.equal((await r.json()).code,'ACCESS_DENIED');assert.equal(x.queries.some(q=>q.sql.includes('INSERT INTO setup_import.cases')),false)});
test('session enforces same origin, auth syntax and GET',async()=>{for(const [init,status] of [[{headers:{authorization:'invalid'}},401],[{headers:{authorization:'Bearer a',origin:'https://evil.example'}},403],[{method:'POST',headers:{authorization:'Bearer a'}},405]]){const x=fixture();const r=await x.host(new Request('https://setupobras.netlify.app/v1/import-processes/session',init));assert.equal(r.status,status)}});
