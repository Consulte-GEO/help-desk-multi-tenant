import {HelpdeskError} from '../domain/errors.ts';
export async function readObject(req:Request,allowed:readonly string[]):Promise<Record<string,unknown>>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))throw new HelpdeskError(415,'unsupported_media_type','Utilize application/json.');
 const limit=65536;const declared=req.headers.get('content-length');
 if(declared&&Number(declared)>limit)throw new HelpdeskError(413,'body_too_large','Limite de 64 KiB por requisição.');
 const reader=req.body?.getReader();if(!reader)throw new HelpdeskError(400,'invalid_json','Informe um objeto JSON.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HelpdeskError(413,'body_too_large','Limite de 64 KiB por requisição.');}chunks.push(value);}}finally{reader.releaseLock();}
 let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HelpdeskError(400,'invalid_json','JSON inválido.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HelpdeskError(400,'invalid_json','Informe um objeto JSON.');
 if(Object.keys(value).some(k=>!allowed.includes(k)))throw new HelpdeskError(400,'unknown_field','A requisição contém campos não permitidos.');
 return value as Record<string,unknown>;
}
export function text(input:Record<string,unknown>,key:string,min=1,max=200):string{const v=input[key];if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new HelpdeskError(400,'invalid_input',`Campo ${key} inválido.`);return v;}
export function identifier(value:unknown):string{if(typeof value!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value))throw new HelpdeskError(400,'invalid_identifier','Identificador inválido.');return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():value;}
export function ifMatch(req:Request):number{const value=req.headers.get('if-match');if(!value)throw new HelpdeskError(428,'precondition_required','Informe If-Match com a versão atual.');if(!/^"[1-9][0-9]*"$/.test(value))throw new HelpdeskError(400,'invalid_if_match','If-Match deve ser uma versão entre aspas.');const n=Number(value.slice(1,-1));if(!Number.isSafeInteger(n))throw new HelpdeskError(400,'invalid_if_match','Versão inválida.');return n;}
