import {copyJson,record,uuid,integer,sha,canonicalJson} from '../import-process/canonical.ts';

export const RECOVERY_STORAGE_KEY='cg:import-process:pending:v1';
export interface RecoveryIdentity {workspaceId:string;accountId:string;actorId:string;}
/** Locator/checksum only. Never a credential, snapshot, filename or authorization. */
export interface RecoveryMarker extends RecoveryIdentity {
 schemaVersion:'1';caseId:string;operationId:string;expectedVersion:number;requestHash:string;
}
export interface RecoveryJournal {
 read(identity:RecoveryIdentity):RecoveryMarker|null;
 write(marker:RecoveryMarker):void;
 clear(expected:RecoveryMarker):void;
}
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function parseRecoveryIdentity(value:unknown):RecoveryIdentity {
 const x=record(copyJson(value),['workspaceId','accountId','actorId']);
 uuid(x.workspaceId);uuid(x.accountId);uuid(x.actorId);return x as unknown as RecoveryIdentity;
}
function marker(value:unknown):RecoveryMarker {
 try{
  const x=record(copyJson(value,2048),['schemaVersion','workspaceId','accountId','actorId','caseId','operationId','expectedVersion','requestHash']);
  if(x.schemaVersion!=='1')throw Error();
  [x.workspaceId,x.accountId,x.actorId,x.caseId,x.operationId].forEach(uuid);integer(x.expectedVersion,1);sha(x.requestHash);
  return x as unknown as RecoveryMarker;
 }catch{throw Error('RECOVERY_MARKER_INVALID');}
}
/** Pass window.sessionStorage explicitly from the authenticated host. No fallback.
 * One pending operation per tab. Reload survives; closing the tab is not covered.
 * Compare-and-clear prevents an old controller deleting a newer marker.
 */
export function createSessionRecoveryJournal(storage:StoragePort):RecoveryJournal {
 if(!storage||['getItem','setItem','removeItem'].some(k=>typeof storage[k as keyof StoragePort]!=='function'))throw Error('INVALID_RECOVERY_STORAGE');
 const io=<T>(fn:()=>T):T=>{try{return fn();}catch{throw Error('RECOVERY_STORAGE_UNAVAILABLE');}};
 function readRaw():RecoveryMarker|null {
  const raw=io(()=>storage.getItem(RECOVERY_STORAGE_KEY));if(raw===null)return null;
  if(typeof raw!=='string'||raw.length>2048)throw Error('RECOVERY_MARKER_INVALID');
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw Error('RECOVERY_MARKER_INVALID');}
  return marker(parsed);
 }
 return {
  read(identity){
   const who=parseRecoveryIdentity(identity),m=readRaw();
   if(m&&Object.keys(who).some(k=>m[k as keyof RecoveryIdentity]!==who[k as keyof RecoveryIdentity]))throw Error('RECOVERY_SCOPE_MISMATCH');
   return m;
  },
  write(value){
   const m=marker(value),before=readRaw(),raw=canonicalJson(m);
   if(before&&canonicalJson(before)!==raw)throw Error('RECOVERY_PENDING');
   io(()=>storage.setItem(RECOVERY_STORAGE_KEY,raw));
   if(io(()=>storage.getItem(RECOVERY_STORAGE_KEY))!==raw)throw Error('RECOVERY_STORAGE_UNAVAILABLE');
  },
  clear(expected){
   const wanted=marker(expected),current=readRaw();if(current===null)return;
   if(canonicalJson(current)!==canonicalJson(wanted))throw Error('RECOVERY_MARKER_CHANGED');
   io(()=>storage.removeItem(RECOVERY_STORAGE_KEY));
   if(io(()=>storage.getItem(RECOVERY_STORAGE_KEY))!==null)throw Error('RECOVERY_STORAGE_UNAVAILABLE');
  }
 };
}
