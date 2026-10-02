import test from 'node:test';
import assert from 'node:assert/strict';
import {correlate} from '../supabase/tests/hosted-acceptance-scenarios.ts';
import {privateReceiptFixture} from './fixtures/private-receipt-correlation.ts';
import type {EffectRow} from './fixtures/postgres-acceptance-effects.ts';
const marker='PRIVATE_RECEIPT_MUTATION_MUST_NOT_APPEAR';

test('R18 real correlation accepts an unchanged synthetic private ledger',async()=>{
 const f=await privateReceiptFixture();await correlate(f.correlation,f.report);
});
for(const field of ['request_hash','created_at','policy','createdBy','assignedTo','workspaceId','accountId','subject','description','extra','message-body','message-actor','message-time']){
 test('R18 private correlation rejects receipt corruption in '+field+' without private values',async()=>{
  const f=await privateReceiptFixture(),accepted=f.correlation.accepted[field.startsWith('message-')?1:0]!;
  const receipt=f.current.receipts.find(r=>r.key===accepted.key)!;
  const result=receipt.result as EffectRow;
  if(field==='request_hash')receipt.request_hash='0'.repeat(64);
  else if(field==='created_at')receipt.created_at='2026-10-01T12:01:00.000Z';
  else if(field==='policy')(result.contractSnapshot as EffectRow).policy={marker};
  else if(field==='message-body')result.body=marker;
  else if(field==='message-actor')result.actorId=marker;
  else if(field==='message-time')result.createdAt='2026-10-01T12:01:00.000Z';
  else result[field]=marker;
  await assert.rejects(()=>correlate(f.correlation,f.report),error=>error instanceof Error&&!error.message.includes(marker));
 });
}

const observerPath='./fixtures/postgres-acceptance-effects.ts';
async function validator(){
 const mod=await import(observerPath);
 assert.equal(typeof mod.assertReceiptMatchesWrite,'function','Private receipt validation is not implemented');
 return mod.assertReceiptMatchesWrite as (snapshot:unknown,request:Request,actorId:string,resultId:string)=>Promise<EffectRow>;
}
for(const index of [0,1,2,3,4])test('R18 first confirmed mutation '+index+' matches request and persisted private resource',async()=>{
 const check=await validator(),f=await privateReceiptFixture(),s=f.samples[index]!;
 const receipt=await check(s.after,s.request,s.actorId,s.resultId);
 assert.deepEqual(receipt,f.correlation.accepted[index]!.expectedReceipt);
 (receipt.result as EffectRow).unexpected='copy-only';
 assert.equal(Object.hasOwn(s.after.receipts.find(r=>r.key===receipt.key)!.result as object,'unexpected'),false);
});
for(const corruption of ['hash','policy','timestamp','extra','request-body','wrong-resource','wrong-actor','duplicate'])test('R18 rejects initially inconsistent private receipt '+corruption,async()=>{
 const check=await validator(),f=await privateReceiptFixture(),s=f.samples[0]!,after=structuredClone(s.after);
 const target=after.receipts.find(r=>r.key===s.request.headers.get('idempotency-key'))!,result=target.result as EffectRow;
 let req=s.request,id=s.resultId,actor=s.actorId;
 if(corruption==='hash')target.request_hash='f'.repeat(64);
 if(corruption==='policy')(result.contractSnapshot as EffectRow).policy={marker};
 if(corruption==='timestamp')result.createdAt='2026-10-01T12:00:00.000001Z';
 if(corruption==='extra')result.extra=marker;
 if(corruption==='request-body')req=new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({...await req.clone().json(),description:marker})});
 if(corruption==='wrong-resource')id=f.report.machine!.resources.ticket_id!;
 if(corruption==='wrong-actor')actor=f.correlation.config.integrationId;
 if(corruption==='duplicate')after.receipts.push(structuredClone(target));
 await assert.rejects(()=>check(after,req,actor,id),e=>e instanceof Error&&e.message==='Private receipt correlation failed.'&&!e.message.includes(marker));
});
test('R18 equivalent explicit time zones are compared without losing microseconds or rewriting the receipt',async()=>{
 const check=await validator(),f=await privateReceiptFixture(),s=f.samples[0]!,after=structuredClone(s.after);
 const ticket=after.tickets.find(r=>r.id===s.resultId)!,receipt=after.receipts.find(r=>r.key===s.request.headers.get('idempotency-key'))!;
 ticket.created_at='2026-10-01T09:00:00.123456-03:00';ticket.updated_at=ticket.created_at;
 (receipt.result as EffectRow).createdAt='2026-10-01T12:00:00.123456Z';(receipt.result as EffectRow).updatedAt=(receipt.result as EffectRow).createdAt;
 const first=await check(after,s.request,s.actorId,s.resultId);
 assert.equal((first.result as EffectRow).createdAt,'2026-10-01T12:00:00.123456Z');
 (receipt.result as EffectRow).updatedAt='2026-10-01T12:00:00.123457Z';
 await assert.rejects(()=>check(after,s.request,s.actorId,s.resultId),/Private receipt correlation failed/);
});
