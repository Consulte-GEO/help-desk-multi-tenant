import {zonedInstantMicros} from '../../shared/instant.js';
import type {Coverage} from './model.ts';
export type Resolution={status:'resolved'|'ambiguous'|'no_coverage';candidates:Coverage[]};
/** Eligibility is [start, end): start inclusive, optional end exclusive, exact to microseconds.
 * The caller supplies the clock AFTER acquiring/reading the contractual context.
 * This pure decision never rewrites the candidate or its historical policy snapshot.
 */
export function resolveCoverage(coverages:Coverage[],at:string):Resolution{
 const now=zonedInstantMicros(at);
 if(now===undefined)throw new TypeError('Data inválida.');
 const candidates=coverages.filter(c=>{
  const start=zonedInstantMicros(c.validFrom),end=c.validUntil===null?null:zonedInstantMicros(c.validUntil);
  if(start===undefined||end===undefined||end!==null&&end<=start)throw new TypeError('Vigência inválida.');
  return c.enabled===true&&c.published===true&&c.contractStatus==='active'&&start<=now&&(end===null||now<end);
 }).sort((a,b)=>a.id===b.id?0:a.id<b.id?-1:1);
 return {status:candidates.length===0?'no_coverage':candidates.length===1?'resolved':'ambiguous',candidates};
}
