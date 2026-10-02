import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import {problemResponse} from '../src/http/handler.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

// Synthetic identities; only the loopback tests below use native fetch and TCP.
const workspace='00000000-0000-4000-8000-000000000001';
const authId='00000000-0000-4000-8000-000000000002';
const principalId='00000000-0000-4000-8000-000000000003';
const config={supabaseUrl:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
const request=()=>new Request('https://helpdesk.invalid/v1/me',{headers:{authorization:'Bearer synthetic-human-session','x-workspace-id':workspace}});
const expected=(status:number)=>status===429||status>=500?{status:503,code:'auth_unavailable'}:{status:401,code:'unauthorized'};
function setup(fetcher:typeof fetch){
 const queries:{sql:string;values:unknown[]|undefined}[]=[];
 const principal={id:principalId,kind:'human',workspaceId:workspace,workspaceRole:null,grants:[],scopes:[]};
 const pool:SqlPool={
  connect:async()=>{throw Error('No connection should be acquired by this fixture.');},
  query:async(sql,values)=>{queries.push({sql,values});return {rows:[{principal}],rowCount:1};},
  end:async()=>{}
 };
 return {...createAuthentication(pool,config,fetcher),queries,principal};
}
for(const status of [400,401,403,429,500,503])test(`R14 identity status ${status} cancels its unread body once and keeps denial`,async()=>{
 let cancelled=0,pulls=0,sent=0;
 const response=new Response(new ReadableStream<Uint8Array>({pull(){pulls++;},cancel(){cancelled++;}},{highWaterMark:0}),{status});
 const f=setup(async()=>{sent++;return response;});
 await assert.rejects(()=>f.authenticate(request()),expected(status));
 assert.equal(cancelled,1);assert.equal(pulls,0);assert.equal(sent,1);assert.equal(f.queries.length,0);
});
for(const mode of ['throw','reject','pending'] as const)test(`R14 ${mode} cancellation cannot change, leak or postpone the authentication denial`,async()=>{
 let calls=0;
 const response=new Response('UNTRUSTED PROVIDER BODY',{status:503});
 Object.defineProperty(response.body!,'cancel',{value:()=>{
  calls++;
  if(mode==='throw')throw Error('PRIVATE_SYNTHETIC_PROVIDER_DETAIL');
  if(mode==='reject')return Promise.reject(Error('PRIVATE_SYNTHETIC_PROVIDER_DETAIL'));
  return new Promise<void>(()=>{});
 }});
 const f=setup(async()=>response);
 // Deterministic turn boundary: cleanup must not become part of authentication latency.
 const result=await Promise.race([
  f.authenticate(request()).then(()=>({kind:'allowed' as const}),error=>({kind:'denied' as const,error})),
  nextTurn().then(()=>({kind:'pending' as const}))
 ]);
 assert.equal(result.kind,'denied');
 if(result.kind!=='denied')return;
 const problem=await problemResponse(result.error,'synthetic-correlation').json();
 assert.equal(problem.status,503);assert.equal(problem.code,'auth_unavailable');
 assert.ok(!JSON.stringify(problem).includes('PRIVATE_SYNTHETIC_PROVIDER_DETAIL'));
 assert.equal(calls,1);assert.equal(f.queries.length,0);
 await nextTurn(); // An unhandled rejection fails the Node test runner.
});
test('R14 denied responses with no body preserve the same errors and do not query SQL',async()=>{
 for(const status of [401,503]){
  const f=setup(async()=>new Response(null,{status}));
  await assert.rejects(()=>f.authenticate(request()),expected(status));assert.equal(f.queries.length,0);
 }
});
test('R14 valid identity is fully read and uses the private authorization helper, not metadata',async()=>{
 let cancelled=0;
 const response=new Response(new ReadableStream<Uint8Array>({start(controller){
  controller.enqueue(new TextEncoder().encode(JSON.stringify({id:authId,user_metadata:{role:'admin'}})));controller.close();
 },cancel(){cancelled++;}}),{status:200});
 const f=setup(async()=>response);
 assert.deepEqual(await f.authenticate(request()),f.principal);
 assert.equal(cancelled,0);assert.equal(response.bodyUsed,true);assert.equal(f.queries.length,1);
 assert.equal(f.queries[0]!.sql,'select helpdesk_auth.resolve_human($1,$2) as principal');
 assert.deepEqual(f.queries[0]!.values,[authId,workspace]);
});
for(const status of [401,429,503])test(`R14 native fetch closes unfinished HTTP ${status} body without waiting for provider completion`,async()=>{
 let calls=0,closed=false,notifyClose:()=>void=()=>{};
 const responseClosed=new Promise<void>(resolve=>{notifyClose=resolve;});
 const server=createServer((_req,res)=>{
  calls++;res.writeHead(status,{'content-type':'application/json'});
  res.on('error',()=>{});
  res.once('close',()=>{closed=true;notifyClose();});
  res.write('{"synthetic":"unfinished'); // Deliberately no end(), interval or provider timeout.
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const origin=`http://127.0.0.1:${address.port}`;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const f=setup(async(url,options)=>{
  assert.equal(url,config.supabaseUrl+'/auth/v1/user');
  assert.equal(options?.redirect,'error');assert.ok(options?.signal);
  return fetch(origin+'/auth/v1/user',options);
 });
 try{
  await assert.rejects(()=>f.authenticate(request()),expected(status));
  await Promise.race([responseClosed,new Promise<void>(resolve=>{timer=setTimeout(resolve,1000);})]);
  assert.equal(closed,true,'Rejected response remained open after authentication returned.');
  assert.equal(calls,1);assert.equal(f.queries.length,0);
 }finally{
  clearTimeout(timer);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});
