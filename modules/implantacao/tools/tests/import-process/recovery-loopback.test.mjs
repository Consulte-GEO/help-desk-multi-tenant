// Real TCP/HTTP. In-memory repository, identity and browser storage are test doubles.
import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {Readable} from 'node:stream';
import {environment,command,scope,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
import {createImportProcessHttpHandler} from '../../../modules/import-process/http.ts';
import {createImportProcessClient} from '../../../modules/import-process-client/client.ts';
import {createImportProcessController} from '../../../modules/import-process-client/controller.ts';
import {createSessionRecoveryJournal} from '../../../modules/import-process-client/recovery-journal.ts';
async function loopback(t){
 const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
 let handler,origin,drop=false,skip=false,authorized=true;const requests=[];
 const server=http.createServer(async(req,res)=>{
  try{
   requests.push({path:req.url,method:req.method});
   if(skip&&req.method==='POST'){res.destroy();return;}
   const writing=req.method==='POST';
   const reply=await handler(new Request(origin+req.url,{method:req.method,headers:req.headers,...(writing?{body:Readable.toWeb(req),duplex:'half'}:{})}));
   if(drop&&writing){drop=false;res.destroy();return;}
   res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));
  }catch{if(!res.destroyed){res.statusCode=500;res.end('fixture_error');}}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 origin='http://127.0.0.1:'+server.address().port;
 handler=createImportProcessHttpHandler({origin,service,enabled:()=>true,authenticate:async req=>authorized&&req.headers.get('authorization')==='Bearer fixture'?{}:null,locate:async(_c,caseId)=>({...scope,caseId}),admit:async()=>true});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 const client=createImportProcessClient({sessionFetch:(p,i)=>fetch(origin+p,{...i,headers:{...Object.fromEntries(new Headers(i.headers)),Authorization:'Bearer fixture',...(i.method==='POST'?{Origin:origin}:{})}})});
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const make=()=>createImportProcessController({client,newId:()=>id(20),recovery:{identity:{workspaceId:scope.workspaceId,accountId:scope.accountId,actorId:id(4)},journal:createSessionRecoveryJournal(storage)}});
 async function send(){const c=make();await c.open(scope.caseId);c.edit({...empty(),findings:[{text:'Arquivo conferido'}]});await c.save('Conferência');return c;}
 return {e,service,client,data,requests,make,send,drop(){drop=true},skip(){skip=true},auth(v){authorized=v}};
}
test('R04 HTTP real nova instância recupera ACK perdido com GET e nenhuma nova escrita',async t=>{const x=await loopback(t);x.drop();const old=await x.send();assert.equal(old.getState().phase,'uncertain');old.detach();const n=x.requests.length,next=x.make();await next.restorePending();assert.equal(next.getState().lastReceipt.operationId,id(20));assert.equal(next.getState().phase,'ready');assert.equal(x.e.repo.stored().revisions.length,2);assert.equal(x.data.size,0);assert.ok(x.requests.slice(n).every(r=>r.method==='GET'));});
test('R04 HTTP real sem commit mantém pendência após reconstrução do controlador',async t=>{const x=await loopback(t);x.skip();const old=await x.send();old.detach();const n=x.requests.length,next=x.make();await next.restorePending();await next.retry();assert.equal(next.getState().phase,'uncertain');assert.equal(next.getState().lastReceipt,null);assert.equal(x.e.repo.stored().revisions.length,1);assert.ok(x.requests.slice(n).every(r=>r.method==='GET'));assert.equal(x.data.size,1);});
test('R04 HTTP real sessão recusada não descarta operação e recuperar depois não duplica',async t=>{const x=await loopback(t);x.drop();(await x.send()).detach();x.auth(false);const c=x.make();await c.restorePending();assert.equal(c.getState().phase,'uncertain');assert.equal(c.getState().data,null);x.auth(true);await c.recover();assert.equal(c.getState().phase,'ready');assert.equal(x.e.repo.stored().events.length,2);});
test('R04 HTTP real recibo recuperado não confunde sua versão com alterações posteriores',async t=>{const x=await loopback(t);x.drop();(await x.send()).detach();await x.client.saveRevision(scope.caseId,{operationId:id(30),expectedVersion:2,snapshot:{...empty(),findings:[{text:'Alteração posterior'}]},reason:'Outra revisão'});const c=x.make();await c.restorePending();assert.equal(c.getState().lastReceipt.version,2);assert.equal(c.getState().data.process.version,3);assert.equal(c.getState().draft.findings[0].text,'Alteração posterior');assert.equal(x.e.repo.stored().revisions.length,3);});
