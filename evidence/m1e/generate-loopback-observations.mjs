/** Evidence generator: actual loopback HTTP; only synthetic identities and in-memory domain. */
import {createServer} from 'node:http';import {writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {createHttpHandler} from '../../src/http/handler.ts';import {createHostedHandler} from '../../src/infrastructure/hosted-handler.ts';
import {RateLimitError} from '../../src/infrastructure/rate-limit.ts';import {HelpdeskError} from '../../src/domain/errors.ts';
import {principal} from '../../tests/fixtures.ts';
const events=[],checks=[];let mode='normal';
const handler=createHttpHandler({service:null,authenticate:async()=>{throw new HelpdeskError(403,'forbidden','Synthetic denied request.');},
 rateLimiter:{beforeAuthentication:async()=>{if(mode==='rate')throw new RateLimitError(9);},afterAuthentication:async()=>{}},observe:e=>events.push(e)});
const failed=createHostedHandler(async()=>{throw new HelpdeskError(503,'release_gate_closed','Synthetic startup failure.');},e=>events.push(e));
const server=createServer(async(req,res)=>{try{const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
 const r=await (mode==='startup'?failed:handler)(new Request('http://127.0.0.1'+req.url,{method:req.method,headers}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
try{const url='http://127.0.0.1:'+server.address().port;
 for(const [label,m,path,status] of [['capabilities','normal','/v1/capabilities',200],['forbidden resource','normal','/v1/tickets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/notes?cursor=SYNTHETIC',403],['ingress rate limit','rate','/v1/tickets',429],['bootstrap error','startup','/v1/me',503]]){
  mode=m;const r=await fetch(url+path,{headers:{authorization:'Bearer synthetic-not-a-valid-token'}});await r.arrayBuffer();
  if(r.status!==status||r.headers.get('x-request-id')!==events.at(-1)?.request_id)throw Error('Unexpected local HTTP evidence.');checks.push({name:label,result:'passed',status:r.status});
 }
 await writeFile(new URL('loopback-observations.jsonl',import.meta.url),events.map(e=>JSON.stringify(e)).join('\n')+'\n');
 await writeFile(new URL('loopback-observations-checks.json',import.meta.url),JSON.stringify({scope:'local-http-with-synthetic-identities',not_production_telemetry:true,checks},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,events:events.length,source:'actual-loopback-synthetic-fixtures'}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
