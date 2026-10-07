import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import type {HelpdeskService} from '../src/application/helpdesk.ts';
const user='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const options=[{id:workspace,name:'Workspace autorizado'}];
function fixture(value:unknown=options,status=200){
 const calls:{sql:string;values:unknown[]}[]=[];let identities=0;
 const pool={query:async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});return {rows:[{workspaces:value}],rowCount:1};},connect:async()=>{throw Error('No domain connection');},end:async()=>{}} as SqlPool;
 const auth=createAuthentication(pool,{supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture'},async()=>{identities++;return new Response(JSON.stringify({id:user,user_metadata:{workspace_id:workspace,role:'admin'}}),{status,headers:{'content-type':'application/json'}});});
 return {auth,calls,identities:()=>identities};
}
test('workspace discovery resolves provider identity before a private bounded query without workspace header',async()=>{
 const f=fixture();assert.deepEqual(await f.auth.discoverWorkspaces(new Request('https://desk/v1/workspaces',{headers:{authorization:'Bearer aaa.bbb.ccc','x-workspace-id':'untrusted'}})),{items:options});
 assert.equal(f.identities(),1);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0]?.values,[user]);assert.match(f.calls[0]!.sql,/list_human_workspaces/);
});
for(const token of [null,'hd_key_'+'a'.repeat(43),'hd_session_'+'a'.repeat(43)])test('workspace discovery rejects missing or machine credential '+String(token)?.slice(0,12),async()=>{
 const f=fixture();await assert.rejects(f.auth.discoverWorkspaces(new Request('https://desk/v1/workspaces',{headers:token?{authorization:'Bearer '+token}:{}})),{code:'unauthorized'});assert.equal(f.identities(),0);assert.equal(f.calls.length,0);
});
test('workspace discovery rejects invalid provider session without database query',async()=>{
 const f=fixture(options,401);await assert.rejects(f.auth.discoverWorkspaces(new Request('https://desk/v1/workspaces',{headers:{authorization:'Bearer aaa.bbb.ccc'}})),{code:'unauthorized'});assert.equal(f.calls.length,0);
});
for(const value of [null,{},[{id:workspace,name:'',secret:'private'}],[...options,...options],Array.from({length:51},()=>options[0])])test('malformed workspace catalog fails closed without partial listing '+JSON.stringify(value).slice(0,35),async()=>{
 const f=fixture(value);await assert.rejects(f.auth.discoverWorkspaces(new Request('https://desk/v1/workspaces',{headers:{authorization:'Bearer aaa.bbb.ccc'}})),{code:'invalid_workspace_catalog'});
});
test('empty workspace catalog is an honest empty result, never an implicit grant',async()=>{
 const f=fixture([]);assert.deepEqual(await f.auth.discoverWorkspaces(new Request('https://desk/v1/workspaces',{headers:{authorization:'Bearer aaa.bbb.ccc'}})),{items:[]});
});
test('authentication-only route permits discovery without business dispatch and rejects selectors',async()=>{
 let discoveries=0,ingress=0;
 const h=createHttpHandler({authenticationOnly:true,service:{} as HelpdeskService,authenticate:async()=>{throw Error('Requires selected workspace');},discoverWorkspaces:async()=>{discoveries++;return {items:options};},rateLimiter:{beforeAuthentication:async()=>{ingress++;},afterAuthentication:async()=>{throw Error('No selected workspace');}}});
 assert.equal((await h(new Request('https://desk/v1/workspaces'))).status,200);
 for(const url of ['https://desk/v1/workspaces?user_id='+user,'https://desk/v1/workspaces?cursor=next'])assert.equal((await h(new Request(url))).status,400);
 assert.equal((await h(new Request('https://desk/v1/workspaces',{method:'POST'}))).status,503);
 assert.equal(discoveries,1);assert.equal(ingress,4);
});
