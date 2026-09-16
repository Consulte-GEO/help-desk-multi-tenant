import {ERROR_CODES} from './codes.ts';
import {METHODS,ROUTES} from './http.ts';
import type {HttpObservation} from './http.ts';
const fields=['event_schema','component','release','occurred_at','request_id','phase','route','method','status','status_class','severity','error_code','duration_ms'];
const bounds=[10,50,100,250,500,1000,2500,5000,15000,30000,60000,Infinity];
function valid(e:Record<string,unknown>):e is HttpObservation {
 if(Object.keys(e).length!==fields.length||fields.some(k=>!Object.hasOwn(e,k)))return false;
 const status=e.status,elapsed=e.duration_ms;
 return e.event_schema===1&&e.component==='helpdesk.http'
  &&typeof e.release==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(e.release)
  &&typeof e.occurred_at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.occurred_at)
  &&Number.isFinite(Date.parse(e.occurred_at))&&new Date(e.occurred_at).toISOString()===e.occurred_at
  &&typeof e.request_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e.request_id)
  &&typeof e.phase==='string'&&['http','bootstrap','dispatch'].includes(e.phase)
  &&typeof e.route==='string'&&ROUTES.has(e.route)&&typeof e.method==='string'&&METHODS.has(e.method)
  &&typeof status==='number'&&Number.isInteger(status)&&status>=100&&status<=599
  &&e.status_class===Math.floor(status/100)+'xx'&&e.severity===(status>=500?'error':status>=400?'warn':'info')
  &&(status<400?e.error_code===null:typeof e.error_code==='string'&&ERROR_CODES.has(e.error_code))
  &&(elapsed===null||typeof elapsed==='number'&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=86_400_000);
}
type Aggregate={route:string;method:string;count:number;statuses:Record<string,number>;errors:Record<string,number>;
 phases:Record<string,number>;n:number;sum:number;min:number;max:number;hist:number[]};
/** Aggregates a closed, bounded vocabulary; never stores raw lines, request IDs or arbitrary labels. */
export class HttpLogSummary {
 private groups=new Map<string,Aggregate>();private accepted=0;private ignored=0;private rejected=0;
 private first:string|null=null;private last:string|null=null;
 rejectLine():void{this.rejected++;}
 consumeLine(line:string):void {
  let e:unknown;try{e=JSON.parse(line);}catch{this.ignored++;return;}
  if(!e||typeof e!=='object'||Array.isArray(e)||(e as Record<string,unknown>).component!=='helpdesk.http'){this.ignored++;return;}
  if(!valid(e as Record<string,unknown>)){this.rejected++;return;}
  const record=e as HttpObservation;this.accepted++;
  if(this.first===null||record.occurred_at<this.first)this.first=record.occurred_at;
  if(this.last===null||record.occurred_at>this.last)this.last=record.occurred_at;
  const key=record.route+' '+record.method;
  let g=this.groups.get(key);if(!g){g={route:record.route,method:record.method,count:0,statuses:{},errors:{},phases:{},n:0,sum:0,min:Infinity,max:0,hist:bounds.map(()=>0)};this.groups.set(key,g);}
  g.count++;g.statuses[record.status]=(g.statuses[record.status]??0)+1;g.phases[record.phase]=(g.phases[record.phase]??0)+1;
  if(record.error_code)g.errors[record.error_code]=(g.errors[record.error_code]??0)+1;
  const elapsed=record.duration_ms;if(elapsed!==null){g.n++;g.sum+=elapsed;g.min=Math.min(g.min,elapsed);g.max=Math.max(g.max,elapsed);const bucket=bounds.findIndex(b=>elapsed<=b);g.hist[bucket]=(g.hist[bucket]??0)+1;}
 }
 snapshot(){return {schema:1,scope:'operator-offline',counting:'log_records_not_unique_requests',accepted:this.accepted,
  ignored_lines:this.ignored,rejected_lines:this.rejected,window:{first:this.first,last:this.last},
  routes:[...this.groups.values()].sort((a,b)=>(a.route+' '+a.method).localeCompare(b.route+' '+b.method)).map(g=>({
   route:g.route,method:g.method,count:g.count,statuses:{...g.statuses},errors:{...g.errors},phases:{...g.phases},
   latency:{observed:g.n,mean_ms:g.n?Math.round(g.sum/g.n*1000)/1000:null,min_ms:g.n?g.min:null,max_ms:g.n?g.max:null,
    histogram:bounds.map((b,i)=>({upper_bound_ms:Number.isFinite(b)?b:null,count:g.hist[i]}))}
  }))};}
}
/** Decode only complete bounded lines, including multibyte characters split across chunks. */
export async function summarizeChunks(chunks:AsyncIterable<Uint8Array>,summary:HttpLogSummary,maxLineBytes=16_384):Promise<void> {
 if(!Number.isSafeInteger(maxLineBytes)||maxLineBytes<1||maxLineBytes>1_048_576)throw Error('Limite de linha inválido.');
 let pending:Buffer[]=[];let size=0,discard=false,total=0;
 const append=(part:Uint8Array)=>{if(discard)return;if(size+part.byteLength>maxLineBytes){pending=[];size=0;discard=true;return;}if(part.byteLength){pending.push(Buffer.from(part));size+=part.byteLength;}};
 const finish=()=>{if(discard)summary.rejectLine();else{try{summary.consumeLine(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(pending,size)).replace(/\r$/,''));}catch{summary.rejectLine();}}pending=[];size=0;discard=false;};
 for await(const chunk of chunks){total+=chunk.byteLength;if(total>256*1024*1024)throw Error('Arquivo excede o limite operacional de 256 MiB.');
  let start=0;for(let i=0;i<chunk.byteLength;i++)if(chunk[i]===10){append(chunk.subarray(start,i));finish();start=i+1;}append(chunk.subarray(start));}
 if(size||discard)finish();
}
