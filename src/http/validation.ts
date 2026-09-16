import {HelpdeskError} from '../domain/errors.ts';
/** Byte and wall-clock limits apply even to chunked input. Cancellation must never block cleanup. */
export async function readObject(req:Request,allowed:readonly string[],options:{timeoutMs?:number}={}):Promise<Record<string,unknown>>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))throw new HelpdeskError(415,'unsupported_media_type','Utilize application/json.');
 const encoding=req.headers.get('content-encoding');
 if(encoding&&encoding.toLowerCase()!=='identity')throw new HelpdeskError(415,'unsupported_encoding','Corpos comprimidos não são aceitos.');
 const timeoutMs=options.timeoutMs??5000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw new Error('Invalid body deadline configuration');
 const limit=65536,declared=req.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||!Number.isSafeInteger(Number(declared))))throw new HelpdeskError(400,'invalid_content_length','Comprimento do corpo inválido.');
 if(declared!==null&&Number(declared)>limit)throw new HelpdeskError(413,'body_too_large','Limite de 64 KiB por requisição.');
 const reader=req.body?.getReader();if(!reader)throw new HelpdeskError(400,'invalid_json','Informe um objeto JSON.');
 const chunks:Uint8Array[]=[];let size=0;let timer:ReturnType<typeof setTimeout>|undefined;
 const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new HelpdeskError(408,'body_timeout','Tempo limite de recebimento do corpo excedido.')),timeoutMs);});
 try{
  while(true){
   const {done,value}=await Promise.race([reader.read(),expired]);if(done)break;
   size+=value.byteLength;
   if(size>limit)throw new HelpdeskError(413,'body_too_large','Limite de 64 KiB por requisição.');
   chunks.push(value);
  }
 }catch(error){
  void reader.cancel().catch(()=>{});
  if(error instanceof HelpdeskError)throw error;
  throw new HelpdeskError(400,'invalid_body','Não foi possível receber o corpo da requisição.');
 }finally{clearTimeout(timer);reader.releaseLock();}
 if(declared!==null&&size!==Number(declared))throw new HelpdeskError(400,'invalid_content_length','Comprimento do corpo incompatível.');
 let value:unknown;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw new HelpdeskError(400,'invalid_json','JSON ou codificação UTF-8 inválidos.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HelpdeskError(400,'invalid_json','Informe um objeto JSON.');
 if(Object.keys(value).some(k=>!allowed.includes(k)))throw new HelpdeskError(400,'unknown_field','A requisição contém campos não permitidos.');
 return value as Record<string,unknown>;
}
export function text(input:Record<string,unknown>,key:string,min=1,max=200):string{const v=input[key];if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new HelpdeskError(400,'invalid_input',`Campo ${key} inválido.`);return v;}
export function identifier(value:unknown):string{if(typeof value!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value))throw new HelpdeskError(400,'invalid_identifier','Identificador inválido.');return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():value;}
export function ifMatch(req:Request):number{const value=req.headers.get('if-match');if(!value)throw new HelpdeskError(428,'precondition_required','Informe If-Match com a versão atual.');if(!/^"[1-9][0-9]*"$/.test(value))throw new HelpdeskError(400,'invalid_if_match','If-Match deve ser uma versão entre aspas.');const n=Number(value.slice(1,-1));if(!Number.isSafeInteger(n))throw new HelpdeskError(400,'invalid_if_match','Versão inválida.');return n;}
