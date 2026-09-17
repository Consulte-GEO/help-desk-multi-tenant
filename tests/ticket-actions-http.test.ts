/** Actual local sockets; synthetic identities and memory persistence, not hosted Auth/RLS. */
import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {loadTicketDetail} from '../web/ticket-actions.js';
import {principal,ticket} from './fixtures.ts';
const tid='13000000-0000-4000-8000-000000000001';
const agent=principal({grants:[{accountId:'account-a',role:'agent'}]});
async function fixture(){
 let current=agent,notesFail=false;const paths:string[]=[];
 const store=new MemoryUnitOfWork({tickets:[ticket({id:tid,status:'open'})]});const service=new HelpdeskService(store);
 await service.addMessage(agent,tid,'Public content retained',randomUUID(),randomUUID());
 await service.addNote(agent,tid,'Private note never reused after failure',randomUUID(),randomUUID());
 const handler=createHttpHandler({service,authenticate:async()=>current});
 const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const body=Buffer.concat(chunks);const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(body.length?{body}: {})});paths.push(new URL(request.url).pathname);
  const response=notesFail&&request.method==='GET'&&new URL(request.url).pathname.endsWith('/notes')?Response.json({code:'unavailable'},{status:503}):await handler(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/v1';
 const read=async(path:string)=>{const r=await fetch(url+path);const body=await r.json();if(!r.ok)throw Object.assign(Error('Section unavailable'),{status:r.status});return body;};
 return {url,read,paths,set:(p:typeof agent)=>{current=p;},breakNotes:()=>{notesFail=true;},close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
test('socket detail loader isolates a notes outage and does not retain the previously loaded note',async()=>{
 const f=await fixture();try{
  const before=await loadTicketDetail(tid,f.read);assert.equal(before!.notes.items.length,1);f.breakNotes();
  const after=await loadTicketDetail(tid,f.read);assert.equal(after!.messages.items[0]!.body,'Public content retained');
  assert.equal(after!.notesUnavailable,true);assert.equal(after!.actions.add_note,false);assert.deepEqual(after!.notes.items,[]);
  assert.doesNotMatch(JSON.stringify(after),/Private note never reused/);
 }finally{await f.close();}
});
test('socket read-only operator does not request notes and cannot use modified hints to send a message',async()=>{
 const f=await fixture();try{
  f.set({...agent,scopes:['tickets:read']});const detail=await loadTicketDetail(tid,f.read);
  assert.equal(detail!.actions.reply,false);assert.equal(detail!.actions.read_notes,false);assert.ok(!f.paths.some(p=>p.endsWith('/notes')));
  detail!.actions.reply=true;
  const r=await fetch(f.url+'/tickets/'+tid+'/messages',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({body:'Forbidden message'})});
  assert.equal(r.status,403);assert.doesNotMatch(JSON.stringify(await f.read('/tickets/'+tid+'/messages')),/Forbidden message/);
 }finally{await f.close();}
});
test('socket refresh recalculates actions after scope revocation without changing ticket version',async()=>{
 const f=await fixture();try{
  const before=await f.read('/tickets/'+tid);assert.equal(before.available_actions.change_priority,true);
  f.set({...agent,scopes:['tickets:read']});const after=await f.read('/tickets/'+tid);
  assert.equal(after.version,before.version);assert.equal(after.available_actions.change_priority,false);assert.deepEqual(after.available_actions.transitions,[]);
  const r=await fetch(f.url+'/tickets/'+tid,{method:'PATCH',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"'+before.version+'"'},body:JSON.stringify({priority:'urgent',reason:'Previously offered action'})});
  assert.equal(r.status,403);assert.equal((await f.read('/tickets/'+tid)).priority,before.priority);
 }finally{await f.close();}
});
