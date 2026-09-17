import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import {principal} from './fixtures.ts';
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const p=principal({id:uuid(1),workspaceId:uuid(2),grants:[{accountId:uuid(3),role:'requester'}]});
const config={supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fixture'};
function auth(response:Response){
  let queries=0;
  const pool:SqlPool={query:async()=>{queries++;return {rows:[{principal:p}],rowCount:1};},connect:async()=>{throw Error('unused');},end:async()=>{}};
  const value=createAuthentication(pool,config,async()=>response);
  return {run:()=>value.authenticate(new Request('https://test.invalid/v1/me',{headers:{authorization:'Bearer human-fixture-token','x-workspace-id':uuid(2)}})),queries:()=>queries};
}
test('oversized successful identity response is rejected before membership resolution',async()=>{
  const f=auth(Response.json({id:uuid(4),user_metadata:{ignored:'x'.repeat(65536)}}));
  await assert.rejects(f.run(),{status:503,code:'auth_unavailable'});assert.equal(f.queries(),0);
});
test('identity stream exceeding the byte budget is cancelled before reading further data',async()=>{
  let cancelled=false,produced=0;
  const stream=new ReadableStream<Uint8Array>({pull(c){produced++;if(produced===1)c.enqueue(new TextEncoder().encode('{"id":"'+uuid(4)+'","extra":"'));
    else if(produced<30)c.enqueue(new TextEncoder().encode('x'.repeat(8192)));else{c.enqueue(new TextEncoder().encode('"}'));c.close();}},cancel(){cancelled=true;}},{highWaterMark:0});
  const f=auth(new Response(stream,{headers:{'content-type':'application/json'}}));
  await assert.rejects(f.run(),{status:503,code:'auth_unavailable'});assert.equal(f.queries(),0);assert.equal(cancelled,true);assert.ok(produced<30);
});
test('invalid UTF-8 in ignored provider metadata is not silently replaced',async()=>{
  const prefix=new TextEncoder().encode('{"id":"'+uuid(4)+'","extra":"');
  const tail=new TextEncoder().encode('"}');const bytes=new Uint8Array([...prefix,0xc3,0x28,...tail]);
  const f=auth(new Response(bytes));
  await assert.rejects(f.run(),{status:503,code:'auth_unavailable'});assert.equal(f.queries(),0);
});
test('normal Unicode metadata is not promoted to a role or echoed as part of the principal',async()=>{
  const f=auth(Response.json({id:uuid(4),user_metadata:{role:'admin',description:'Olá 👷'},app_metadata:{role:'admin'}}));
  const result=await f.run();assert.deepEqual(result,p);assert.equal(f.queries(),1);assert.equal(Object.hasOwn(result,'user_metadata'),false);
});
test('decoded size is checked independently of the compressed Content-Length header',async()=>{
  const f=auth(new Response(JSON.stringify({id:uuid(4),padding:'x'.repeat(70000)}),{headers:{'content-encoding':'gzip','content-length':'80','content-type':'application/json'}}));
  await assert.rejects(f.run(),{code:'auth_unavailable'});assert.equal(f.queries(),0);
});
test('invalid provider JSON remains a safe authentication error',async()=>{
  const f=auth(new Response('{NOT-LOGGABLE-SECRET'));
  await assert.rejects(f.run(),(err:unknown)=>{assert.ok(err instanceof Error);assert.doesNotMatch(err.message,/NOT-LOGGABLE/);return (err as Error&{code:string}).code==='auth_unavailable';});
  assert.equal(f.queries(),0);
});

import {AUTH_RESPONSE_MAX_BYTES,readIdentityResponse} from '../src/infrastructure/auth-response.ts';

test('response exactly at the decoded byte limit is accepted without truncating JSON',async()=>{
  const base=JSON.stringify({id:uuid(4),padding:''});const padding='x'.repeat(AUTH_RESPONSE_MAX_BYTES-new TextEncoder().encode(base).byteLength);
  const body=JSON.stringify({id:uuid(4),padding});const f=auth(new Response(body));
  assert.deepEqual(await f.run(),p);assert.equal(f.queries(),1);
});
test('multi-byte metadata is limited by bytes, not JavaScript length',async()=>{
  const body=JSON.stringify({id:uuid(4),padding:'👷'.repeat(17000)});assert.ok(body.length<65536);
  const f=auth(new Response(body));await assert.rejects(f.run(),{code:'auth_unavailable'});assert.equal(f.queries(),0);
});
test('UTF-8 split across stream chunks remains valid and unchanged',async()=>{
  const body={id:uuid(4),name:'Olá 👷'};const bytes=new TextEncoder().encode(JSON.stringify(body));
  const stream=new ReadableStream<Uint8Array>({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}});
  assert.deepEqual(await readIdentityResponse(new Response(stream),new AbortController().signal),body);
});
test('already-aborted provider read refuses access and cancels the response',async()=>{
  let cancelled=false;const stream=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
  const controller=new AbortController();controller.abort();
  await assert.rejects(readIdentityResponse(new Response(stream),controller.signal),{code:'auth_unavailable'});assert.equal(cancelled,true);
});
test('abort ends an indefinitely pending body read without waiting for cancellation acknowledgement',async()=>{
  let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(){return new Promise<void>(()=>{});},cancel(){cancelled=true;return new Promise<void>(()=>{});}});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15);
  try{await assert.rejects(readIdentityResponse(new Response(stream),controller.signal),{status:503,code:'auth_unavailable'});assert.equal(cancelled,true);}finally{clearTimeout(timer);}
});
test('provider stream failure never copies the raw exception into the authentication error',async()=>{
  const stream=new ReadableStream<Uint8Array>({pull(c){c.error(Error('PRIVATE-AUTH-ERROR-TOKEN'));}});
  await assert.rejects(readIdentityResponse(new Response(stream),new AbortController().signal),(err:unknown)=>{
    assert.ok(err instanceof Error);assert.doesNotMatch(err.message,/PRIVATE-AUTH/);return (err as Error&{code:string}).code==='auth_unavailable';});
});
test('compressed length is not compared to decoded JSON when response is within budget',async()=>{
  const f=auth(new Response(JSON.stringify({id:uuid(4)}),{headers:{'content-encoding':'gzip','content-length':'7'}}));
  assert.deepEqual(await f.run(),p);
});
