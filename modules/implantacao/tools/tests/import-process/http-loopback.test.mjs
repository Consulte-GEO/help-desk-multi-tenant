// Real TCP/HTTP in a disposable loopback listener. Service is real; database,
// identity provider and scanner are TEST FIXTURES. This does not qualify PostgreSQL.
import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {Readable} from 'node:stream';
import {environment,command,scope,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
import {createImportProcessHttpHandler} from '../../../modules/import-process/http.ts';
import {createImportProcessClient} from '../../../modules/import-process-client/client.ts';
import {createImportProcessController} from '../../../modules/import-process-client/controller.ts';
async function loopback(t){
 const e=environment();let handler,origin,dropAck=false;const observations=[];
 const server=http.createServer(async(req,res)=>{
  const abort=new AbortController();req.on('aborted',()=>abort.abort());
  try{
   const url=origin+req.url,writing=req.method!=='GET'&&req.method!=='HEAD';
   const request=new Request(url,{method:req.method,headers:req.headers,signal:abort.signal,...(writing?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const reply=await handler(request);observations.push({method:req.method,path:req.url,status:reply.status});
   if(dropAck&&req.method==='POST'&&req.url.endsWith('/revisions')){dropAck=false;res.destroy();return;}
   res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));
  }catch{if(!res.destroyed){res.statusCode=500;res.end('test-host-failure');}}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 origin='http://127.0.0.1:'+server.address().port;
 handler=createImportProcessHttpHandler({origin,enabled:()=>true,service:createImportProcessService(e.options()),
  authenticate:async req=>req.headers.get('authorization')==='Bearer loopback-test'?{subject:id(4)}:null,
  locate:async(_c,caseId)=>({...scope,caseId}),admit:async()=>true});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 const client=createImportProcessClient({sessionFetch:async(path,init)=>fetch(origin+path,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:'Bearer loopback-test',...(init.method==='POST'?{Origin:origin}:{})}})});
 return {e,client,origin,observations,drop(){dropAck=true}};
}
test('R03 HTTP real cria, retoma, salva e lê revisão anterior',async t=>{
 const x=await loopback(t);const first=await x.client.createCase(command());assert.equal(first.version,1);
 const loaded=await x.client.getCase(scope.caseId);assert.equal(loaded.currentRevision.hash,first.hash);
 const saved=await x.client.saveRevision(scope.caseId,{operationId:id(20),expectedVersion:1,snapshot:{...empty(),findings:[{text:'Confirmação sintética'}]},reason:'Teste real HTTP'});
 assert.equal(saved.revision,2);const old=await x.client.getRevision(scope.caseId,1);assert.equal(old.hash,first.hash);
 assert.equal((await x.client.getCase(scope.caseId)).process.version,2);assert.ok(x.observations.every(x=>[200,201].includes(x.status)));
});
test('R03 HTTP real ACK perdido depois da escrita é recuperado sem duplicação',async t=>{
 const x=await loopback(t);await x.client.createCase(command());let serial=200;
 const c=createImportProcessController({client:x.client,newId:()=>id(serial++)});await c.open(scope.caseId);c.edit(empty());x.drop();
 await c.save('Simular conexão perdida');assert.equal(c.getState().phase,'uncertain');assert.equal(x.e.repo.stored().process.version,2);
 const key=c.getState().pendingOperationId;await c.retry();assert.equal(c.getState().phase,'ready');assert.equal(c.getState().lastReceipt.operationId,key);
 assert.equal(c.getState().lastReceipt.replayed,true);assert.equal(x.e.repo.stored().events.length,2);assert.equal(x.e.repo.stored().receipts.length,2);
});
test('R03 HTTP real duas conexões concorrentes têm um único vencedor',async t=>{
 const x=await loopback(t);await x.client.createCase(command());
 const results=await Promise.allSettled([30,31].map(n=>x.client.saveRevision(scope.caseId,{operationId:id(n),expectedVersion:1,snapshot:empty(),reason:'Concorrência '+n})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.status,412);assert.equal(x.e.repo.stored().revisions.length,2);
});
test('R03 HTTP real não expõe dados sem bearer ou para origem externa',async t=>{
 const x=await loopback(t);await x.client.createCase(command());
 const noAuth=await fetch(x.origin+'/v1/import-processes/'+scope.caseId);assert.equal(noAuth.status,401);assert.equal(noAuth.headers.get('cache-control'),'no-store');
 const evil=await fetch(x.origin+'/v1/import-processes/'+scope.caseId,{headers:{Authorization:'Bearer loopback-test',Origin:'https://external.example'}});assert.equal(evil.status,403);assert.equal(evil.headers.has('access-control-allow-origin'),false);
 assert.ok(!(await evil.text()).includes('headHash'));
});
