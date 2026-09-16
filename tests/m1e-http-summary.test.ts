/** Real loopback HTTP and offline CLI, with synthetic identities/in-memory domain only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHttpHandler} from '../src/http/handler.ts';import {createHostedHandler} from '../src/infrastructure/hosted-handler.ts';
import {HelpdeskError} from '../src/domain/errors.ts';import {RateLimitError} from '../src/infrastructure/rate-limit.ts';
import {principal} from './fixtures.ts';import type {HttpObservation} from '../src/observability/http.ts';
const commandModule='../scripts/local-process.mjs';const {runCommand}=await import(commandModule);
async function serve(handler:(r:Request)=>Promise<Response>){
 const server=createServer(async(req,res)=>{try{
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
  const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers});const response=await handler(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('fixture adapter error');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
 const a=server.address();assert.ok(a&&typeof a==='object');return {url:'http://127.0.0.1:'+a.port,close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
function handler(events:HttpObservation[],failure?:Error){return createHttpHandler({service:null as never,authenticate:async()=>{if(failure)throw failure;return principal();},observe:e=>{events.push(e);}});}
test('loopback response and diagnostic share a normalized request ID, without request secrets',async()=>{
 const events:HttpObservation[]=[];const server=await serve(handler(events));try{
  const id='AABBCCDD-1234-4234-8234-AABBCCDDEEFF';const r=await fetch(server.url+'/v1/capabilities?password=PRIVATE_QUERY',{headers:{authorization:'Bearer PRIVATE_BEARER','x-request-id':id}});
  assert.equal(r.status,200);await r.arrayBuffer();assert.equal(events.length,1);assert.equal(events[0]!.request_id,id.toLowerCase());assert.equal(r.headers.get('x-request-id'),id.toLowerCase());assert.doesNotMatch(JSON.stringify(events),/PRIVATE|password|Bearer/);
 }finally{await server.close();}
});
test('loopback reports a real ingress refusal with its safe code and Retry-After',async()=>{
 const events:HttpObservation[]=[];let calls=0;const h=createHttpHandler({service:null as never,authenticate:async()=>{calls++;return principal();},observe:e=>{events.push(e);},rateLimiter:{beforeAuthentication:async()=>{throw new RateLimitError(9);},afterAuthentication:async()=>{}}});
 const server=await serve(h);try{const r=await fetch(server.url+'/v1/tickets');assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'9');await r.arrayBuffer();assert.equal(calls,0);assert.equal(events[0]!.error_code,'rate_limit_exceeded');}finally{await server.close();}
});
test('loopback startup failure has one safe diagnostic correlated to problem response',async()=>{
 const events:HttpObservation[]=[];const server=await serve(createHostedHandler(async()=>{throw Error('postgres://PRIVATE_PASSWORD');},e=>{events.push(e);}));try{
  const r=await fetch(server.url+'/v1/me');const body=await r.json();assert.equal(r.status,503);assert.equal(body.request_id,events[0]!.request_id);assert.equal(events.length,1);assert.equal(events[0]!.phase,'bootstrap');assert.doesNotMatch(JSON.stringify({body,events}),/PRIVATE_PASSWORD/);
 }finally{await server.close();}
});
test('offline CLI summarizes actual loopback observations without retaining their identifiers',async()=>{
 const events:HttpObservation[]=[];const server=await serve(handler(events,new HelpdeskError(403,'forbidden','Denied')));const root=await mkdtemp(join(tmpdir(),'helpdesk-http-cli-'));
 try{
  for(const path of ['/v1/capabilities','/v1/tickets/PRIVATE_OBJECT/notes?cursor=PRIVATE_CURSOR','/v1/tickets/SECOND_OBJECT/notes']){const r=await fetch(server.url+path);await r.arrayBuffer();}
  const file=join(root,'observations.jsonl');await writeFile(file,events.map(e=>JSON.stringify(e)).join('\n'));
  const r=await runCommand({command:[process.execPath,'--experimental-strip-types','scripts/summarize-http-logs.ts',file],timeoutMs:10_000});assert.equal(r.exit_code,0,r.output);
  const summary=JSON.parse(r.stdout);assert.equal(summary.accepted,3);assert.equal(summary.routes.length,2);assert.equal(summary.routes.find((g:any)=>g.route.endsWith('/notes')).errors.forbidden,2);
  for(const e of events)assert.ok(!r.stdout.includes(e.request_id));assert.doesNotMatch(r.stdout,/PRIVATE|SECOND_OBJECT/);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
test('offline CLI rejects missing or directory input without exposing the input path',async()=>{
 const root=await mkdtemp(join(tmpdir(),'helpdesk-private-cli-'));try{for(const input of [root,join(root,'SECRET_MISSING')]){
  const r=await runCommand({command:[process.execPath,'--experimental-strip-types','scripts/summarize-http-logs.ts',input],timeoutMs:10_000});assert.notEqual(r.exit_code,0);assert.ok(!r.output.includes(root));assert.doesNotMatch(r.output,/SECRET_MISSING/);
 }}finally{await rm(root,{recursive:true,force:true});}
});
