/** Owned loopback fixture only. Real handler/service/resolver/store/transaction;
 * SYNTHETIC identity authority and SQL transport. Never a hosted/provider test.
 * The fixed HTTPS name is an in-process Request origin, not an external target.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createChecklistCompositionFixture,CHECKLIST_FIXTURE_ORIGIN,CHECKLIST_FIXTURE_AUTH} from './composition.ts';

if(process.env.HELPDESK_OWNED_CHECKLIST_BROWSER!=='synthetic-loopback')throw Error('Owned fixture required');
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
let fixture=createChecklistCompositionFixture();
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checklist — demonstração sintética</title><link rel="stylesheet" href="/web/execution-checklist.css"><link rel="stylesheet" href="/fixture.css"></head><body><main><p class="fixture-label">TESTE LOCAL · Dados sintéticos · Sem acesso ao GEO</p><div id="checklist"></div><button id="fixture-clear" type="button">Sair da sessão sintética</button></main><script type="module" src="/fixture.js"></script></body></html>`;
const servePaths=new Set(['/web/response-diagnostic.js','/web/execution-checklist.js','/web/execution-checklist-state.js','/web/execution-checklist-contract.js','/web/execution-checklist.css','/shared/form-rules.js','/shared/cnpj.js','/shared/instant.js','/shared/checklist-evidence.js']);
const server=createServer(async(req,res)=>{
 const address=server.address();if(!address||typeof address==='string'){res.writeHead(503);res.end();return;}
 const localOrigin='http://127.0.0.1:'+address.port;
 const url=new URL(req.url??'/',localOrigin);
 const send=(status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
 const raw=(type:string,text:string)=>{res.writeHead(200,{'content-type':type,'cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff'});res.end(text);};
 try{
  if(req.headers.host!=='127.0.0.1:'+address.port||url.origin!==localOrigin)return send(403,{status:403,code:'origin_denied'});
  if(req.method==='GET'&&url.pathname==='/')return raw('text/html; charset=utf-8',html);
  if(req.method==='GET'&&url.pathname==='/fixture.css')return raw('text/css','body{margin:0;background:#f3f6f9;color:#1f2937;font:16px/1.5 system-ui,sans-serif}main{max-width:960px;margin:36px auto;padding:0 18px}.fixture-label{font-size:12px;letter-spacing:.07em;color:#526170}#fixture-clear{margin:24px 0;padding:12px}');
  if(req.method==='GET'&&url.pathname==='/fixture.js')return raw('text/javascript',`import {mountExecutionChecklist} from '/web/execution-checklist.js';\nwindow.panel=mountExecutionChecklist(document.getElementById('checklist'),{audience:${JSON.stringify(fixture.audience())},request:(path,init)=>fetch(path,{...init,headers:{...init.headers,authorization:${JSON.stringify(CHECKLIST_FIXTURE_AUTH)}}})});document.getElementById('fixture-clear').addEventListener('click',()=>window.panel.clear());window.panel.load();`);
  if(req.method==='GET'&&servePaths.has(url.pathname))return raw(url.pathname.endsWith('.css')?'text/css':'text/javascript',await readFile(resolve(root,'.'+url.pathname),'utf8'));
  if(url.pathname==='/_test/reset'&&req.method==='POST'){fixture=createChecklistCompositionFixture();return send(200,{ok:true});}
  if(url.pathname==='/_test/mode'&&req.method==='POST')return fixture.setMode(url.searchParams.get('value')??'')?send(200,{ok:true}):send(400,{ok:false});
  if(url.pathname==='/_test/counts'&&req.method==='GET')return send(200,fixture.counts());
  if(!url.pathname.startsWith('/v1/internal/tickets/'))return send(404,{status:404,code:'not_found'});
  const chunks:Buffer[]=[];let size=0;
  for await(const part of req){size+=part.length;if(size>8192)return send(413,{status:413,code:'payload_too_large'});chunks.push(part);}
  const bytes=Buffer.concat(chunks),headers=new Headers();
  for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
  // Map only this owned loopback origin, not any Origin supplied by a caller.
  // This adapter exists solely for the fixture and is never mounted in runtime.
  if(headers.has('origin')&&headers.get('origin')!==localOrigin)return send(403,{status:403,code:'origin_denied'});
  if(headers.has('origin'))headers.set('origin',CHECKLIST_FIXTURE_ORIGIN);
  const controller=new AbortController();const cancel=()=>controller.abort();req.once('aborted',cancel);
  if(req.aborted)controller.abort();
  try{
   const method=req.method??'GET';
   const request=new Request(CHECKLIST_FIXTURE_ORIGIN+url.pathname+url.search,{method,headers,signal:controller.signal,
    ...(!['GET','HEAD'].includes(method)?{body:Uint8Array.from(bytes).buffer}:{})});
   const current=fixture;
   if(url.pathname.endsWith('/marks')&&method==='POST')current.attempt(headers.get('idempotency-key')??'',bytes.toString('utf8'));
   const response=await current.handler(request,{clientIp:'127.0.0.1'});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }finally{req.removeListener('aborted',cancel);}
 }catch{send(503,{status:503,code:'checklist_store_unavailable'});}
});
server.listen(0,'127.0.0.1',()=>{const a=server.address();if(!a||typeof a==='string')throw Error();console.log(JSON.stringify({url:'http://127.0.0.1:'+a.port}));});
process.once('SIGTERM',()=>server.close());process.once('SIGINT',()=>server.close());
