/** Controlled persistence/authority for tests ONLY. Not a deployable adapter. */
import {createResourceAccessResolver} from '../../src/application/resource-access.ts';
export const sid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const NOW='2026-10-10T10:00:00.000000Z',LATER='2026-10-10T11:00:00.000000Z';
export function supportIo(initial:()=>any){
 const p:any={id:sid(2),workspaceId:sid(1),kind:'human',workspaceRole:null,grants:[{accountId:sid(3),role:'requester'}],scopes:['tickets:read','tickets:write']};
 const refs=[{connectionId:sid(4),tenantId:'T1',type:'work',id:'A'}];let current=initial(),stage:any,time=NOW,tail=Promise.resolve();let unlock=()=>{};
 const controls={revoked:false,loseCommit:false,failWrite:false,afterWrite:()=>{},queries:[] as string[]};
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:3600000000n,timeoutMs:5000,clock:()=>time,authority:{readAccess:async q=>controls.revoked?null:{principal:p,binding:{id:sid(5),workspaceId:p.workspaceId,accountId:sid(3),connectionId:sid(4),tenantId:'T1',revision:'1',active:true},operation:q.operation,manifestFingerprint:'a'.repeat(64),accessRevision:'1',asOf:NOW,expiresAt:LATER,resources:refs}}});
 const pool:any={connect:async()=>{const before=tail;tail=new Promise(r=>{const previous=unlock;unlock=()=>{r();};void previous;});const release=unlock;await before;return {query:async(sql:string)=>{controls.queries.push(sql);if(sql==='BEGIN')stage=structuredClone(current);if(sql==='COMMIT'){current=stage;if(controls.loseCommit){controls.loseCommit=false;throw Error('lost confirmation');}}return {command:sql.startsWith('select')?'SELECT':sql,rowCount:0,rows:[]};},release};},query:async()=>{throw Error('No escape from borrowed connection');},end:async()=>{}};
 return {p,refs,pool,resolver,controls,current:()=>current,stage:()=>stage,clock:()=>time,time:(v:string)=>{time=v;},write:async(c:any)=>{await c.query('update candidate state');if(controls.failWrite)throw Error('private write detail');controls.afterWrite();}};
}
