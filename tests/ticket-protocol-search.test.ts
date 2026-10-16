import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {principal,ticket} from './fixtures.ts';
import type {Ticket} from '../src/domain/model.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p=principal({id:id(1)});
const entry=(protocol:string,overrides:Partial<Ticket>={})=>ticket({id:id(2),createdBy:p.id,subject:'Solicitação sem o identificador no assunto',consulteGeo:{protocol,profileVersionId:'cg-wf-'+id(4)+'-v1',workflow:true,requesterId:p.id},...overrides});

// Removing protocol matching must make the positive assertions below fail.
test('HTTP finds a full CG protocol case-insensitively before pagination, not its prefix or digits',async()=>{
 const old=entry('CG-10001',{createdAt:'2026-09-01T00:00:00Z'});
 const newer=Array.from({length:30},(_,i)=>ticket({id:id(100+i),createdBy:p.id,createdAt:'2026-10-01T00:00:00Z'}));
 const service=new HelpdeskService(new MemoryUnitOfWork({tickets:[...newer,old]}));
 const h=createHttpHandler({service,authenticate:async()=>p});
 for(const q of ['CG-10001',' cg-10001 ']){
  const response=await h(new Request('https://helpdesk.test/v1/tickets?limit=1&q='+encodeURIComponent(q)));
  assert.equal(response.status,200);const body=await response.json();
  assert.deepEqual(body.items.map((t:any)=>t.id),[id(2)]);assert.equal(body.next_cursor,null);
 }
 for(const q of ['CG-1000','10001','CG-10001%','CG-100010'])assert.equal((await service.list(p,{limit:1,q})).items.length,0,q);
});

test('protocol search combines filters and preserves ownership, account, workspace and revocation',async()=>{
 const visible=entry('CG-10001',{status:'open',priority:'high'}),db=new MemoryUnitOfWork({tickets:[visible,
  entry('CG-10002',{id:id(3),createdBy:id(99)}),entry('CG-10003',{id:id(4),accountId:'account-b'}),entry('CG-10004',{id:id(5),workspaceId:'workspace-b'})]}),service=new HelpdeskService(db);
 assert.deepEqual((await service.list(p,{limit:1,q:'CG-10001',status:'in_progress',priority:'high'})).items.map(t=>t.id),[id(2)]);
 assert.equal((await service.list(p,{limit:1,q:'CG-10001',priority:'low'})).items.length,0);
 for(const q of ['CG-10002','CG-10003','CG-10004'])assert.deepEqual(await service.list(p,{limit:1,q}),{items:[],nextCursor:null});
 assert.deepEqual(await service.list({...p,grants:[]},{limit:1,q:'CG-10001'}),{items:[],nextCursor:null});
});

test('a cursor from a subject result cannot be reused for a protocol search',async()=>{
 const service=new HelpdeskService(new MemoryUnitOfWork({tickets:[entry('CG-10001'),entry('CG-10002',{id:id(3)})]}));
 const first=await service.list(p,{limit:1,q:'Solicitação'});assert.ok(first.nextCursor);
 await assert.rejects(()=>service.list(p,{limit:1,q:'CG-10001',cursor:first.nextCursor!}),{code:'invalid_cursor'});
});
