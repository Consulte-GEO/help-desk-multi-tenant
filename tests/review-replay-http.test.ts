/** Local sockets + real application commands, synthetic Auth and memory persistence.
 * The poison is injected at the adapter boundary; it is not evidence of a remote incident.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {StoredResult,UnitOfWork} from '../src/application/ports.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {coverage,principal,ticket} from './fixtures.ts';

const tid='14000000-0000-4000-8000-000000000001';
const actor=principal({workspaceRole:'admin'});
async function fixture(){
  const db=new MemoryUnitOfWork({tickets:[ticket({id:tid})],coverages:[coverage()]});
  let corrupt:(saved:StoredResult)=>StoredResult=r=>r;
  const uow:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,getIdempotency:async(op,key)=>{
    const saved=await s.getIdempotency(op,key);return saved===null?null:corrupt(structuredClone(saved));
  }}))};
  const observations:unknown[]=[];
  const handler=createHttpHandler({service:new HelpdeskService(uow,()=>new Date('2026-09-17T12:00:00Z')),
    authenticate:async()=>actor,observe:event=>{observations.push(event);}});
  const server=createServer(async(req,res)=>{try{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const body=Buffer.concat(chunks);const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
    const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(body.length?{body}:{})}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('{}');}});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();assert.ok(address&&typeof address==='object');
  const url='http://127.0.0.1:'+address.port+'/v1';
  return {db,observations,setCorruption:(fn:typeof corrupt)=>{corrupt=fn;},
    request:(path:string,method:string,body:unknown,key:string,version?:number)=>fetch(url+path,{method,
      headers:{'content-type':'application/json','idempotency-key':key,'x-request-id':randomUUID(),...(version?{'if-match':`"${version}"`}:{})},body:JSON.stringify(body)}),
    close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}

test('socket replay blocks mismatched private content with a safe error and no new writes',async()=>{
  const f=await fixture();try{
    const key=randomUUID(),path=`/tickets/${tid}/messages`,body={body:'Public reply permitted'};
    const first=await f.request(path,'POST',body,key);assert.equal(first.status,201);await first.arrayBuffer();
    const before=f.db.snapshot();
    f.setCorruption(saved=>({...saved,result:{...(saved.result as object),ticketId:randomUUID(),body:'SENTINEL-PRIVATE-OTHER-TENANT'}}));
    const retry=await f.request(path,'POST',body,key);const text=await retry.text();
    assert.equal(retry.status,503);assert.equal(JSON.parse(text).code,'invalid_idempotency_result');
    assert.equal(retry.headers.get('cache-control'),'no-store');assert.equal(retry.headers.get('idempotency-replayed'),null);
    assert.doesNotMatch(text,/SENTINEL|workspace-a|person-a/);
    assert.match(JSON.stringify(f.observations),/invalid_idempotency_result/);
    assert.doesNotMatch(JSON.stringify(f.observations),/SENTINEL|Public reply permitted/);
    assert.deepEqual(f.db.snapshot(),before);
  }finally{await f.close();}
});
test('socket inconsistent creation cache blocks duplicate creation and valid recovery preserves the first response',async()=>{
  const f=await fixture();try{
    const body={account_id:'account-a',product_instance_id:'geolab-production',service_code:'SUPPORT',subject:'Create requested ticket',description:'Only this account',priority:'normal'};
    const key=randomUUID();const first=await f.request('/tickets','POST',body,key);assert.equal(first.status,201);const original=await first.json();
    const before=f.db.snapshot();f.setCorruption(saved=>({...saved,result:{...(saved.result as object),accountId:'account-b'}}));
    const bad=await f.request('/tickets','POST',body,key);assert.equal(bad.status,503);await bad.arrayBuffer();
    assert.deepEqual(f.db.snapshot(),before);
    f.setCorruption(saved=>saved);
    const good=await f.request('/tickets','POST',body,key);assert.equal(good.status,200);assert.equal(good.headers.get('idempotency-replayed'),'true');
    assert.deepEqual(await good.json(),original);assert.deepEqual(f.db.snapshot(),before);
  }finally{await f.close();}
});
test('socket historical priority replay remains original and cannot embed current-action hints',async()=>{
  const f=await fixture();try{
    const path=`/tickets/${tid}`,key=randomUUID(),body={priority:'high',reason:'First classification'};
    const first=await f.request(path,'PATCH',body,key,1);assert.equal(first.status,200);const original=await first.json();
    const later=await f.request(path,'PATCH',{priority:'urgent',reason:'Later classification'},randomUUID(),2);assert.equal(later.status,200);await later.arrayBuffer();
    const before=f.db.snapshot();const repeat=await f.request(path,'PATCH',body,key,1);
    assert.equal(repeat.status,200);assert.deepEqual(await repeat.json(),original);assert.equal(f.db.snapshot().tickets[0]?.priority,'urgent');
    f.setCorruption(saved=>({...saved,result:{...(saved.result as object),available_actions:{reply:true}}}));
    const invalid=await f.request(path,'PATCH',body,key,1);assert.equal(invalid.status,503);await invalid.arrayBuffer();
    assert.deepEqual(f.db.snapshot(),before);
  }finally{await f.close();}
});
