/** Synthetic Auth/SQL resolution over real loopback HTTP. Never calls the user's Supabase. */
import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {createHumanAuthTransport} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';import {createSessionFetch} from '../web/session-fetch.js';
import {createAuthentication} from '../src/infrastructure/authentication.ts';import {createHttpHandler} from '../src/http/handler.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';import {HelpdeskService} from '../src/application/helpdesk.ts';import type {SqlPool} from '../src/infrastructure/sql.ts';
import {principal,coverage} from './fixtures.ts';
const WS='11111111-1111-4111-8111-111111111111',AUTH='22222222-2222-4222-8222-222222222222',PERSON='33333333-3333-4333-8333-333333333333',ACCOUNT='44444444-4444-4444-8444-444444444444',PRODUCT='55555555-5555-4555-8555-555555555555';
const config={supabase_url:'https://syntheticproject.supabase.co',publishable_key:'sb_publishable_localtest'};
const login={email:'synthetic@example.test',password:'not-a-real-password',workspace:WS};
async function fixture(){
 let time=Date.parse('2026-09-17T12:00:00Z'),seq=0,allowed=true,refreshStatus=200,logoutStatus=204,mutations=0,rotations=0;
 const access=new Map<string,number>(),refresh=new Map<string,string>(),lookups:unknown[][]=[],logouts:string[]=[];
 const issue=()=>{seq++;const token='aaa.bbb.'+seq,ref='refresh_'+seq;access.set(token,time+120000);refresh.set(ref,token);return {access_token:token,refresh_token:ref,token_type:'bearer',expires_in:120,user:{id:AUTH,user_metadata:{role:'admin'}}};};
 const db=new MemoryUnitOfWork({coverages:[coverage({workspaceId:WS,accountId:ACCOUNT,productInstanceId:PRODUCT})]});
 let url='';
 const provider:typeof fetch=async(input,init)=>{const target=new URL(String(input));assert.equal(target.origin,config.supabase_url);return fetch(url+target.pathname+target.search,init);};
 const pool:SqlPool={async query(sql,values){assert.match(sql,/resolve_human/);lookups.push(values!);return {command:'SELECT',rows:[{principal:allowed?principal({id:PERSON,workspaceId:WS,grants:[{accountId:ACCOUNT,role:'requester'}]}):null}],rowCount:1};},async connect(){throw Error('No PostgreSQL exists in this fixture');},async end(){}};
 const auth=createAuthentication(pool,{supabaseUrl:config.supabase_url,publishableKey:config.publishable_key},provider);
 const api=createHttpHandler({service:new HelpdeskService(db,()=>new Date(time)),authenticate:auth.authenticate});
 const server=createServer(async(req,res)=>{try{
  const buffers:Buffer[]=[];for await(const piece of req)buffers.push(Buffer.from(piece));const body=Buffer.concat(buffers).toString();
  const path=new URL(req.url!,'http://local');let status=200,value:unknown={};const bearer=req.headers.authorization?.slice(7);
  if(path.pathname==='/auth/v1/token'){
   if(path.searchParams.get('grant_type')==='password'){assert.deepEqual(JSON.parse(body),{email:login.email,password:login.password});value=issue();}
   else{rotations++;const ref=JSON.parse(body).refresh_token;if(refreshStatus!==200){status=refreshStatus;}else if(!refresh.has(ref)){status=401;}else{refresh.delete(ref);value=issue();}}
  }else if(path.pathname==='/auth/v1/user'){if(!bearer||(access.get(bearer)??0)<=time)status=401;else value={id:AUTH};}
  else if(path.pathname==='/auth/v1/logout'){assert.equal(path.search,'?scope=local');assert.equal(body,'');logouts.push(bearer!);status=logoutStatus;
   if(status===204)for(const [key,token] of refresh)if(token===bearer)refresh.delete(key);
   // Deliberately do NOT revoke already-issued access JWTs: matches the documented limitation.
  }else{
   if(path.pathname==='/v1/tickets'&&req.method==='POST')mutations++;
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const response=await api(new Request('http://local'+req.url,{method:req.method,headers,...(body?{body}:{})}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  res.writeHead(status,{'content-type':'application/json'});res.end(status===204?undefined:JSON.stringify(value));
 }catch{res.writeHead(500,{'content-type':'application/json'});res.end('{}');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const address=server.address();assert.ok(address&&typeof address==='object');url='http://127.0.0.1:'+address.port;
 const transport=createHumanAuthTransport(config,{fetcher:provider,now:()=>time});const session=createHumanSession(transport,{now:()=>time});
 const request=createSessionFetch(session,(path,init)=>fetch(url+path,init));
 return {session,request,transport,url,db,lookups,logouts,advance:()=>{time+=70000;},revoke:()=>{allowed=false;},refreshFailure:(s:number)=>{refreshStatus=s;},logoutFailure:()=>{logoutStatus=503;},counters:()=>({mutations,rotations}),close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
function createOptions(){return {method:'POST',headers:{'content-type':'application/json','idempotency-key':'human-session-create-0001'},body:JSON.stringify({account_id:ACCOUNT,product_instance_id:PRODUCT,service_code:'SUPPORT',subject:'Chamado humano sintético',description:'Sem dados reais.',priority:'normal'})};}
test('HTTP synthetic provider -> backend Auth mapping -> ticket creation; rotated identity never inherits JWT metadata role',async()=>{
 const f=await fixture();try{await f.session.signIn(login);let r=await f.request('/me');let me=await r.json();assert.equal(me.id,PERSON);assert.notEqual(me.id,AUTH);assert.equal(me.workspace_role,null);
  assert.deepEqual(f.lookups[0],[AUTH,WS]);f.advance();const results=await Promise.all([f.request('/me'),f.request('/me')]);for(const item of results){me=await item.json();assert.equal(me.grants[0].role,'requester');}assert.equal(f.counters().rotations,1);
  r=await f.request('/tickets',createOptions());assert.equal(r.status,201);const created=await r.json();assert.equal(created.subject,'Chamado humano sintético');assert.equal(f.db.snapshot().tickets.length,1);assert.equal(f.counters().mutations,1);
 }finally{await f.close();}
});
test('HTTP revoked live membership stays forbidden after refresh, without silently replaying a POST',async()=>{
 const f=await fixture();try{await f.session.signIn(login);f.advance();f.revoke();const r=await f.request('/tickets',createOptions());assert.equal(r.status,403);assert.equal((await r.json()).code,'membership_required');assert.equal(f.counters().mutations,1);assert.equal(f.db.snapshot().tickets.length,0);assert.equal(f.counters().rotations,1);}finally{await f.close();}
});
test('HTTP transient refresh failure sends no business mutation; explicit resume then same key creates once',async()=>{
 const f=await fixture();try{await f.session.signIn(login);f.advance();f.refreshFailure(503);await assert.rejects(f.request('/tickets',createOptions()),(e:any)=>e.requestSent===false);assert.equal(f.counters().mutations,0);assert.equal(f.session.state().phase,'paused');
  f.refreshFailure(200);await f.session.resume();const r=await f.request('/tickets',createOptions());assert.equal(r.status,201);await r.arrayBuffer();assert.equal(f.counters().mutations,1);assert.equal(f.db.snapshot().tickets.length,1);
 }finally{await f.close();}
});
test('HTTP local logout clears client and rotates no more, but does not claim immediate access JWT invalidation',async()=>{
 const f=await fixture();try{await f.session.signIn(login);const old=await f.session.authorization();assert.equal(await f.session.signOut(),'confirmed');assert.equal(f.session.state().phase,'signed_out');await assert.rejects(f.request('/me'));assert.equal(f.logouts.length,1);
  const r=await fetch(f.url+'/v1/me',{headers:{authorization:'Bearer '+old.accessToken,'x-workspace-id':WS}});assert.equal(r.status,200);await r.arrayBuffer();
  await assert.rejects(f.transport.refresh('refresh_1')); // The removed refresh token cannot issue a new JWT.
 }finally{await f.close();}
});
test('HTTP failed logout never claims provider confirmation and does not keep usable browser state',async()=>{
 const f=await fixture();try{await f.session.signIn(login);f.logoutFailure();assert.equal(await f.session.signOut(),'unconfirmed');await assert.rejects(f.request('/me'));assert.equal(f.session.state().workspace,null);}finally{await f.close();}
});
