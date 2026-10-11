import {HelpdeskError} from './errors.ts';
import {parseFormVersion as parse,copyFormData,freezeFormData} from '../../shared/form-rules.js';
export type {FormVersion,FormField,FormRegistry,FormResult,FormRequirement} from '../../shared/form-rules.js';
export {freezeFormData};
export const formFailure=(code:string,status=400)=>new HelpdeskError(status,code,'Não foi possível validar a operação do formulário.');
export function parseFormVersion(raw:unknown){try{return parse(raw);}catch{throw formFailure('invalid_form_schema');}}
export function formRecord(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 try{const x=copyFormData(raw) as Record<string,unknown>;if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))throw Error();return x;}catch{throw formFailure('invalid_form_input');}
}
export function formRevision(raw:unknown,min=1):number{if(!Number.isSafeInteger(raw)||Number(raw)<min)throw formFailure('invalid_form_input');return raw as number;}
export function formReference(v:unknown,max=80):string{if(typeof v!=='string'||v.length>max||! /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw formFailure('invalid_form_input');return v;}
