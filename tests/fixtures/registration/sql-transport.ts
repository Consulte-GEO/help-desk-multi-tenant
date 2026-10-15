/** Synthetic driver protocol only. The caller imports the REAL core transaction
 * owner and HDA store. This does not execute SQL or prove PostgreSQL locks/RLS. */
import type {SqlClient,SqlPool,SqlResult} from '../../../src/infrastructure/sql.ts';
import {id,input} from './sample.ts';
import {createRegistrationInputSnapshot} from '../../../src/domain/registration-contracts.ts';
import type {RegistrationPermission,RegistrationScopeRequest} from '../../../src/domain/registration-persistence.ts';
export const identity=()=>({workspaceId:id(1),accountId:id(2),actorId:id(21),bindingId:id(30)});
export const scope=(permission:RegistrationPermission='read'):RegistrationScopeRequest=>({...identity(),permission});
export const lockedScope=(s=scope())=>({...s,actorKind:s.actorId===id(20)?'human':'analyzer',bindingRevision:1,targetHash:createRegistrationInputSnapshot(input()).targetHash,ticketId:id(11),databaseNow:'2026-10-14T12:00:00.000Z',expiresAt:'2026-10-14T13:00:00.000Z'});
export const select=(result:unknown):SqlResult=>({command:'SELECT',rowCount:1,rows:[{result}]});
export function deferred<T>() {let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
export type QueryCall={connection:number;sql:string;values:unknown[]};
export function protocolFixture() {
 const calls:QueryCall[]=[],releases:{connection:number;error:Error|undefined}[]=[];
 const replies:unknown[]=[];
 let acquisitions=0,ends=0;
 const hooks:{connect?:(connection:number)=>Promise<void>;before?:(call:QueryCall)=>Promise<void>;respond?:(call:QueryCall)=>Promise<SqlResult|undefined>;after?:(call:QueryCall,result:SqlResult)=>Promise<void>;release?:(connection:number)=>void}={};
 const pool:SqlPool={
  async connect(){const connection=++acquisitions;await hooks.connect?.(connection);
   const c:SqlClient={
    async query(sql,values=[]){const call={connection,sql,values:structuredClone(values)};calls.push(call);await hooks.before?.(call);let response=await hooks.respond?.(call);
     if(!response){if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))response={command:sql,rowCount:null,rows:[]};
      else if(sql.startsWith("select set_config('app.workspace_id'"))response={command:'SELECT',rowCount:1,rows:[{}]};
      else {if(!replies.length)throw Error('Fixture missing reply for '+sql);response=select(replies.shift());}}
     await hooks.after?.(call,response);return response;
    },
    release(error){releases.push({connection,error});hooks.release?.(connection);}
   };return c;
  },
  async query(){throw Error('A transaction must borrow a client, not use pool.query');},
  async end(){ends++;}
 };
 return {pool,calls,releases,replies,hooks,get acquisitions(){return acquisitions;},get ends(){return ends;}};
}
