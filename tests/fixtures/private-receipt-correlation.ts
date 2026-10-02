/** Deliberately synthetic SQL-shaped data derived from the reference in-memory handler.
 * This exercises the real comparison, not the PostgreSQL driver, triggers or SQL query. */
import assert from 'node:assert/strict';
import {hostedFixture,uuid} from './hosted-acceptance-fixture.ts';
import {runHostedWriteAcceptance} from '../../scripts/hosted-write-acceptance-core.ts';
import type {HostedWriteFixture} from '../../scripts/hosted-write-acceptance-core.ts';
import type {HostedFixture} from '../../scripts/hosted-acceptance-core.ts';
import type {MemoryState} from '../../src/infrastructure/memory.ts';
import type {EffectSnapshot,EffectRow} from './postgres-acceptance-effects.ts';
const physical=(row:object):EffectRow=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),structuredClone(value)]));
function snapshot(s:MemoryState):EffectSnapshot{
 const outbox=s.outbox.map(row=>({...physical(row),dispatched_at:null}));
 const effects=s.events.map((event,i)=>{
  const {reason,...data}=event.data;
  const version=event.type==='ticket.created'?1:event.type==='ticket.priority_changed'?3:2;
  return {workspace_id:event.workspaceId,id:uuid(30000+i),account_id:event.accountId,ticket_id:event.ticketId,actor_id:event.actorId,
   transaction_id:String(100+i),kind:event.type,ticket_version:version,source_id:event.data.messageId??event.data.noteId??null,
   expected_data:structuredClone(data),applied:true,event_id:event.id,created_at:event.createdAt};
 });
 return {tickets:s.tickets.map(physical),messages:s.messages.map(physical),notes:s.notes.map(physical),events:s.events.map(physical),outbox,
  receipts:s.idempotency.map(r=>({workspace_id:r.workspaceId,principal_id:r.principalId,operation:r.operation,key:r.key,request_hash:r.hash,
   result:structuredClone(r.result),created_at:'2026-10-01T12:00:00.000Z'})),audit:[],effects};
}
export async function privateReceiptFixture(){
 const base=await hostedFixture(),baseline=snapshot(base.db.snapshot());
 const config:HostedWriteFixture={schema:1,readFixture:base.config as HostedFixture,executionId:uuid(31000),coverageId:uuid(401),includeMachineWrites:true};
 const accepted:{key:string;requestId:string;actorId:string;kind:string;ticketId:string;expectedReceipt:EffectRow}[]=[];
 const samples:{request:Request;workspaceId:string;actorId:string;resultId:string;after:EffectSnapshot}[]=[];
 const send:typeof fetch=async(input,init)=>{
  const req=new Request(input,init),original=req.clone(),response=await base.fetcher(req);
  const key=req.headers.get('idempotency-key');
  if(key&&response.ok&&response.headers.get('idempotency-replayed')==='false'){
   const dto=await response.clone().json() as EffectRow,path=new URL(req.url).pathname;
   const kind=path==='/v1/tickets'?'ticket.created':path.endsWith('/messages')?'message.created':'ticket.priority_changed';
   const actor=base.people[req.headers.get('authorization')!.slice(7)]!;
   const after=snapshot(base.db.snapshot()),receipt=after.receipts.find(r=>r.key===key&&r.principal_id===actor.id)!;
   accepted.push({key,requestId:req.headers.get('x-request-id')!,actorId:actor.id,kind,ticketId:String(dto.ticket_id??dto.id),expectedReceipt:structuredClone(receipt)});
   samples.push({request:original,workspaceId:base.config.workspaceId,actorId:actor.id,resultId:String(dto.id),after});
  }
  return response;
 };
 const plan=await runHostedWriteAcceptance(config);
 const report=await runHostedWriteAcceptance(config,base.tokens,{execute:true,allowTicketMutations:true,confirmOrigin:config.readFixture.origin,
  confirmConfigSha256:plan.config_sha256,fetcher:send});
 assert.equal(report.status,'passed');
 const current=snapshot(base.db.snapshot());
 const correlation={baseline,accepted,config:config.readFixture,contracts:[{id:uuid(701),versionId:uuid(801),coverageId:uuid(401),policy:{}}],read:async()=>current};
 return {correlation,report,current,samples};
}
