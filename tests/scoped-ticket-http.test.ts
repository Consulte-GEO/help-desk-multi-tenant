import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at='2026-10-09T12:00:00.123000Z',until='2026-10-09T12:01:00.123000Z';
const refs=[{connectionId:id(4),tenantId:'Tenant-A',type:'work',id:'A'}];
async function build(options:any){
 const name='../src/http/scoped-ticket-handler.ts';const mod=await import(name).catch((e:unknown)=>{if((e as any).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof mod.createScopedTicketHttpHandler,'function','C03 HTTP resource composition is missing');
 return mod.createScopedTicketHttpHandler(options) as (req:Request)=>Promise<Response>;
}
function fixture(){
 const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read','tickets:write','notes:read','notes:write']};
 const calls:string[]=[],args:any[]=[];let tick=at,reads=0;
 const state:any={enabled:true,mapping:{ticketId:id(6),workspaceId:id(1),accountId:id(3),refs:structuredClone(refs)},denySecond:false,sqlMismatch:false,dirError:false,commitLost:false};
 let currentOperation='tickets.read';
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>tick,
  authority:{readAccess:async(q)=>{calls.push('authority');reads++;currentOperation=q.operation;if(state.denySecond&&reads===2)return null;
   return {principal:structuredClone(p),operation:q.operation,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'Tenant-A',active:true,revision:'b1'},accessRevision:'a1',manifestFingerprint:'a'.repeat(64),asOf:at,expiresAt:until,resources:refs};}}});
 const pool:SqlPool={connect:async()=>{calls.push('connect');return {query:async(sql,values)=>{
  calls.push(sql);args.push(values);
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:{ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'b1',accessRevision:state.sqlMismatch?'other':'a1',manifestFingerprint:'a'.repeat(64),operation:currentOperation,asOf:at,expiresAt:until,refs:state.sqlRefs??refs}}]};
  if(sql==='COMMIT'&&state.commitLost)throw Error('private connection detail');
  return {command:sql.startsWith('select')?'SELECT':sql,rows:[],rowCount:0};
 },release:()=>calls.push('release')};},query:async()=>{throw Error('must use borrowed connection');},end:async()=>{}};
 const options:any={enabled:()=>state.enabled,pool,resolver,directoryTimeoutMs:1000,
  authenticate:async()=>{calls.push('auth');return p;},
  rateLimiter:{beforeAuthentication:async()=>calls.push('ingress'),afterAuthentication:async()=>calls.push('quota')},
  directory:{readTicketResources:async(actor:any,ticketId:any,signal:any)=>{calls.push('directory');assert.equal(actor.id,p.id);assert.equal(ticketId,id(6));assert.ok(signal instanceof AbortSignal);if(state.dirError)throw Error('private credentials');return state.mapping;}},
  execute:async(client:any,actor:any,req:Request)=>{calls.push('business');assert.equal(actor.id,p.id);await client.query('select business');return Response.json({id:id(6),scope:'own'}, {headers:{etag:'"7"','idempotency-replayed':'false'}});}
 };
 const request=(method='GET',suffix='',body?:unknown)=>new Request('https://helpdesk.example.test/v1/tickets/'+id(6)+suffix,{method,headers:{authorization:'Bearer synthetic','x-workspace-id':id(1),'content-type':'application/json','idempotency-key':'intent-00000000001','if-match':'"7"'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {p,calls,args,state,options,request,reads:()=>reads,setTime:(s:string)=>{tick=s;}};
}
const cases=[['GET','','tickets.read',undefined],['GET','/messages','tickets.read',undefined],['GET','/notes','notes.read',undefined],['GET','/timeline','tickets.read',undefined],['POST','/messages','tickets.write',{body:'reply'}],['POST','/notes','notes.write',{body:'private'}],['PATCH','','tickets.write',{priority:'high',reason:'Reason'}],['POST','/transitions','tickets.write',{to:'open',reason:'Reason'}],['POST','/assignments','tickets.write',{action:'claim',reason:'Reason'}]] as const;
for(const [method,suffix,op,body] of cases)test('C03 HTTP '+method+' '+(suffix||'ticket')+' uses one authorized transaction',async()=>{
 const f=fixture(),handler=await build(f.options),response=await handler(f.request(method,suffix,body));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('etag'),'"7"');
 assert.deepEqual((await response.json()).id,id(6));assert.equal(f.reads(),2);assert.equal(f.calls.filter(x=>x==='BEGIN').length,1);assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);
 const sqlIndex=f.calls.findIndex(s=>s.includes('cg_lock_ticket_scope'));assert.ok(sqlIndex<f.calls.indexOf('business'));assert.ok(f.calls.indexOf('auth')<f.calls.indexOf('directory'));
 const queryArgs=f.args.find(a=>a?.[0]===id(6));assert.deepEqual(queryArgs,[id(6),op]);
});
test('C03 closed release never reaches authentication or database',async()=>{const f=fixture();f.state.enabled=false;assert.equal((await (await build(f.options))(f.request())).status,503);assert.deepEqual(f.calls,[]);});
test('C03 user headers cannot choose another resource set',async()=>{const f=fixture();const r=f.request();r.headers.set('x-resource-refs','C');const response=await (await build(f.options))(r);assert.equal(response.status,200);assert.deepEqual(f.state.mapping.refs,refs);});
for(const value of [null,{ticketId:id(90),workspaceId:id(1),accountId:id(3),refs}, {ticketId:id(6),workspaceId:id(90),accountId:id(3),refs}, {ticketId:id(6),workspaceId:id(1),accountId:id(90),refs}, {ticketId:id(6),workspaceId:id(1),accountId:id(3),refs:[]}])test('C03 rejects absent or foreign ticket mapping '+JSON.stringify(value),async()=>{const f=fixture();f.state.mapping=value;const r=await (await build(f.options))(f.request());assert.ok([403,404,503].includes(r.status));assert.equal(f.calls.includes('business'),false);});
for(const kind of ['C','AC','tenant'])test('C03 HTTP direct access denies '+kind+' before business work',async()=>{const f=fixture();f.state.mapping.refs=kind==='AC'?[...refs,{...refs[0],id:'C'}]:[{...refs[0],...(kind==='tenant'?{tenantId:'Tenant-B'}:{id:'C'})}];const r=await (await build(f.options))(f.request());assert.equal(r.status,403);assert.equal(f.calls.includes('business'),false);});
test('C03 revocation between directory and execution rejects entire request',async()=>{const f=fixture();f.state.denySecond=true;const r=await (await build(f.options))(f.request());assert.equal(r.status,403);assert.equal(f.calls.includes('connect'),false);});
test('C03 persisted revision mismatch rolls back and never calls business',async()=>{const f=fixture();f.state.sqlMismatch=true;const r=await (await build(f.options))(f.request());assert.equal(r.status,403);assert.ok(f.calls.includes('ROLLBACK'));assert.equal(f.calls.includes('business'),false);});
test('C03 persisted A+B is not authorized by a request resolved only for A',async()=>{const f=fixture();f.state.sqlRefs=[...refs,{...refs[0],id:'B'}];const r=await (await build(f.options))(f.request());assert.equal(r.status,403);assert.equal(f.calls.includes('business'),false);});
test('C03 directory transport errors never expose credentials',async()=>{const f=fixture();f.state.dirError=true;const r=await (await build(f.options))(f.request());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private|credentials/);assert.equal(f.calls.includes('connect'),false);});
test('C03 requester cannot reach private notes using ticket read/write scopes',async()=>{const f=fixture();f.p.workspaceRole=null;f.p.grants[0]!.role='requester';f.p.scopes=['tickets:read','tickets:write'];const r=await (await build(f.options))(f.request('GET','/notes'));assert.equal(r.status,403);assert.equal(f.calls.includes('business'),false);});
test('C03 notes-only writer does not need tickets.write or notes.read',async()=>{const f=fixture();f.p.scopes=['tickets:read','notes:write'];const r=await (await build(f.options))(f.request('POST','/notes',{body:'Private'}));assert.equal(r.status,200);assert.deepEqual(f.p.scopes,['tickets:read','notes:write']);});
for(const method of ['GET','POST'])test('C03 generic '+method+' collection stays closed instead of postfiltering a page',async()=>{const f=fixture();const r=await (await build(f.options))(new Request('https://helpdesk.example.test/v1/tickets',{method}));assert.equal(r.status,503);assert.equal(f.calls.includes('business'),false);});
test('C03 forged resource selectors in body fail before directory lookup',async()=>{const f=fixture();const r=await (await build(f.options))(f.request('POST','/messages',{body:'x',refs:['C']}));assert.equal(r.status,400);assert.equal(f.calls.includes('directory'),false);});
test('C03 mutation requires original idempotency key and If-Match',async()=>{const f=fixture();const req=f.request('PATCH','',{priority:'high',reason:'x'});req.headers.delete('if-match');const r=await (await build(f.options))(req);assert.equal(r.status,428);assert.equal(f.calls.includes('directory'),false);});
test('C03 invalid, repeated or forged pagination selectors do not enter SQL',async()=>{for(const suffix of ['/messages?limit=0','/messages?limit=2&limit=3','?refs=C']){const f=fixture();const r=await (await build(f.options))(f.request('GET',suffix));assert.equal(r.status,400);assert.equal(f.calls.includes('directory'),false);}});
test('C03 a business Response error rolls back instead of confirming its earlier writes',async()=>{const f=fixture();f.options.execute=async(c:any)=>{await c.query('select partial');return Response.json({detail:'private information'},{status:409});};const r=await (await build(f.options))(f.request());assert.equal(r.status,409);assert.ok(f.calls.includes('ROLLBACK'));assert.equal(f.calls.includes('COMMIT'),false);assert.doesNotMatch(await r.text(),/private information/);});
test('C03 lost COMMIT is unknown and business is not repeated',async()=>{const f=fixture();f.state.commitLost=true;const r=await (await build(f.options))(f.request());assert.equal(r.status,503);assert.equal((await r.json()).code,'transaction_outcome_unknown');assert.equal(f.calls.filter(x=>x==='business').length,1);});
test('C03 cancellation while directory waits does not dispatch after late reply',async()=>{const f=fixture();let complete!:(x:unknown)=>void;f.options.directory.readTicketResources=()=>new Promise(resolve=>{complete=resolve;});const controller=new AbortController(),req=new Request(f.request(),{signal:controller.signal});const pending=(await build(f.options))(req);await new Promise(r=>setImmediate(r));controller.abort();const response=await pending;assert.equal(response.status,409);complete(f.state.mapping);await new Promise(r=>setImmediate(r));assert.equal(f.calls.includes('business'),false);});

test('C03 review invalid ticket identifiers return a client error, not an outage',async()=>{const f=fixture();const r=await (await build(f.options))(new Request('https://helpdesk.example.test/v1/tickets/not-a-uuid'));assert.equal(r.status,400);assert.equal(f.calls.includes('business'),false);});
test('C03 review forwards only the server context to the ingress limiter',async()=>{const f=fixture();let context:any;f.options.rateLimiter.beforeAuthentication=async(_req:any,ctx:any)=>{context=ctx;};const handler=await build(f.options),req=f.request();req.headers.set('x-forwarded-for','203.0.113.1');const r=await (handler as any)(req,{clientIp:'192.0.2.40'});assert.equal(r.status,200);assert.deepEqual(context,{clientIp:'192.0.2.40'});});
test('C03 review upstream error cannot turn a known failure code into a 2xx response',async()=>{const f=fixture();const {HelpdeskError}=await import('../src/domain/errors.ts');f.options.execute=async()=>{throw new HelpdeskError(200,'request_cancelled','private-error');};const r=await (await build(f.options))(f.request());assert.equal(r.status,409);assert.doesNotMatch(await r.text(),/private-error/);assert.ok(f.calls.includes('ROLLBACK'));});
test('C03 review interrupted DTO streams rollback rather than hold an open transaction',async()=>{
 const f=fixture();f.options.streamTimeoutMs=15;let cancelled=false,controller:ReadableStreamDefaultController<Uint8Array>|undefined;
 f.options.execute=async()=>new Response(new ReadableStream<Uint8Array>({start(c){controller=c;},cancel(){cancelled=true;}}));
 const pending=(await build(f.options))(f.request());let timer:ReturnType<typeof setTimeout>|undefined;
 const observed=await Promise.race([pending,new Promise<null>(r=>{timer=setTimeout(()=>r(null),150);})]);
 clearTimeout(timer);if(observed===null){controller?.close();await pending;assert.fail('Unfinished response must have been bounded before the diagnostic watchdog');}
 assert.equal(observed.status,503);assert.equal(cancelled,true);assert.ok(f.calls.includes('ROLLBACK'));assert.equal(f.calls.includes('COMMIT'),false);
});

test('C03 actual HTTP loopback denies resource C before the business executor',async()=>{
 const {createServer}=await import('node:http');const f=fixture(),handler=await build(f.options);
 const server=createServer(async(req,res)=>{const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);try{const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const address=server.address();assert.ok(address&&typeof address==='object');const endpoint='http://127.0.0.1:'+address.port+'/v1/tickets/'+id(6);assert.equal((await fetch(endpoint)).status,200);const before=f.calls.filter(c=>c==='business').length;f.state.mapping.refs=[{...refs[0],id:'C'}];assert.equal((await fetch(endpoint)).status,403);assert.equal(f.calls.filter(c=>c==='business').length,before);}
 finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test('C03 directory cannot enlarge the authenticated principal scopes while resolving metadata',async()=>{
 const f=fixture();f.p.scopes=['tickets:read'];const prior=f.options.directory.readTicketResources;
 f.options.directory.readTicketResources=async(p:any,id:any,signal:any)=>{p.scopes.push('notes:read');return prior(p,id,signal);};
 const r=await (await build(f.options))(f.request('GET','/notes'));assert.ok([403,503].includes(r.status));assert.equal(f.calls.includes('business'),false);assert.deepEqual(f.p.scopes,['tickets:read']);
});
