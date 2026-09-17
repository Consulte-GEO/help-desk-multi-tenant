/** Real loopback HTTP; identities and storage are synthetic, not Supabase. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {principal,ticket} from './fixtures.ts';
import type {PublicMessage} from '../src/domain/model.ts';
import {compareInstants} from '../shared/instant.js';
const id=(n:number)=>'17000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at=(n:number)=>'2026-09-17T12:00:00.'+(n===0?'123':('123'+String(n).padStart(3,'0')))+'Z';
async function fixture(){
 const parent=ticket({id:id(1)}),forbidden=ticket({id:id(2),accountId:'account-b',createdBy:'person-b'});
 const messages:PublicMessage[]=Array.from({length:75},(_,i)=>({id:id(100+i),workspaceId:parent.workspaceId,accountId:parent.accountId,ticketId:parent.id,
  actorId:'person-a',actorType:'customer',body:'Public precision '+i,createdAt:at(i)}));
 const notes=messages.map(({actorType,...m})=>({...m,id:id(300+Number(m.id.slice(-12))),body:'INTERNAL precision'}));
 const events=messages.map(m=>({id:id(500+Number(m.id.slice(-12))),workspaceId:m.workspaceId,accountId:m.accountId,ticketId:m.ticketId,actorId:m.actorId,
  type:'message.created',customerVisible:true,data:{messageId:m.id,actorType:m.actorType},createdAt:m.createdAt}));
 const tickets=[parent,forbidden,...messages.map((m,i)=>ticket({id:id(1000+i),subject:'Precise list '+i,createdAt:m.createdAt}))];
 const db=new MemoryUnitOfWork({tickets,messages,notes,events});
 const handler=createHttpHandler({service:new HelpdeskService(db),authenticate:async req=>principal({grants:[{accountId:'account-a',role:req.headers.get('x-test-role')==='agent'?'agent':'requester'}]})});
 const server=createServer(async(req,res)=>{try{
  const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();assert.ok(address&&typeof address==='object');
 return {call:(path:string,agent=false)=>fetch('http://127.0.0.1:'+address.port+'/v1'+path,{headers:agent?{'x-test-role':'agent'}:{}}),
  close:async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}};
}
for(const kind of ['messages','notes','timeline'] as const)test(`HTTP ${kind}: all 75 instants within one millisecond remain reachable`,async()=>{
 const f=await fixture();try{
  const all:{id:string;created_at:string}[]=[];let cursor:string|null=null,ended=false;
  for(let i=0;i<12;i++){
   const response=await f.call('/tickets/'+id(1)+'/'+kind+'?limit=7'+(cursor?'&cursor='+encodeURIComponent(cursor):''),true);
   assert.equal(response.status,200);const body=await response.json();all.push(...body.items);cursor=body.next_cursor;
   if(!cursor){ended=true;break;}
  }
  assert.equal(ended,true);assert.equal(all.length,75);assert.equal(new Set(all.map(x=>x.id)).size,75);
  assert.equal(all[0]!.created_at,at(74));assert.equal(all.at(-1)!.created_at,at(0));
  for(let i=1;i<all.length;i++)assert.equal(compareInstants(all[i-1]!.created_at,all[i]!.created_at),1);
  assert.equal((await f.call('/tickets/'+id(2)+'/'+kind+'?limit=7',true)).status,404);
  if(kind==='notes')assert.equal((await f.call('/tickets/'+id(1)+'/notes?limit=7')).status,403);
 }finally{await f.close();}
});
test('HTTP list microsecond cursor keeps filters, full precision and authorization',async()=>{
 const f=await fixture();try{
  const first=await f.call('/tickets?limit=7&q=Precise');assert.equal(first.status,200);const body=await first.json();
  assert.equal(body.items[0].created_at,at(74));assert.ok(body.next_cursor);
  const wrong=await f.call('/tickets?limit=7&q=Other&cursor='+encodeURIComponent(body.next_cursor));assert.equal(wrong.status,400);
  const second=await f.call('/tickets?limit=7&q=Precise&cursor='+encodeURIComponent(body.next_cursor));assert.equal(second.status,200);
  const b=await second.json();assert.equal(b.items[0].created_at,at(67));
  assert.equal(new Set([...body.items,...b.items].map(x=>x.id)).size,14);
  assert.ok([...body.items,...b.items].every(x=>x.account_id==='account-a'));
 }finally{await f.close();}
});
