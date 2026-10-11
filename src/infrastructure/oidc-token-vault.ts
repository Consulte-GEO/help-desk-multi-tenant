import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {HelpdeskError} from '../domain/errors.ts';
const unavailable=()=>new HelpdeskError(503,'oidc_vault_unavailable','Não foi possível proteger os dados privados do fluxo.');
/** AEAD building block for the existing server secret custody. Supply a reviewed
 * 32-byte key from secret configuration; never a request or a bundled default.
 * Context must include purpose + record identity + registration/generation.
 * Key rotation/storage/backup remain deployment responsibilities, not this codec.
 */
export function createOidcTokenVault(input:Uint8Array){
 if(!(input instanceof Uint8Array)||input.length!==32)throw unavailable();const key=Buffer.from(input);let destroyed=false;
 const context=(value:string)=>{if(destroyed||typeof value!=='string'||!value||Buffer.byteLength(value)>2048)throw unavailable();return Buffer.from('helpdesk-oidc-v1\0'+value);};
 const seal=(plaintext:string,aad:string):string=>{
  try{const additional=context(aad);if(typeof plaintext!=='string'||!plaintext||Buffer.byteLength(plaintext)>131072)throw unavailable();
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(additional);const encrypted=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
   return ['v1',iv.toString('base64url'),encrypted.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
  }catch{throw unavailable();}
 };
 const open=(envelope:string,aad:string):string=>{
  try{const additional=context(aad);if(typeof envelope!=='string'||envelope.length>180000)throw unavailable();const parts=envelope.split('.');if(parts.length!==4||parts[0]!=='v1')throw unavailable();
   const data=parts.slice(1).map(p=>{if(!p||!/^[A-Za-z0-9_-]+$/.test(p))throw unavailable();const b=Buffer.from(p,'base64url');if(b.toString('base64url')!==p)throw unavailable();return b;});
   if(data[0]!.length!==12||data[2]!.length!==16)throw unavailable();const decipher=createDecipheriv('aes-256-gcm',key,data[0]!);decipher.setAAD(additional);decipher.setAuthTag(data[2]!);
   return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat([decipher.update(data[1]!),decipher.final()]));
  }catch{throw unavailable();}
 };
 return Object.freeze({seal,open,destroy(){destroyed=true;key.fill(0);}});
}
