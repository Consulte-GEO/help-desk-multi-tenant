import {copyFormData,freezeFormData} from '../../shared/form-rules.js';import {uuidIdentifier,isPersistableText} from './input-values.ts';import {instantMicros} from './business-calendar.ts';import {portalError} from './portal-query.ts';
/** Strict PUBLIC detail DTO after private authority/SQL. No notes, bodies from
 * internal events, editorial metadata or hidden fields may cross this boundary. */
export function parsePublicPortalDetail(raw:unknown,expectedId:string){try{
 const d=copyFormData(raw) as any,keys=['id','subject','description','protocol','status','priority','version','messages','history','actions','resources','sla'];
 if(!d||Object.keys(d).length!==keys.length||keys.some(k=>!Object.hasOwn(d,k))||d.id!==expectedId)throw Error();uuidIdentifier(d.id);
 for(const [text,max] of [[d.subject,200],[d.description,12000]] as const)if(!isPersistableText(text)||text.length>max)throw Error();
 if(d.protocol!==null&&(typeof d.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(d.protocol))||!['received','in_progress','waiting_for_you','resolved','closed'].includes(d.status)||!['low','normal','high','urgent'].includes(d.priority)||!Number.isSafeInteger(d.version)||d.version<1)throw Error();
 // Until the structured projection adapter is installed, do not assert clocks or
 // labels from a core-only row. A future exact schema extension needs its tests.
 for(const part of [d.resources,d.sla])if(!part||Object.keys(part).length!==1||part.availability!=='unavailable')throw Error();
 if(!Array.isArray(d.actions)||d.actions.some((x:unknown)=>!['reply','review','approve','download'].includes(x as string))||new Set(d.actions).size!==d.actions.length)throw Error();
 for(const [part,allowed] of [[d.messages,['body','createdAt','actorType']],[d.history,['label','createdAt']]] as const){if(!Array.isArray(part)||part.length>100)throw Error();for(const x of part){if(!x||Object.keys(x).length!==allowed.length||Object.keys(x).some(k=>!(allowed as readonly string[]).includes(k)))throw Error();instantMicros(x.createdAt);if('body' in x){if(!isPersistableText(x.body)||x.body.length>12000||!['human_agent','customer','integration'].includes(x.actorType))throw Error();}else if(!isPersistableText(x.label)||x.label.length>200)throw Error();}}
 return freezeFormData(d);
 }catch{throw portalError('invalid_portal_result');}}
