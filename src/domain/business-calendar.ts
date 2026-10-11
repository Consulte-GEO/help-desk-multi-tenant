import {HelpdeskError} from './errors.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
/** A qualified calendar compiler supplies UTC intervals and an explicit coverage
 * horizon. No network timezone rules/holidays are guessed by the clock engine.
 * Gaps WITHIN the horizon are nonworking; outside it no zero is invented.
 */
export type BusinessCalendarVersion=Readonly<{versionId:string;timeZone:'America/Sao_Paulo';from:string;until:string;intervals:readonly (readonly [string,string])[]}>;
const invalid=()=>new HelpdeskError(400,'invalid_business_calendar','Calendário de atendimento inválido.');
const horizon=()=>new HelpdeskError(503,'calendar_horizon_exceeded','O calendário não cobre o período solicitado.');
export function instantMicros(value:unknown):bigint{if(!isCanonicalInstant(value))throw invalid();return zonedInstantMicros(value)!;}
export function formatMicros(value:bigint):string{
 let ms=value/1000n,rest=value%1000n;if(rest<0n){ms--;rest+=1000n;}
 const date=new Date(Number(ms));if(!Number.isFinite(date.getTime()))throw invalid();const s=date.toISOString().replace('Z',String(rest).padStart(3,'0')+'Z');if(!isCanonicalInstant(s))throw invalid();return s;
}
export function createBusinessCalendar(raw:unknown){
 let version:BusinessCalendarVersion;let windows:{start:bigint;end:bigint;prior:bigint}[]=[];let from:bigint,until:bigint;
 try{
  const x=copyFormData(raw) as Record<string,unknown>;
  if(!x||Array.isArray(x)||Object.keys(x).length!==5||!['versionId','timeZone','from','until','intervals'].every(k=>Object.hasOwn(x,k))||typeof x.versionId!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(x.versionId)||x.timeZone!=='America/Sao_Paulo'||!Array.isArray(x.intervals)||x.intervals.length>2000)throw invalid();
  from=instantMicros(x.from);until=instantMicros(x.until);if(until<=from)throw invalid();let previous=from,total=0n;
  for(const pair of x.intervals){if(!Array.isArray(pair)||pair.length!==2)throw invalid();const start=instantMicros(pair[0]),end=instantMicros(pair[1]);if(start<previous||end<=start||start<from||end>until)throw invalid();windows.push({start,end,prior:total});total+=end-start;previous=end;}
  version=freezeFormData(x) as unknown as BusinessCalendarVersion;
 }catch{throw invalid();}
 const checked=(s:string)=>{const at=instantMicros(s);if(at<from||at>until)throw horizon();return at;};
 const integrated=(t:bigint)=>{let lo=0,hi=windows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(windows[mid]!.start<t)lo=mid+1;else hi=mid;}if(!lo)return 0n;const x=windows[lo-1]!;return x.prior+(t>=x.end?x.end-x.start:t-x.start);};
 function between(start:string,end:string):bigint{const a=checked(start),b=checked(end);if(b<a)throw invalid();return integrated(b)-integrated(a);}
 function dueAfter(start:string,amount:bigint):string|null{
  let at=checked(start);if(typeof amount!=='bigint'||amount<0n)throw invalid();if(amount===0n)return formatMicros(at);
  let lo=0,hi=windows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(windows[mid]!.end<=at)lo=mid+1;else hi=mid;}
  for(let i=lo;i<windows.length;i++){const w=windows[i]!;if(at<w.start)at=w.start;const available=w.end-at;if(amount<=available)return formatMicros(at+amount);amount-=available;at=w.end;}
  return null;
 }
 return Object.freeze({version,between,dueAfter});
}
