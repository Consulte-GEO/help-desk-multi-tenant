import type {Coverage} from './model.ts';
export type Resolution={status:'resolved'|'ambiguous'|'no_coverage';candidates:Coverage[]};
export function resolveCoverage(coverages:Coverage[],at:string):Resolution{
  const now=Date.parse(at);
  if(!Number.isFinite(now))throw new TypeError('Data inválida.');
  const candidates=coverages.filter(c=>c.enabled&&c.published&&c.contractStatus==='active'&&Date.parse(c.validFrom)<=now&&(c.validUntil===null||now<Date.parse(c.validUntil))).sort((a,b)=>a.id.localeCompare(b.id));
  return {status:candidates.length===0?'no_coverage':candidates.length===1?'resolved':'ambiguous',candidates};
}
