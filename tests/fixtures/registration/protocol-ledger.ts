/** A transactional DRIVER DOUBLE for the five fixed HDA helper calls. Never use
 * outside tests. No SQL is parsed/executed and no DB authorization is proved. */
import {protocolFixture,lockedScope,select} from './sql-transport.ts';
import {registrationHash} from '../../../src/domain/registration-canonical.ts';
export function protocolLedger(){
 const f=protocolFixture();
 type Ledger={record:any;receipts:Map<string,any>};
 let committed:Ledger={record:null,receipts:new Map()};
 const active=new Map<number,Ledger>();
 let now='2026-10-14T12:00:00.000Z';
 const clone=<T>(x:T)=>structuredClone(x);
 const receiptKey=(s:any,commandId:string)=>s.workspaceId+':'+s.actorId+':'+commandId;
 f.hooks.respond=async c=>{
  if(c.sql==='BEGIN'){active.set(c.connection,clone(committed));return {command:'BEGIN',rowCount:null,rows:[]};}
  if(c.sql==='COMMIT'){if(!active.has(c.connection))throw Error('No synthetic transaction');committed=active.get(c.connection)!;active.delete(c.connection);return {command:'COMMIT',rowCount:null,rows:[]};}
  if(c.sql==='ROLLBACK'){active.delete(c.connection);return {command:'ROLLBACK',rowCount:null,rows:[]};}
  if(c.sql.startsWith('select set_config'))return undefined;
  const data=active.get(c.connection);if(!data)throw Error('SQL double accessed outside a transaction');
  const s=JSON.parse(c.values[0] as string);
  if(c.sql.includes('hda02_lock_scope'))return select({...lockedScope(s),databaseNow:now});
  if(c.sql.includes('hda02_receipt'))return select(clone(data.receipts.get(receiptKey(s,c.values[1] as string))??null));
  if(c.sql.includes('hda02_operation'))return select(data.record?.state.snapshot.operationId===c.values[1]?{...clone(data.record),databaseNow:now}:null);
  if(c.sql.includes('hda02_next'))return select(data.record&&(data.record.queue.status==='queued'||data.record.queue.status==='leased'&&data.record.queue.lease.expiresAt<=now)?{...clone(data.record),databaseNow:now}:null);
  if(c.sql.includes('hda02_apply')){
   const write=JSON.parse(c.values[1] as string),next=write.next;
   if((data.record?.state.revision??0)!==write.expectedRevision)throw Object.assign(Error('Synthetic conflict'),{code:'HDJ02'});
   const key=receiptKey(s,write.command.commandId);if(data.receipts.has(key))throw Object.assign(Error('Synthetic conflict'),{code:'HDJ04'});
   const receipt={schema:1,commandId:write.command.commandId,commandHash:write.commandHash,permission:s.permission,workspaceId:s.workspaceId,accountId:s.accountId,actorId:s.actorId,bindingId:s.bindingId,operationId:next.state.snapshot.operationId,operationRevision:next.state.revision,stateHash:registrationHash(next.state),jobId:next.queue.jobId,fence:next.state.analysisFence,status:next.state.status,recordedAt:now};
   data.record=clone(next);data.receipts.set(key,clone(receipt));return select(receipt);
  }
  throw Error('Unexpected SQL in driver double');
 };
 return {...f,active,inspect:()=>clone(committed),advance:(ms:number)=>{now=new Date(Date.parse(now)+ms).toISOString();}};
}
