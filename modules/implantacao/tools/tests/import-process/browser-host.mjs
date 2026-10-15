// LOOPBACK TEST HOST ONLY. Not a deployment entry point. Uses MemoryRepository.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {Readable} from 'node:stream';
import {environment,scope,command} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
import {createImportProcessHttpHandler} from '../../../modules/import-process/http.ts';
const compiled=path.resolve(process.argv[2]||'');if(!process.argv[2]||!fs.existsSync(path.join(compiled,'import-process-client/client.js')))throw Error('COMPILED_TEST_MODULES_REQUIRED');
const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
let handler,origin,drop=false;
const html=`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Ensaio HTTP — processos sintéticos</title>
<style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:24px}button,input{font:inherit;padding:10px;margin:5px}input{width:90%}pre{white-space:pre-wrap;padding:16px;border:1px solid}p{line-height:1.6}</style>
<h1>Processos de implantação — ensaio R03</h1><p>Interface de teste. HTTP real; banco, sessão e scanner sintéticos. Não é a aplicação publicada.</p>
<button id="open">Retomar processo</button><button id="reload">Descartar edição e recarregar</button><button id="clear">Encerrar sessão local</button>
<p>Estado: <strong id="phase">idle</strong> · Versão: <strong id="version">—</strong></p>
<label for="note">Observação de conferência</label><input id="note"><button id="save">Salvar revisão</button><button id="retry">Recuperar recibo</button><p id="message" role="status"></p><pre id="receipt"></pre>
<script type="module">
import {createImportProcessClient} from '/modules/import-process-client/client.js';
import {createImportProcessController} from '/modules/import-process-client/controller.js';
const caseId='${scope.caseId}',el=id=>document.getElementById(id);
const client=createImportProcessClient({timeoutMs:3000,sessionFetch:(p,i)=>fetch(p,{...i,headers:{...Object.fromEntries(new Headers(i.headers)),Authorization:'Bearer browser-test'}})});
const controller=createImportProcessController({client,newId:()=>crypto.randomUUID(),onChange:s=>{
 el('phase').textContent=s.phase;el('version').textContent=s.data?.process.version??'—';el('message').textContent=s.message??'';
 el('receipt').textContent=s.lastReceipt?JSON.stringify(s.lastReceipt,null,2):'';
 if(document.activeElement!==el('note'))el('note').value=s.draft?.findings[0]?.text??'';
 el('save').disabled=s.phase!=='ready';el('retry').disabled=s.phase!=='uncertain';el('note').disabled=!['ready','conflict'].includes(s.phase);
}});
const run=fn=>Promise.resolve().then(fn).catch(e=>el('message').textContent=e.message);
el('open').onclick=()=>run(()=>controller.open(caseId));el('reload').onclick=()=>run(()=>controller.open(caseId,{discardChanges:true}));
el('note').oninput=()=>{const s=controller.getState();if(s.draft)controller.edit({...s.draft,findings:[{text:el('note').value}]});};
el('save').onclick=()=>run(()=>controller.save('Conferência sintética pelo navegador'));el('retry').onclick=()=>run(()=>controller.retry());
el('clear').onclick=()=>controller.clearSession();window.fixture={client,controller,caseId};
</script></html>`;
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}
  if(req.url==='/fixture/drop-ack'&&req.method==='POST'){drop=true;res.end('armed');return;}
  if(req.url?.startsWith('/modules/')){const rel=req.url.slice('/modules/'.length);if(!/^[a-z0-9/.-]+\.js$/i.test(rel)||rel.split('/').includes('..'))throw Error();const file=path.resolve(compiled,rel);if(!file.startsWith(compiled+path.sep))throw Error();res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(file));return;}
  const writing=req.method!=='GET',response=await handler(new Request(origin+req.url,{method:req.method,headers:req.headers,...(writing?{body:Readable.toWeb(req),duplex:'half'}:{})}));
  // Start an incomplete reply after the real commit. Destroying before headers
  // lets Chromium transparently retry a reused HTTP connection, hiding ACK loss.
  // The fixture's finite client timeout must observe an unknown outcome instead.
  if(drop&&writing&&req.url.endsWith('/revisions')){drop=false;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.write('{');return;}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=500;res.end('test-host-failure');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
handler=createImportProcessHttpHandler({origin,service,enabled:()=>true,authenticate:async req=>req.headers.get('authorization')==='Bearer browser-test'?{session:'fixture'}:null,locate:async(_c,caseId)=>({...scope,caseId}),admit:async()=>true});
console.log(origin);
process.on('SIGTERM',()=>{server.closeAllConnections();server.close(()=>process.exit(0))});
