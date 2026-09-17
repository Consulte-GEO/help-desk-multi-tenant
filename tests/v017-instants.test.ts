import test from 'node:test';
import assert from 'node:assert/strict';
import {isCanonicalInstant,canonicalInstant,compareInstants} from '../shared/instant.js';
import {validateTicketReplay} from '../src/application/replay-result.ts';
import {pagination,page} from '../src/application/pagination.ts';
import {ticket} from './fixtures.ts';

const base='2026-09-17T12:00:00.';
test('UTC normalization retains microseconds and preserves the legacy millisecond format when exact',()=>{
 for(const [input,expected] of [['000000','000'],['123000','123'],['123001','123001'],['123999','123999'],['999999','999999']]){
  assert.equal(canonicalInstant(base+input+'Z'),base+expected+'Z');
 }
 assert.equal(canonicalInstant(new Date(base+'123Z')),base+'123Z');
 assert.equal(canonicalInstant(base+'123Z'),base+'123Z');
});
test('calendar and input validation reject coercion, offsets, unsupported precision and rollovers',()=>{
 const bad:unknown[]=[null,undefined,0,{},[],new Date(),'', 'Infinity','2026-02-29T00:00:00.000Z','2026-02-30T00:00:00.000001Z',
 '2026-13-01T00:00:00.000Z','2026-01-01T24:00:00.000Z','2026-01-01T23:59:60.000Z','0000-01-01T00:00:00.000Z',
 '2026-09-17T12:00:00.1234567Z','2026-09-17T12:00:00.123456+00:00','2026-09-17T12:00:00Z',
 '2026-09-17T12:00:00.12Z','2026-09-17T12:00:00.12345Z','+010000-01-01T00:00:00.000Z'];
 for(const value of bad)assert.equal(isCanonicalInstant(value),false,String(value));
 for(const value of bad.filter(v=>!(v instanceof Date)))assert.throws(()=>canonicalInstant(value),TypeError);
 assert.throws(()=>canonicalInstant(new Date(NaN)),TypeError);
 assert.throws(()=>compareInstants('2026-02-30T00:00:00.000Z',base+'123Z'),TypeError);
});
test('exact ordering crosses second, day, year and leap-day boundaries without numeric rounding',()=>{
 const ordered=['0001-01-01T00:00:00.000001Z','2024-02-28T23:59:59.999999Z','2024-02-29T00:00:00.000Z',
 '2024-02-29T23:59:59.999999Z','2024-03-01T00:00:00.000Z','2025-12-31T23:59:59.999999Z',
 '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000001Z','2026-01-01T00:00:00.999999Z','2026-01-01T00:00:01.000Z',
 '9999-12-31T23:59:59.999999Z'];
 for(let i=0;i<ordered.length;i++){assert.equal(isCanonicalInstant(ordered[i]),true);for(let j=i+1;j<ordered.length;j++){
  assert.equal(compareInstants(ordered[i]!,ordered[j]!),-1);assert.equal(compareInstants(ordered[j]!,ordered[i]!),1);
 }}
 assert.equal(compareInstants(base+'123Z',base+'123000Z'),0);
});
test('deterministic microsecond range comparison agrees with an independent BigInt oracle',()=>{
 const origin=BigInt(Date.parse('2026-09-17T12:00:00.000Z'))*1000n;
 const oracle=(fraction:number)=>origin+BigInt(fraction);
 const value=(fraction:number)=>canonicalInstant(base+String(fraction).padStart(6,'0')+'Z');
 for(let i=0;i<1000;i++){
  const a=(i*977)%1000000,b=(i*4357)%1000000;
  const expected=oracle(a)===oracle(b)?0:oracle(a)<oracle(b)?-1:1;
  assert.equal(compareInstants(value(a),value(b)),expected);
 }
});
test('legacy three-digit cursor retains timestamp and scope without a format migration',()=>{
 const context={workspace:'a',query:'one'};const {filter}=pagination({limit:1},context);
 const first=page([{id:'two',createdAt:base+'123Z'},{id:'one',createdAt:base+'122Z'}],1,filter);
 const decoded=pagination({limit:1,cursor:first.nextCursor!},context);
 assert.equal(decoded.window.cursor?.at,base+'123Z');
 assert.throws(()=>pagination({limit:1,cursor:first.nextCursor!},{workspace:'b',query:'one'}),{code:'invalid_cursor'});
});
test('replay accepts identical three/six-digit instants without rewriting the stored original',()=>{
 const original=ticket({createdAt:base+'123Z'}),current=ticket({createdAt:base+'123000Z'});
 const before=structuredClone(original);assert.doesNotThrow(()=>validateTicketReplay(original,current));assert.deepEqual(original,before);
 assert.doesNotThrow(()=>validateTicketReplay(ticket({createdAt:'2026-09-17T09:00:00.123-03:00'}),current));
 assert.throws(()=>validateTicketReplay(original,ticket({createdAt:base+'123001Z'})),{code:'invalid_idempotency_result'});
});
test('replay refuses impossible historical dates normalized by JavaScript',()=>{
 assert.throws(()=>validateTicketReplay(ticket({createdAt:'2026-02-30T12:00:00.123Z'}),ticket({createdAt:'2026-03-02T12:00:00.123Z'})),{code:'invalid_idempotency_result'});
});
test('historical offset snapshots compare exact microseconds without changing the original representation',()=>{
 const original=ticket({createdAt:'2026-09-17T09:00:00.123456-03:00'}),current=ticket({createdAt:base+'123456Z'});
 const before=structuredClone(original);assert.doesNotThrow(()=>validateTicketReplay(original,current));assert.deepEqual(original,before);
 assert.throws(()=>validateTicketReplay(original,ticket({createdAt:base+'123457Z'})),{code:'invalid_idempotency_result'});
});
