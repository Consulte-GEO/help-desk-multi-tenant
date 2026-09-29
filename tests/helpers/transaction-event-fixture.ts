/** Synthetic driver boundary plus real EventEmitter events. Not a PostgreSQL test. */
import {EventEmitter} from 'node:events';
import type {SqlClient,SqlPool,SqlResult} from '../../src/infrastructure/sql.ts';
export const rawFailure=()=>Error('PRIVATE_TRANSACTION_SENTINEL synthetic confidential driver detail');
export type Fault='none'|'begin'|'settings'|'work'|'commit'|'rollback'|'release';
export function transactionEventFixture(fault:Fault='none'){
 const emitter=new EventEmitter();const calls:string[]=[],releases:(Error|undefined)[]=[];
 let connects=0,workCount=0;
 const client=Object.assign(emitter,{
  async query(sql:string,_values?:unknown[]):Promise<SqlResult>{
   calls.push(sql);
   const at:Fault=sql==='BEGIN'?'begin':sql==='COMMIT'?'commit':sql==='ROLLBACK'?'rollback':sql.includes('set_config')?'settings':'work';
   if(at==='work')workCount++;
   if(at===fault)await new Promise<void>(resolve=>setImmediate(()=>{emitter.emit('error',rawFailure());resolve();}));
   return {command:sql.split(' ')[0]!.toUpperCase(),rows:[{answer:42}],rowCount:1};
  },
  release(error?:Error){releases.push(error);if(fault==='release')emitter.emit('error',rawFailure());}
 }) satisfies SqlClient;
 const pool:SqlPool={connect:async()=>{connects++;return client;},
  query:async()=>{throw Error('Raw pool query must not be used');},end:async()=>{}};
 return {client,pool,calls,releases,state:()=>({connects,workCount})};
}
