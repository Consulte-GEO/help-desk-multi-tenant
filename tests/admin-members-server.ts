/** Synthetic loopback fixture owned by browser-admin-members.py only. Never hosted. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {memberFixture} from './helpers/member-admin-fixture.ts';
import {createMemberAdministration} from '../src/application/member-admin.ts';
import {createMemberAdminHttpHandler} from '../src/http/member-admin.ts';
if(process.env.HELPDESK_OWNED_ADMIN_BROWSER!=='synthetic-loopback')throw Error('Owned synthetic fixture required');
let fixture=memberFixture();
const handler=()=>createMemberAdminHttpHandler({enabled:()=>true,authentication:fixture.auth,administration:createMemberAdministration({store:fixture.store,clock:fixture.clock}),rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}}});
const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Membros — demonstração local</title><link rel="stylesheet" href="/web/admin-members.css"><script type="module" src="/test-entry.js"></script><body><p>TESTE LOCAL · IDENTIDADES E PERSISTÊNCIA SINTÉTICAS</p><main id="members-root"></main></body></html>';
const entry=`import {mountAdminMembers} from '/web/admin-members.js';
const config=await (await fetch('/test-config.json')).json();
const request=(path,init={})=>fetch(path,{...init,headers:{...config.headers,...init.headers}});
window.memberPanel=mountAdminMembers(document.getElementById('members-root'),{request,audience:{principalId:config.principal,workspaceId:config.workspace}});
await window.memberPanel.load();`;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url??'/','http://127.0.0.1').pathname;
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
  res.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if(path==='/'&&req.method==='GET'){res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return;}
  if(path==='/test-entry.js'&&req.method==='GET'){res.setHeader('content-type','text/javascript');res.end(entry);return;}
  if(path==='/test-config.json'&&req.method==='GET'){res.setHeader('content-type','application/json');res.end(JSON.stringify({headers:Object.fromEntries(fixture.request().headers),principal:fixture.principal.id,workspace:fixture.principal.workspaceId}));return;}
  if(['/web/admin-members.js','/web/admin-members-state.js','/web/admin-members.css'].includes(path)&&req.method==='GET'){
   try{const data=await readFile(new URL('../'+path.slice(1),import.meta.url));res.setHeader('content-type',path.endsWith('.js')?'text/javascript':'text/css');res.end(data);}catch{res.writeHead(404);res.end();}return;
  }
  if(path==='/_test/reset'&&req.method==='POST'){fixture=memberFixture();res.end('{}');return;}
  if(path==='/_test/commit-loss'&&req.method==='POST'){fixture.switches.loseCommit=true;res.end('{}');return;}
  if(path==='/_test/remove-revoke-capability'&&req.method==='POST'){fixture.state().capabilityGrants=fixture.state().capabilityGrants.filter((g:any)=>g.principalId!==fixture.principal.id||g.capability!=='members.revoke');res.end('{}');return;}
  if(path==='/_test/counts'&&req.method==='GET'){res.setHeader('content-type','application/json');res.end(JSON.stringify({writes:fixture.counters.writes,audits:fixture.audit().length,receipts:fixture.receipts().size}));return;}
  if(path.startsWith('/v1/admin/members')){
   let size=0;const chunks:Buffer[]=[];for await(const part of req){size+=part.length;if(size>32*1024){res.writeHead(413);res.end('{}');return;}chunks.push(Buffer.from(part));}
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
   const response=await handler()(request,{clientIp:'127.0.0.1'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  res.writeHead(404);res.end('{}');
 }catch{res.writeHead(500);res.end('{"error":"fixture_failed"}');}
});
server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')throw Error('Invalid owned endpoint');console.log(JSON.stringify({url:'http://127.0.0.1:'+address.port}));});
process.once('SIGTERM',()=>{server.close();server.closeAllConnections();});
