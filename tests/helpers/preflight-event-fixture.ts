/** Controlled SQL/EventEmitter fixture, NOT PostgreSQL or a TLS handshake. */
import {EventEmitter} from 'node:events';
import {TLSSocket} from 'node:tls';
import {Socket} from 'node:net';
import type {SqlClient,SqlPool,SqlResult} from '../../src/infrastructure/sql.ts';
import {READINESS_FLAGS} from '../../src/infrastructure/database-security.ts';
import {DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/database-security-contract.ts';
export const fixtureConfig={databaseUrl:'postgresql://helpdesk_app:fixture_password@pooler.invalid/postgres',
 supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture',rateLimitHmacKey:'f'.repeat(43),releaseApproved:'false'};
export type EventMode='none'|'async-query'|'after-query'|'release'|'pool-end'|'pool-before-connect'|'query-rejection';
export function eventFixture(mode:EventMode){
 const events=new EventEmitter(),poolEvents=new EventEmitter(),socket=new TLSSocket(new Socket());
 socket.authorized=true;const calls:string[]=[];let releases=0,ends=0,connects=0,emitted=false;
 const failure=()=>Error('PRIVATE_DIAGNOSTIC_SENTINEL postgresql://private:fixture_password@pooler.invalid');
 const emit=()=>{emitted=true;events.emit('error',failure());};
 const role={name:'helpdesk_app',login_name:'helpdesk_app',superuser:false,bypass_rls:false,owns_tables:false,
  owns_objects:false,create_role:false,create_database:false,replication:false,member_of_roles:false};
 const security={table_count:DATABASE_SECURITY_CONTRACT.tables.length,unsafe_tables:0,public_schema_access:false,
  client_schema_access:false,public_helper_execute:false,...Object.fromEntries(READINESS_FLAGS.map(k=>[k,true]))};
 const query=async(sql:string):Promise<SqlResult>=>{
  calls.push(sql);
  if(!emitted&&mode==='async-query')return new Promise((_resolve,reject)=>setImmediate(()=>{emit();reject(failure());}));
  if(!emitted&&mode==='after-query')emit();
  if(!emitted&&mode==='query-rejection'){emitted=true;throw failure();}
  if(sql.startsWith('BEGIN'))return {command:'BEGIN',rows:[],rowCount:null};
  if(sql==='ROLLBACK')return {command:'ROLLBACK',rows:[],rowCount:null};
  if(sql.startsWith('SET LOCAL'))return {command:'SET',rows:[],rowCount:null};
  let row:Record<string,unknown>;
  if(sql.includes("current_setting('transaction_read_only')"))row={read_only:'on'};
  else if(sql.includes('session_user as login_name'))row=role;
  else if(sql.includes('helpdesk_auth.schema_version()'))row={version:'0.22.0'};
  else if(sql.includes('expected_tables'))row=security;
  else throw Error('Unexpected fixture query');
  return {command:'SELECT',rows:[row],rowCount:1};
 };
 const client=Object.assign(events,{query,connection:{stream:socket},release(){
  releases++;socket.destroy();if(mode==='release')emit();
 }}) satisfies SqlClient;
 const pool:SqlPool={on:(name,listener)=>poolEvents.on(name,listener),
  connect:async()=>{connects++;if(mode==='pool-before-connect')poolEvents.emit('error',failure());return client;},
  query:async()=>{throw Error('Pool query forbidden');},
  end:async()=>{ends++;socket.destroy();if(mode==='pool-end')emit();}};
 return {pool,client,calls,close:()=>socket.destroy(),state:()=>({releases,ends,connects})};
}
