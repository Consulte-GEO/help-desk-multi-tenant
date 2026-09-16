import test from 'node:test';import assert from 'node:assert/strict';
import {identifier} from '../src/http/validation.ts';import {problemResponse} from '../src/http/handler.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';import {principal} from './fixtures.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
test('UUID selectors are canonicalized without changing case-sensitive opaque identifiers',()=>{assert.equal(identifier('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'),'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');assert.equal(identifier('Account-ABC'),'Account-ABC');});
for(const code of ['08006','53300','57P01','57P02','57P03','ECONNRESET','ECONNREFUSED','ETIMEDOUT'])test(`database transport failure ${code} is safe retryable unavailability`,async()=>{const res=problemResponse({code,message:'postgresql://secret@internal-db'},'request');assert.equal(res.status,503);assert.equal(res.headers.get('retry-after'),'2');assert.doesNotMatch(await res.text(),/secret|internal-db/);});
test('pool acquisition errors become safe unavailability instead of exposing infrastructure',async()=>{const pool:SqlPool={query:async()=>({rows:[],rowCount:0}),connect:async()=>{throw Error('sensitive infrastructure');},end:async()=>{}};await assert.rejects(()=>new PostgresUnitOfWork(pool).run(principal(),async()=>1),{code:'database_unavailable',status:503});});
test('idle pooled connection errors are observed without secrets and logging failure cannot crash the callback',async()=>{
 const {observePoolErrors}=await import('../src/infrastructure/postgres.ts');assert.equal(typeof observePoolErrors,'function');
 let callback:(e:Error)=>void=()=>assert.fail('listener not installed');const events:unknown[]=[];
 const pool:SqlPool={query:async()=>({rows:[],rowCount:0}),connect:async()=>{throw Error();},end:async()=>{},on:(_event,listener)=>{callback=listener;}};
 observePoolErrors(pool,e=>events.push(e));callback(Error('postgres://secret'));assert.doesNotMatch(JSON.stringify(events),/secret/);assert.equal(events.length,1);
 observePoolErrors(pool,()=>{throw Error('logger');});assert.doesNotThrow(()=>callback(Error('network')));
});
