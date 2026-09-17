import test from 'node:test';
import assert from 'node:assert/strict';
import {zonedInstantMicros} from '../shared/instant.js';
import {resolveCoverage} from '../src/domain/contracts.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {coverage,principal} from './fixtures.ts';

test('offset parser uses exact fractions and does not depend on local timezone',()=>{
 const base=zonedInstantMicros('2026-09-17T12:00:00Z');assert.ok(base!==undefined);
 for(let places=1;places<=6;places++){
  const fraction='123456'.slice(0,places);
  const expected:bigint=base+BigInt(fraction.padEnd(6,'0'));
  assert.equal(zonedInstantMicros(`2026-09-17T12:00:00.${fraction}Z`),expected);
  assert.equal(zonedInstantMicros(`2026-09-17T09:00:00.${fraction}-03:00`),expected);
  assert.equal(zonedInstantMicros(`2026-09-17T17:45:00.${fraction}+05:45`),expected);
 }
});
test('offset parser rejects rollovers, implicit timezone and unsupported submicrosecond precision',()=>{
 for(const value of ['2026-02-29T00:00:00Z','2026-02-30T00:00:00Z','2026-04-31T00:00:00Z',
  '2026-09-17T24:00:00Z','2026-09-17T23:59:60Z','2026-09-17T12:00:00','2026-09-17',
  '2026-09-17T12:00:00+24:00','2026-09-17T12:00:00+02:60','2026-09-17T12:00:00.1234567Z',
  '0000-01-01T00:00:00Z',null,true,{},new Date(),Infinity]){
  assert.equal(zonedInstantMicros(value),undefined);
 }
 assert.notEqual(zonedInstantMicros('2024-02-29T00:00:00Z'),undefined);
});
test('empty and reversed periods are invalid data, not a purchasable entitlement',()=>{
 for(const end of ['2026-01-01T00:00:00Z','2025-01-01T00:00:00Z']){
  assert.throws(()=>resolveCoverage([coverage({validUntil:end})],'2026-09-17T12:00:00Z'));
 }
});
test('malformed foreign coverage does not poison the authorized memory catalog',async()=>{
 const p=principal();const db=new MemoryUnitOfWork({coverages:[coverage(),coverage({id:'other',workspaceId:'foreign',accountId:'secret',validFrom:'not-a-date'})],
 supportContexts:[{workspaceId:p.workspaceId,accountId:'account-a',accountName:'Cliente A',productInstanceId:'geolab-production',
 productName:'Sistema A',environment:'production',serviceCode:'SUPPORT',serviceName:'Suporte'}]});
 const result=await new HelpdeskService(db,()=>new Date('2026-09-17T12:00:00Z')).supportContexts(p,{limit:50});
 assert.equal(result.items.length,1);assert.equal(result.items[0]?.accountId,'account-a');
});
