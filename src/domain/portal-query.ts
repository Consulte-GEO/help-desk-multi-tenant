import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {instantMicros} from './business-calendar.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {statuses,type Principal} from './model.ts';
import {requestHash} from './canonical.ts';import {HelpdeskError} from './errors.ts';
export type PortalFilter=Readonly<{accountId:string;view:'mine'|'account'|'team';statuses:readonly string[];priorities:readonly string[];q:string|null;from:string|null;until:string|null;assignment:'any'|'mine'|'unassigned'}>;
export type PortalAfter=Readonly<{at:string;id:string}>;
export type PortalCursorContext=Readonly<{principalId:string;workspaceId:string;filterHash:string;accessRevision:string}>;
export const portalError=(code='portal_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar esta consulta autorizada. Atualize o contexto e tente novamente.');
export function parsePortalFilter(raw:unknown):PortalFilter{
 try{
  const r=copyFormData(raw) as Record<string,unknown>,keys=['accountId','view','statuses','priorities','q','from','until','assignment'];
  if(!r||Array.isArray(r)||Object.keys(r).some(k=>!keys.includes(k))||!['mine','account','team'].includes(r.view as string))throw Error();
  const strings=(v:unknown,allowed:readonly string[])=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>allowed.length||v.some(x=>typeof x!=='string'||!allowed.includes(x))||new Set(v).size!==v.length)throw Error();return [...v].sort();};
  const q=r.q??null;if(q!==null&&(!isPersistableText(q)||q.length<2||q.length>240||/[\p{Cc}]/u.test(q)))throw Error();
  for(const v of [r.from,r.until])if(v!==undefined&&v!==null&&!isCanonicalInstant(v))throw Error();
  if(r.from&&r.until&&compareInstants(String(r.from),String(r.until))>=0)throw Error();
  const assignment=r.assignment??'any';if(!['any','mine','unassigned'].includes(assignment as string)||r.view!=='team'&&assignment!=='any')throw Error();
  return freezeFormData({accountId:uuidIdentifier(r.accountId),view:r.view as PortalFilter['view'],statuses:strings(r.statuses,statuses),priorities:strings(r.priorities,['low','normal','high','urgent']),q,from:(r.from??null) as string|null,until:(r.until??null) as string|null,assignment:assignment as PortalFilter['assignment']}) as PortalFilter;
 }catch{throw portalError('invalid_portal_filter',400);}
}
export const portalFilterHash=(f:PortalFilter)=>requestHash(f);
/** Ciphertext cursor, not a JWT/session or client-held permission. Fresh ACL still required. */
export function createPortalCursorCodec(key:Uint8Array,clock:()=>string){
 if(key.byteLength!==32)throw portalError('portal_cursor_configuration');const secret=Buffer.from(key),aad=Buffer.from('helpdesk-portal-cursor-v1');
 function context(c:PortalCursorContext){uuidIdentifier(c.principalId);uuidIdentifier(c.workspaceId);if(!/^[a-f0-9]{64}$/.test(c.filterHash)||!c.accessRevision||c.accessRevision.length>160)throw Error();return requestHash(c);}
 return Object.freeze({
  seal(after:PortalAfter,c:PortalCursorContext):string{if(!isCanonicalInstant(after.at))throw portalError('invalid_portal_cursor',400);uuidIdentifier(after.id);const now=clock();instantMicros(now);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(aad);const encrypted=Buffer.concat([cipher.update(JSON.stringify({after,context:context(c),issuedAt:now}),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');},
  open(token:string,c:PortalCursorContext):PortalAfter{try{
   if(typeof token!=='string'||token.length>2048||!/^[A-Za-z0-9_-]+$/.test(token))throw Error();const b=Buffer.from(token,'base64url');if(b.length<29||b.toString('base64url')!==token)throw Error();
   const decipher=createDecipheriv('aes-256-gcm',secret,b.subarray(0,12));decipher.setAAD(aad);decipher.setAuthTag(b.subarray(12,28));const data=JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString('utf8'));
   const age=instantMicros(clock())-instantMicros(data.issuedAt);if(data.context!==context(c)||age<0n||age>=300000000n||!isCanonicalInstant(data.after.at))throw Error();return Object.freeze({at:data.after.at,id:uuidIdentifier(data.after.id)});
  }catch{throw portalError('invalid_portal_cursor',400);}}
 });
}
/** Core-only candidate query. Run under helpdesk_app and the existing resource RLS.
 * No metadata, notes or descriptions are selected. New structured projections need
 * their qualified persistence adapter; this does not fabricate protocols or SLA.
 */
export function buildPortalSql(p:Principal,f:PortalFilter,after:PortalAfter|null,limit:number,asOf:string){
 if(!Number.isSafeInteger(limit)||limit<1||limit>10001||!isCanonicalInstant(asOf))throw portalError('invalid_portal_filter',400);
 const text=`with eligible AS MATERIALIZED (
 select t.id,t.account_id,t.product_instance_id,t.created_by,t.assigned_to,t.subject,t.status,t.priority,t.version,t.created_at,t.updated_at,
 (select max(e.created_at) from helpdesk_core.ticket_events e where e.workspace_id=t.workspace_id and e.ticket_id=t.id
   and e.type='ticket.status_changed' and e.data->>'to' in ('resolved','closed') and e.created_at<=$14::timestamptz) as finalized_at
 from helpdesk_core.tickets t
 where t.workspace_id=$1::uuid and t.account_id=$2::uuid
 and helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.read')
 and ($4::text<>'mine' or t.created_by=$3::uuid)
 and ($4::text<>'team' or helpdesk_auth.is_operator(t.workspace_id,t.account_id))
 and (cardinality($5::text[])=0 or t.status=any($5)) and (cardinality($6::text[])=0 or t.priority=any($6))
 and ($7::text is null or strpos(lower(t.subject),lower($7))>0 or t.id::text=$7)
 and ($8::timestamptz is null or t.created_at >= $8) and ($9::timestamptz is null or t.created_at < $9)
 and ($10::text='any' or ($10='mine' and t.assigned_to=$3::uuid) or ($10='unassigned' and t.assigned_to is null))
 and t.created_at<=$14::timestamptz
 ), selected as (select * from eligible where ($11::timestamptz is null or (created_at,id)<($11::timestamptz,$12::uuid)) order by created_at desc,id desc limit $13)
 select jsonb_build_object('source','postgres-core','complete',true,'asOf',$14::text,
 'total',(select count(*) from eligible),
 'counts',jsonb_build_object('open',(select count(*) from eligible where status not in ('resolved','closed','cancelled')),
 'waitingCustomer',(select count(*) from eligible where status='waiting_customer'),
 'resolvedOrClosed30d',(select count(*) from eligible where status in ('resolved','closed') and finalized_at >= $14::timestamptz-interval '30 days'),
 'cancelled',(select count(*) from eligible where status='cancelled')),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id,'productInstanceId',product_instance_id,
 'createdBy',created_by,'assignedTo',assigned_to,'subject',subject,'status',status,'priority',priority,'version',version,
 'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by created_at desc,id desc) from selected),'[]'::jsonb)) as snapshot`;
 return {text,values:[p.workspaceId,f.accountId,p.id,f.view,f.statuses,f.priorities,f.q,f.from,f.until,f.assignment,after?.at??null,after?.id??null,limit,asOf]};
}
