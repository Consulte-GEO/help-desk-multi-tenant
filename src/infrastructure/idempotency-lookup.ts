import {invalidReplayResult,replayRecord} from '../application/replay-result.ts';
import type {Principal} from '../domain/model.ts';
import type {StoredResult} from '../application/ports.ts';

/** PostgreSQL SELECT of the scalar helper must yield exactly one row.
 * Only an explicit SQL NULL means absence. Missing/malformed rows must not trigger a new write.
 * The helper intentionally omits namespace fields; the adapter binds them to its request context.
 */
export function decodeIdempotencyLookup(rows:unknown,p:Principal,operation:string,key:string):StoredResult|null {
  if(!Array.isArray(rows)||rows.length!==1||!replayRecord(rows[0])
    ||!Object.hasOwn(rows[0],'record'))invalidReplayResult();
  const record=rows[0].record;
  if(record===null)return null;
  if(!replayRecord(record))invalidReplayResult();
  const base={workspaceId:p.workspaceId,principalId:p.id,operation,key};
  if(record.denied===true || record.expired===true) {
    const flag=record.denied===true?'denied':'expired';
    if(Object.keys(record).length!==1)invalidReplayResult();
    return {...base,hash:'',result:undefined,[flag]:true};
  }
  if(Object.keys(record).some(k=>!['hash','result','expired'].includes(k))
    ||typeof record.hash!=='string'||!/^[a-f0-9]{64}$/.test(record.hash)
    ||!Object.hasOwn(record,'result')||record.result===null||record.result===undefined
    ||record.expired!==false)invalidReplayResult();
  return {...base,hash:record.hash,result:record.result,expired:false};
}
