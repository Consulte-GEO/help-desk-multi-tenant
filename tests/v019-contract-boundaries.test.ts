import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCoverage} from '../src/domain/contracts.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import type {UnitOfWork} from '../src/application/ports.ts';
import type {Coverage} from '../src/domain/model.ts';
import {coverage,principal} from './fixtures.ts';

const at='2026-09-17T12:00:00.123Z';
const context={accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT'};
const input={...context,subject:'Vigência contratual exata',description:'Fixture exclusivamente local',priority:'normal' as const};
const key='v019-valid-creation-key';
function service(source:unknown){
 const db=new MemoryUnitOfWork({coverages:[coverage()]});
 const uow:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,coverages:async()=>source as Coverage[]}))};
 return {db,api:new HelpdeskService(uow,()=>new Date(at))};
}

test('future start within this millisecond must not grant coverage',()=>{
 assert.equal(resolveCoverage([coverage({validFrom:'2026-09-17T12:00:00.123456Z'})],at).status,'no_coverage');
});
test('expiry later in this millisecond keeps coverage eligible until the exact exclusive boundary',()=>{
 const c=coverage({validUntil:'2026-09-17T12:00:00.123456Z'});
 assert.equal(resolveCoverage([c],at).status,'resolved');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123455Z').status,'resolved');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123456Z').status,'no_coverage');
});
test('a one-microsecond contractual interval is neither empty nor rounded',()=>{
 const c=coverage({validFrom:'2026-09-17T12:00:00.123456Z',validUntil:'2026-09-17T12:00:00.123457Z'});
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123455Z').status,'no_coverage');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123456Z').status,'resolved');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123457Z').status,'no_coverage');
});
test('explicit non-UTC offset and fractional digits keep exact entitlement boundaries',()=>{
 const c=coverage({validFrom:'2026-09-17T09:00:00.123001-03:00',validUntil:'2026-09-17T14:00:00.123002+02:00'});
 assert.equal(resolveCoverage([c],at).status,'no_coverage');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123001Z').status,'resolved');
 assert.equal(resolveCoverage([c],'2026-09-17T12:00:00.123002Z').status,'no_coverage');
});
test('same-day equivalent representations preserve boundaries without rewriting candidates',()=>{
 const c=coverage({validFrom:'2026-09-17T09:00:00.123-03:00',validUntil:null});
 const original=structuredClone(c);const result=resolveCoverage([c],at);
 assert.equal(result.status,'resolved');assert.deepEqual(result.candidates[0],original);assert.deepEqual(c,original);
});
test('an impossible comparison clock is rejected rather than rolled into March',()=>{
 assert.throws(()=>resolveCoverage([coverage()],'2026-02-30T12:00:00Z'));
});
test('a date without explicit timezone cannot decide contractual eligibility',()=>{
 assert.throws(()=>resolveCoverage([coverage()],'2026-09-17T12:00:00'));
});
test('submillisecond future contract cannot create a ticket, event, outbox or receipt',async()=>{
 const f=service([coverage({validFrom:'2026-09-17T12:00:00.123456Z'})]);const before=f.db.snapshot();
 await assert.rejects(()=>f.api.create(principal(),input,key,'v019'),{code:'no_coverage',status:422});
 assert.deepEqual(f.db.snapshot(),before);
});
test('nonempty invalid coverage result is not no_coverage or a selectable candidate',async()=>{
 for(const source of [null,{},[null],[coverage({enabled:'false'} as unknown as Partial<Coverage>)],
  [coverage({published:'false'} as unknown as Partial<Coverage>)]]){
  const f=service(source);
  await assert.rejects(()=>f.api.resolve(principal(),context),{code:'invalid_coverage_result',status:503});
 }
});
for(const [field,value] of [
 ['workspaceId','workspace-other'],['accountId','account-other'],['productInstanceId','school-other'],
 ['serviceCode','OTHER'],['id',''],['contractId',null],['contractVersionId',17],
 ['contractVersion',0],['contractVersion','1'],['contractStatus','ACTIVE'],
 ['validFrom','2026-02-30T00:00:00Z'],['validFrom','2026-01-01T00:00:00'],
 ['validUntil','2027-02-30T00:00:00Z'],['validUntil','2025-01-01T00:00:00Z'],
 ['validUntil','2026-01-01T00:00:00Z'],['policy',null],['policy',{bad:Number.NaN}],
 ['policy',{body:'x'.repeat(17000)}],
] as const){
 test(`coverage boundary refuses incompatible ${field} before creating any resource (${String(value).slice(0,32)})`,async()=>{
  const f=service([coverage({[field]:value} as unknown as Partial<Coverage>)]);const before=f.db.snapshot();
  await assert.rejects(()=>f.api.create(principal(),input,key,'v019'),{code:'invalid_coverage_result',status:503});
  assert.deepEqual(f.db.snapshot(),before);
 });
}
test('duplicate coverage identifiers and oversized configuration are rejected as a whole',async()=>{
 for(const source of [[coverage(),coverage()],Array.from({length:101},(_,i)=>coverage({id:`coverage-${i}`}))]){
  const f=service(source);
  await assert.rejects(()=>f.api.resolve(principal(),context),{code:'invalid_coverage_result',status:503});
 }
});
test('a malformed second row cannot be ignored when an eligible selected row exists',async()=>{
 const f=service([coverage(),coverage({id:'other',validFrom:'2026-02-30T00:00:00Z'})]);const before=f.db.snapshot();
 await assert.rejects(()=>f.api.create(principal(),{...input,coverageId:'coverage-a'},key,'v019'),{code:'invalid_coverage_result'});
 assert.deepEqual(f.db.snapshot(),before);
});
test('valid empty, disabled, suspended and multiple contexts remain distinct from corruption',async()=>{
 assert.equal((await service([]).api.resolve(principal(),context)).status,'no_coverage');
 for(const c of [coverage({enabled:false}),coverage({published:false}),coverage({contractStatus:'suspended'}),coverage({contractStatus:'terminated'})]){
  assert.equal((await service([c]).api.resolve(principal(),context)).status,'no_coverage');
 }
 assert.equal((await service([coverage(),coverage({id:'other'})]).api.resolve(principal(),context)).status,'ambiguous');
});
test('authorized replay after contract expiry does not resolve current entitlement or duplicate creation',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage()]});let now=new Date(at),calls=0;
 const uow:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,coverages:async c=>{calls++;return s.coverages(c);}}))};
 const api=new HelpdeskService(uow,()=>now);const first=await api.create(principal(),input,key,'v019');
 now=new Date('2028-01-01T00:00:00Z');const before=db.snapshot();
 const repeated=await api.create(principal(),input,key,'v019');
 assert.equal(repeated.replayed,true);assert.deepEqual(repeated.ticket,first.ticket);assert.equal(calls,1);assert.deepEqual(db.snapshot(),before);
});
