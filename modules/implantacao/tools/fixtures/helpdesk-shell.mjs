/** Owned loopback fixture: real Help Desk shell/UI and API; synthetic Auth, persistence and email. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
export async function startHelpdeskShellFixture(root){
const dist=resolve(root,'dist'),out=resolve(root,'modules/implantacao/.support-validation/shell');await mkdir(out,{recursive:true});
const {createImplementationSupportHandler}=await import(pathToFileURL(resolve(root,'src/http/implementation-support.ts')));
const {ImplementationSupportMemoryStore}=await import(pathToFileURL(resolve(root,'tests/helpers/implementation-support-store.ts')));
const actor='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',account='33333333-3333-4333-8333-333333333333';
const principal={id:actor,kind:'human',workspaceId:workspace,workspaceRole:'admin',grants:[{accountId:account,role:'agent'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
const store=new ImplementationSupportMemoryStore([{id:account,name:'Conta sintética de teste'}]),emails=new Map(),calls=[];
store.notificationsAvailable=async()=>true;
const originalRun=store.run.bind(store);
store.run=(p,a,work)=>originalRun(p,a,async tx=>{tx.email={available:async()=>true,async enqueue(id,event,kind){const row={id:randomUUID(),state:'queued',recipient_display:'t***@c***'};emails.set(id,[...(emails.get(id)||[]),row]);return {status:'queued',notifications:[row]};},async status(id){return {status:emails.get(id)?.[0]?.state||'suppressed',notifications:emails.get(id)||[]};}};return work(tx);});
const authScript=`const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=String(input);if(!url.startsWith('https://syntheticproject.supabase.co/auth/v1/'))return nativeFetch(input,init);if(url.includes('/logout'))return new Response(null,{status:204});if(url.endsWith('/user'))return Response.json({id:'${actor}',factors:[]});if(!url.includes('/token?grant_type='))throw Error('Unexpected synthetic Auth request');const payload=btoa(JSON.stringify({sub:'${actor}',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');return Response.json({access_token:'e30.'+payload+'.synthetic_loopback',refresh_token:'synthetic_loopback_refresh',expires_in:3600,token_type:'bearer',user:{id:'${actor}',factors:[]}});};`;
let origin,handler;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin),path=url.pathname;
 const json=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 if(path==='/_fixture/reset'&&req.method==='POST'){store.docs.clear();store.log=[];store.receipts.clear();emails.clear();calls.length=0;return json({reset:true});}
 if(path==='/_fixture/auth.js'){res.setHeader('content-type','text/javascript');return res.end(authScript);}
 if(path==='/_fixture/state')return json({documents:[...store.docs.values()],calls,emails:[...emails.entries()]});
 if(path==='/demo-config')return json({mode:'not-demo'});
 if(path==='/v1/public-config')return json({supabase_url:'https://syntheticproject.supabase.co',publishable_key:'sb_publishable_localtest',operational:true,email_monitoring:false,consultegeo_intake:false,registration_review:false});
 if(path==='/v1/workspaces')return json({items:[{id:workspace,name:'Teste local da interface'}]});
 if(path==='/v1/me')return json({id:actor,kind:'human',workspace_id:workspace,workspace_role:'admin',grants:[{account_id:account,role:'agent'}],scopes:principal.scopes});
 if(path==='/v1/tickets')return json({items:[],next_cursor:null});
 if(path.startsWith('/v1/implementation-support')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})}));calls.push({path,method:req.method,status:response.status});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}
 if(path.startsWith('/v1/'))return json({code:'not_found'},404);
 const file=resolve(dist,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(dist+sep))return json({},404);
 let bytes=await readFile(file);if(path==='/'){bytes=Buffer.from(bytes.toString().replace('<head>','<head><script src="/_fixture/auth.js"></script>').replace('<body>','<body><p>TESTE LOCAL — identidade, armazenamento e e-mail sintéticos</p>'));}
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://syntheticproject.supabase.co; img-src 'self' data: blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch(e){console.error(String(e.message));res.writeHead(500);res.end('Local fixture error');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
handler=createImplementationSupportHandler({origin,store,authenticate:async req=>{if(!req.headers.get('authorization')?.startsWith('Bearer ')||req.headers.get('x-workspace-id')!==workspace)throw Error('Synthetic authenticated session required');return principal;}});
const library={exports:{}};vm.runInNewContext(await readFile(resolve(root,'modules/implantacao/frontend/public/vendor/xlsx.full.min.js'),'utf8'),{module:library,exports:library.exports,Buffer,console});const X=library.exports;
const workbook=X.utils.book_new();X.utils.book_append_sheet(workbook,X.utils.aoa_to_sheet([['Data Concretagem','N.F. DANFE','Volume','Bloco','Unidade','Peça','Concreto','Usina'],['16/10/2026','TESTE-1601',8,'Torre TESTE','Pavimento 1','Laje','FCK 30 SLUMP 12 CM','Usina TESTE']]),'Dados');await writeFile(pathToFileURL(resolve(out,'planilha-teste.xlsx')),X.write(workbook,{type:'buffer',bookType:'xlsx'}));
const lines=['RELATORIO DE ENSAIO - TESTE SINTETICO','Concreto FCK 30 MPa','Obra: TESTE UI APOIO 2026-10-16','Nota fiscal 1601','Volume 8 m3','Data da concretagem 16/10/2026','Corpo de prova 1 - 28 dias - 33.5 MPa'];const content='BT /F1 12 Tf 40 800 Td '+lines.map((s,i)=>(i?'0 -22 Td ':'')+'('+s+') Tj').join(' ')+' ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 850] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream'];let pdf='%PDF-1.4\n',offsets=[];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const start=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';await writeFile(pathToFileURL(resolve(out,'laudo-teste.pdf')),pdf);
return {origin,out,async close(){server.closeAllConnections();await new Promise(r=>server.close(r));}};
}

