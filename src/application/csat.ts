import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';import {copyFormData} from '../../shared/form-rules.js';
import {instantMicros} from '../domain/business-calendar.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {requestHash} from '../domain/canonical.ts';import {HelpdeskError} from '../domain/errors.ts';
export type CsatReceipt=Readonly<{id:string;rating:number;submittedAt:string;attribution:'invitation_possession'}>;
export type CsatInvitation=Readonly<{id:string;tokenHash:string;expiresAt:string;revoked:boolean;consumed:boolean;receipt:{key:string;hash:string;result:CsatReceipt}|null}>;
export interface CsatStore{
 /** Lock hash row; expired/revoked cannot commit. consume + rating/audit + receipt
 * in ONE transaction, unique invitation. No SELECT of ticket needed by submit. */
 withInvitation<T>(hash:string,work:(invitation:CsatInvitation|null,tx:{commit(receipt:{key:string;hash:string;result:CsatReceipt;comment:string}):Promise<void>})=>Promise<T>):Promise<T>;
}
const fail=(code='csat_unavailable',status=404)=>new HelpdeskError(status,code,'Pesquisa indisponível ou já respondida.');
/** Does not issue invitations or prove the original recipient's identity. The
 * public landing has no ticket/account/person fields; only explicit POST submits. */
export function createCsatService(o:{store:CsatStore;clock:()=>string}){
 return Object.freeze({async submitCsat(token:string,raw:unknown,key:string):Promise<CsatReceipt>{
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail();let input:{rating:number;comment:string};try{input=copyFormData(raw) as typeof input;if(!input||Object.keys(input).length!==2||!Object.hasOwn(input,'rating')||!Object.hasOwn(input,'comment')||!Number.isInteger(input.rating)||input.rating<1||input.rating>5||typeof input.comment!=='string'||input.comment.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.comment)||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw Error();}catch{throw fail('invalid_csat_input',400);}
  const tokenHash=createHash('sha256').update(token).digest('hex'),hash=requestHash(input);let prepared=false;
  try{return await o.store.withInvitation(tokenHash,async(inv,tx)=>{const r=inv;if(!r||typeof r.revoked!=='boolean'||typeof r.consumed!=='boolean'||!/^[a-f0-9]{64}$/.test(r.tokenHash)||!timingSafeEqual(Buffer.from(r.tokenHash),Buffer.from(tokenHash))||r.revoked||instantMicros(r.expiresAt)<=instantMicros(o.clock()))throw fail();uuidIdentifier(r.id);
   if(r.consumed){if(!r.receipt||r.receipt.key!==key)throw fail('csat_already_used',409);if(r.receipt.hash!==hash)throw fail('csat_intent_conflict',409);const result=r.receipt.result;if(!result||Object.keys(result).length!==4||result.rating!==input.rating||result.attribution!=='invitation_possession')throw fail('csat_storage_unavailable',503);uuidIdentifier(result.id);instantMicros(result.submittedAt);return {id:result.id,rating:result.rating,submittedAt:result.submittedAt,attribution:'invitation_possession'};}
   if(r.receipt!==null)throw fail('csat_storage_unavailable',503);const result:CsatReceipt={id:randomUUID(),rating:input.rating,submittedAt:o.clock(),attribution:'invitation_possession'};if(instantMicros(r.expiresAt)<=instantMicros(result.submittedAt))throw fail();prepared=true;await tx.commit({key,hash,result,comment:input.comment});return result;});
  }catch(e){if(prepared)throw fail('csat_outcome_unknown',503);if(e instanceof HelpdeskError&&/^csat_|^invalid_csat_/.test(e.code))throw fail(e.code,e.status);throw fail(prepared?'csat_outcome_unknown':'csat_storage_unavailable',503);}
 }});
}
