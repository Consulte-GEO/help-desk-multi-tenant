import {createHash} from 'node:crypto';import type {Principal} from '../domain/model.ts';
import {requestHash} from '../domain/canonical.ts';import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {parsePortalFilter,portalError,type PortalFilter} from '../domain/portal-query.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {instantMicros,formatMicros} from '../domain/business-calendar.ts';import type {createPortalReader} from './portal-read.ts';
export type CsvRow={id:string;subject:string;status:string;priority:string;createdAt:string;protocol:string|null};
export function encodePortalCsv(rows:readonly CsvRow[],asOf:string):Uint8Array{
 instantMicros(asOf);if(!Array.isArray(rows)||rows.length>10000)throw portalError('portal_export_limit',422);
 const cell=(value:string)=>{const risk=value.replace(/^[\s\p{Cf}]*/u,'');const safe=/^[=+\-@＝＋－＠]/u.test(risk)?"'"+value:value;return '"'+safe.replaceAll('"','""')+'"';};
 const lines=['Identificador,Protocolo,Assunto,Situacao,Prioridade,Criado_UTC,Consulta_UTC'];
 for(const raw of rows){const r=copyFormData(raw) as CsvRow;if(!r||Object.keys(r).length!==6||!['id','protocol','subject','status','priority','createdAt'].every(k=>Object.hasOwn(r,k)))throw portalError('invalid_portal_result');uuidIdentifier(r.id);instantMicros(r.createdAt);if(!isPersistableText(r.subject)||r.subject.length>200||typeof r.status!=='string'||typeof r.priority!=='string'||r.protocol!==null&&(typeof r.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(r.protocol)))throw portalError('invalid_portal_result');lines.push([r.id,r.protocol??'',r.subject,r.status,r.priority,r.createdAt,asOf].map(cell).join(','));}
 return new TextEncoder().encode('\ufeff'+lines.join('\r\n')+'\r\n');
}
export type ExportObject=Readonly<{key:string;version:string;bytes:number;sha256:string}>;
export type ExportReceipt=Readonly<{id:string;workspaceId:string;ownerId:string;key:string;intentHash:string;filter:PortalFilter;ticketIds:readonly string[];total:number;asOf:string;expiresAt:string;object:ExportObject}>;
export interface ReportExportStore{
 /** Unique actor/key/hash reservation. building never grants another builder. */
 reserve(p:Principal,key:string,hash:string):Promise<{state:'reserved'|'building';id:string}|{state:'ready';receipt:ExportReceipt}>;
 /** CAS building→ready + audit atomically. ACK loss stays building/unknown, no automatic retry. */
 complete(p:Principal,r:ExportReceipt):Promise<void>;read(p:Principal,id:string):Promise<ExportReceipt|null>;
}
export interface ReportExportStorage{
 putPrivate(key:string,bytes:Uint8Array,expiresAt:string):Promise<ExportObject>;
 head(object:ExportObject):Promise<ExportObject>;
 issueDownload(object:ExportObject,seconds:number):Promise<{url:string;key:string;version:string;expiresAt:string}>;
}
function object(raw:ExportObject,key:string){const x=copyFormData(raw) as ExportObject;if(!x||Object.keys(x).length!==4||x.key!==key||typeof x.version!=='string'||!x.version||x.version.length>200||!Number.isSafeInteger(x.bytes)||x.bytes<1||x.bytes>16000000||!/^[a-f0-9]{64}$/.test(x.sha256))throw portalError('invalid_export_object');return freezeFormData(x);}
const projection=(r:ExportReceipt)=>({id:r.id,state:'ready',rowCount:r.total,asOf:r.asOf,expiresAt:r.expiresAt,format:'csv'});
export function createReportExports(o:{reader:Pick<ReturnType<typeof createPortalReader>,'readExportRows'>;store:ReportExportStore;storage:ReportExportStorage;clock:()=>string;downloadOrigin:string;ttlSeconds:number}){
 if(new URL(o.downloadOrigin).origin!==o.downloadOrigin||!o.downloadOrigin.startsWith('https://')||!Number.isSafeInteger(o.ttlSeconds)||o.ttlSeconds<1||o.ttlSeconds>86400)throw portalError('export_configuration_required');
 function checked(raw:ExportReceipt|null,p:Principal,id:string):ExportReceipt{const r=copyFormData(raw) as ExportReceipt|null;if(!r||r.id!==id||r.workspaceId!==p.workspaceId||r.ownerId!==p.id)throw portalError('export_not_found',404);if(instantMicros(r.expiresAt)<=instantMicros(o.clock()))throw portalError('export_expired',410);if(!Number.isSafeInteger(r.total)||r.total<0||r.total>10000||!Array.isArray(r.ticketIds)||r.ticketIds.length!==r.total||new Set(r.ticketIds).size!==r.total)throw portalError('invalid_export_result');r.ticketIds.forEach(uuidIdentifier);object(r.object,`exports/${p.workspaceId}/${id}`);parsePortalFilter(r.filter);return freezeFormData(r);}
 async function reauthorize(p:Principal,r:ExportReceipt,signal?:AbortSignal){const current=await o.reader.readExportRows(p,r.filter,signal),ids=new Set(current.items.map(x=>x.id));if(r.ticketIds.some(id=>!ids.has(id)))throw portalError('export_access_changed',403);checked(r,p,r.id);}
 return Object.freeze({
  async prepareReportExport(p:Principal,raw:unknown,key:string,signal?:AbortSignal){uuidIdentifier(p.id);uuidIdentifier(p.workspaceId);if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw portalError('invalid_export_intent',400);const filter=parsePortalFilter(raw),hash=requestHash({workspaceId:p.workspaceId,ownerId:p.id,filter,format:'csv'});
   // Authorize before revealing even a historical reservation/receipt.
   const data=await o.reader.readExportRows(p,filter,signal),reservation=await o.store.reserve(p,key,hash);
   if(reservation.state==='ready'){const r=checked(reservation.receipt,p,reservation.receipt.id);if(r.intentHash!==hash||r.key!==key)throw portalError('export_intent_conflict',409);await reauthorize(p,r,signal);return projection(r);}
   const id=uuidIdentifier(reservation.id);if(reservation.state==='building')return {id,state:'pending'};if(reservation.state!=='reserved')throw portalError('invalid_export_result');
   if(data.total!==data.items.length||data.total>10000)throw portalError('portal_export_incomplete');const rows=data.items.map(x=>({id:x.id,protocol:x.protocol,subject:x.subject,status:x.status,priority:x.priority,createdAt:x.createdAt}));
   const bytes=encodePortalCsv(rows,data.asOf),expiresAt=formatMicros(instantMicros(o.clock())+BigInt(o.ttlSeconds)*1000000n),path=`exports/${p.workspaceId}/${id}`,stored=object(await o.storage.putPrivate(path,bytes,expiresAt),path);
   if(stored.bytes!==bytes.length||stored.sha256!==createHash('sha256').update(bytes).digest('hex'))throw portalError('invalid_export_object');
   const receipt:ExportReceipt={id,workspaceId:p.workspaceId,ownerId:p.id,key,intentHash:hash,filter,ticketIds:rows.map(r=>r.id),total:rows.length,asOf:data.asOf,expiresAt,object:stored};await reauthorize(p,receipt,signal);await o.store.complete(p,receipt);return projection(receipt);
  },
  async authorizeExportDownload(p:Principal,rawId:string,signal?:AbortSignal){const id=uuidIdentifier(rawId),r=checked(await o.store.read(p,id),p,id);await reauthorize(p,r,signal);const actual=object(await o.storage.head(r.object),r.object.key);if(requestHash(actual)!==requestHash(r.object))throw portalError('export_object_changed',409);
   const seconds=Math.min(300,Number((instantMicros(r.expiresAt)-instantMicros(o.clock()))/1000000n));if(seconds<1)throw portalError('export_expired',410);const start=instantMicros(o.clock()),g=await o.storage.issueDownload(actual,seconds),url=new URL(g.url);
   if(url.origin!==o.downloadOrigin||url.username||url.password||url.hash||g.key!==actual.key||g.version!==actual.version||instantMicros(g.expiresAt)>start+BigInt(seconds)*1000000n||instantMicros(g.expiresAt)>instantMicros(r.expiresAt)||instantMicros(g.expiresAt)<=instantMicros(o.clock()))throw portalError('invalid_export_grant');
   await reauthorize(p,r,signal);const current=checked(await o.store.read(p,id),p,id);if(requestHash(current)!==requestHash(r))throw portalError('export_grant_changed',409);return freezeFormData({id,url:g.url,expiresAt:g.expiresAt});
  }
 });
}
