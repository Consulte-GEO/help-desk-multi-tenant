import {HelpdeskError} from './errors.ts';import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {NOTIFICATION_KINDS} from './notification-delivery.ts';import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import type {Principal} from './model.ts';import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
export const EMAIL_DELIVERY_STATES=['pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed'] as const;
export const emailMonitorFailure=(code='email_monitor_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível consultar a entrega de e-mails.');
export type EmailMonitorFilter=Readonly<{limit:number;cursor:string|null;from:string|null;to:string|null;accountId:string|null;workId:string|null;kind:string|null;status:string;q:string|null;recipient:string|null}>;
const invalid=()=>emailMonitorFailure('invalid_email_monitor_filter',400);
export function parseEmailMonitorFilter(raw:unknown):EmailMonitorFilter{try{
 const r=copyFormData(raw) as Record<string,unknown>;if(!r||Array.isArray(r)||Object.keys(r).some(k=>!['limit','cursor','from','to','accountId','workId','kind','status','q','recipient'].includes(k)))throw Error();
 const limit=r.limit??25;if(!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>50)throw Error();
 const text=(key:string,min:number,max:number)=>{const v=r[key]??null;if(v!==null&&(!isPersistableText(v)||v.length<min||v.length>max||/[\p{Cc}]/u.test(v)))throw Error();return v as string|null;};
 const from=r.from??null,to=r.to??null;for(const v of [from,to])if(v!==null&&!isCanonicalInstant(v))throw Error();if(from&&to&&compareInstants(String(from),String(to))>=0)throw Error();
 const kind=text('kind',1,80);if(kind!==null&&!(NOTIFICATION_KINDS as readonly string[]).includes(kind))throw Error();
 const status=r.status??'all';if(!['all','queue','attention',...EMAIL_DELIVERY_STATES].includes(status as string))throw Error();
 const cursor=text('cursor',1,2048);if(cursor!==null&&!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();
 return freezeFormData({limit:Number(limit),cursor,from:from as string|null,to:to as string|null,accountId:r.accountId==null?null:uuidIdentifier(r.accountId),workId:text('workId',1,200),kind,status:status as string,q:text('q',2,200),recipient:text('recipient',3,254)}) as EmailMonitorFilter;
 }catch{throw invalid();}}
/** Server-side representation. Never use a variable number of stars. */
export function maskEmailAddress(value:unknown):string{if(typeof value!=='string'||value.length>254||!/^([^\s@]+)@([^\s@]+)\.([A-Za-z]{2,63})$/.test(value))return 'Destinatário indisponível';const [local,domain]=value.split('@');const suffix=domain!.slice(domain!.lastIndexOf('.')+1);return [...local!][0]+'***@'+[...domain!][0]+'***.'+suffix;}
export type EmailMonitorMode='collection'|'delivery'|'recipient';
type JsonObject=Record<string,unknown>;
const object=(v:unknown,keys:readonly string[]):JsonObject=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw emailMonitorFailure();return v as JsonObject;};
const natural=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<0)throw emailMonitorFailure();return Number(v);};
const stamp=(v:unknown)=>{if(v!==null&&!isCanonicalInstant(v))throw emailMonitorFailure();return v as string|null;};
const safeText=(v:unknown,max=300)=>{if(!isPersistableText(v)||v.length>max||/[\p{Cc}]/u.test(v))throw emailMonitorFailure();return v;};
function summary(raw:unknown,total:number){const s=object(raw,['sent','delivered','opened','clicked','states','attention']);const states=object(s.states,EMAIL_DELIVERY_STATES);if(Object.values(states).reduce<number>((n,v)=>n+natural(v),0)!==total)throw emailMonitorFailure();natural(s.attention);if(Number(s.attention)>total)throw emailMonitorFailure();for(const key of ['sent','delivered','opened','clicked']){const m=object(s[key],['count','eligible','total']);if(natural(m.total)!==total||natural(m.eligible)>total||m.count!==null&&natural(m.count)>total)throw emailMonitorFailure();if(m.count===null&&m.eligible!==0)throw emailMonitorFailure();}return s;}
function recipient(r:JsonObject,p:Principal){const visibility=p.workspaceRole==='admin'?'full':'masked';if(r.visibility!==visibility)throw emailMonitorFailure();safeText(r.recipientDisplay);if(visibility==='masked'&&r.recipientDisplay!=='Destinatário indisponível'&&!/^[^@\s]\*\*\*@[^@\s]\*\*\*\.[A-Za-z]{2,63}$/.test(String(r.recipientDisplay)))throw emailMonitorFailure();if(!(EMAIL_DELIVERY_STATES as readonly unknown[]).includes(r.state)||typeof r.attention!=='boolean')throw emailMonitorFailure();}
/** Closed DTO validation before serializing any private SQL result. Unknown fields
 * are errors, never forward-compatible permission to expose metadata. */
export function parseEmailMonitorResult(raw:unknown,mode:EmailMonitorMode,p:Principal):JsonObject{
 try{const copy=copyFormData(raw) as JsonObject;
 const header=['asOf','snapshotHash'];const group=['eventId','ticketId','protocol','subject','kind','createdAt','total','summary'];
 if(mode==='recipient'){
  const r=object(copy,[...header,'id','eventId','recipientDisplay','visibility','state','attention','reason','nextAttemptAt','pendingAgeSeconds','timeline','attempts',...(p.workspaceRole==='admin'?['providerMessageId','template']:[])]);
  uuidIdentifier(r.id);uuidIdentifier(r.eventId);recipient(r,p);stamp(r.asOf);if(r.reason!==null)safeText(r.reason,120);stamp(r.nextAttemptAt);
  if(['pending','retry_wait','leased','sending','unknown'].includes(String(r.state)))natural(r.pendingAgeSeconds);else if(r.pendingAgeSeconds!==null)throw Error();
  if(!Array.isArray(r.timeline)||r.timeline.length>30||!Array.isArray(r.attempts)||r.attempts.length>10)throw Error();
  for(const e of r.timeline){const item=object(e,['kind','occurredAt','receivedAt']);safeText(item.kind,80);stamp(item.occurredAt);stamp(item.receivedAt);}
  for(const a of r.attempts){const item=object(a,['number','startedAt']);natural(item.number);stamp(item.startedAt);}
  if(p.workspaceRole==='admin'){if(r.providerMessageId!==null)uuidIdentifier(r.providerMessageId);const t=object(r.template,['id','version','hash']);safeText(t.id,160);natural(t.version);if(!/^[a-f0-9]{64}$/.test(String(t.hash)))throw Error();}
 }else{
  object(copy,mode==='collection'?[...header,'total','items']:[...header,...group,'items']);
  const total=natural(copy.total);stamp(copy.asOf);if(!Array.isArray(copy.items)||copy.items.length>51)throw Error();
  const validateGroup=(g:JsonObject)=>{uuidIdentifier(g.eventId);uuidIdentifier(g.ticketId);safeText(g.protocol,120);safeText(g.subject,240);if(!(NOTIFICATION_KINDS as readonly unknown[]).includes(g.kind))throw Error();stamp(g.createdAt);summary(g.summary,natural(g.total));};
  if(mode==='collection')for(const entry of copy.items)validateGroup(object(entry,group));else{validateGroup(copy);if(copy.items.length>total)throw Error();for(const entry of copy.items){const r=object(entry,['id','recipientDisplay','visibility','state','badge','sentAt','deliveredAt','openedAt','clickedAt','openAvailability','clickAvailability','attention']);uuidIdentifier(r.id);recipient(r,p);safeText(r.badge,40);for(const k of ['sentAt','deliveredAt','openedAt','clickedAt'])stamp(r[k]);for(const k of ['openAvailability','clickAvailability'])if(!['observed','not_observed','not_collected','unavailable'].includes(String(r[k])))throw Error();}}
 }
 if(typeof copy.snapshotHash!=='string'||!/^[a-f0-9]{64}$/.test(copy.snapshotHash))throw Error();return freezeFormData(copy) as JsonObject;
 }catch{throw emailMonitorFailure();}
}
