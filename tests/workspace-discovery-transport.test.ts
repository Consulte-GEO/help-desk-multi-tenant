import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport} from '../web/human-auth.js';
const config={supabase_url:'https://project.supabase.co',publishable_key:'sb_publishable_fixture'};
const option={id:'22222222-2222-4222-8222-222222222222',name:'Suporte'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('workspace transport sends a human token to own API without workspace or persisted credentials',async()=>{
 const t=createHumanAuthTransport(config,{fetcher:async(url,init)=>{
  assert.equal(url,'/v1/workspaces');assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');
  const h=new Headers(init?.headers);assert.equal(h.get('authorization'),'Bearer aaa.bbb.ccc');assert.equal(h.has('x-workspace-id'),false);assert.equal(h.has('apikey'),false);
  return json({items:[option]});
 }});assert.deepEqual(await t.workspaces!('aaa.bbb.ccc'),[option]);
});
for(const body of [{items:[option,option]},{items:[{...option,scopes:['tickets:write']}]},{items:[{...option,name:'\u0000'}]},{items:[],user_id:'private'},{}])test('workspace transport rejects untrusted or duplicate options '+JSON.stringify(body),async()=>{
 const t=createHumanAuthTransport(config,{fetcher:async()=>json(body)});await assert.rejects(t.workspaces!('aaa.bbb.ccc'),{code:'auth_response_invalid'});
});
test('workspace transport deadline covers a fetch that ignores cancellation',async()=>{
 const t=createHumanAuthTransport(config,{fetcher:async()=>new Promise(()=>{}),timeoutMs:10});await assert.rejects(t.workspaces!('aaa.bbb.ccc'),{code:'auth_unavailable'});
});
test('workspace transport rejects revoked identity rather than returning empty catalog',async()=>{
 const t=createHumanAuthTransport(config,{fetcher:async()=>json({},401)});await assert.rejects(t.workspaces!('aaa.bbb.ccc'),{code:'session_rejected'});
});
