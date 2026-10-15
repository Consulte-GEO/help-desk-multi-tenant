import {HelpdeskError} from '../domain/errors.ts';

export type RuntimeConfig={
 databaseUrl?:string;supabaseUrl?:string;publishableKey?:string;databaseCa?:string;
 releaseApproved?:string;rateLimitHmacKey?:string;consulteGeoAdministration?:string;consulteGeoWorkflow?:string;consulteGeoIntake?:string;consulteGeoOrigin?:string;consulteGeoSourceMode?:string;registrationReview?:string;
};
export type BackendConfig={
 databaseUrl:string;supabaseUrl:string;publishableKey:string;databaseCa?:string;rateLimitHmacKey:string;
};
const invalid=()=>new HelpdeskError(503,'invalid_configuration','Configuração do backend inválida.');
const control=/[\u0000-\u001f\u007f]/;

/** Pure validation shared with the private diagnostic. It never grants permission to serve requests. */
export function validateBackendConfig(c:RuntimeConfig):BackendConfig{
 if(!c||typeof c!=='object'||Array.isArray(c))throw invalid();
 for(const field of ['databaseUrl','supabaseUrl','publishableKey','databaseCa','releaseApproved','rateLimitHmacKey'] as const)
  if(c[field]!==undefined&&typeof c[field]!=='string')throw invalid();
 if(!c.databaseUrl||!c.supabaseUrl||!c.publishableKey)
  throw new HelpdeskError(503,'configuration_required','Configuração do backend incompleta.');
 // WHATWG URL accepts/normalizes some whitespace. Configuration must not be repaired silently.
 if(/[\u0000-\u0020\u007f]/.test(c.databaseUrl)||/[\u0000-\u0020\u007f]/.test(c.supabaseUrl))throw invalid();
 let db:URL,supabase:URL,username:string,password:string,database:string;
 try{
  db=new URL(c.databaseUrl);supabase=new URL(c.supabaseUrl);
  username=decodeURIComponent(db.username);password=decodeURIComponent(db.password);database=decodeURIComponent(db.pathname);
 }catch{throw invalid();}
 if(control.test(username)||control.test(password)||control.test(database))throw invalid();
 if(!['postgres:','postgresql:'].includes(db.protocol)||!/^helpdesk_app(?:\.[A-Za-z0-9_-]+)?$/.test(username)||!password||!db.hostname||database.length<2)
  throw new HelpdeskError(503,'unsafe_database_configuration','Configure o login PostgreSQL restrito do Help Desk.');
 // A query option can replace pg's SSL object. TLS options belong in the server-side config only.
 if(db.search||db.hash)
  throw new HelpdeskError(503,'unsafe_tls_configuration','Configure TLS pelo backend, sem parâmetros SSL na URL.');
 if(supabase.protocol!=='https:'||supabase.username||supabase.password||supabase.search||supabase.hash
  ||!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(c.supabaseUrl)
  ||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey))
  throw new HelpdeskError(503,'invalid_auth_configuration','Configure a URL oficial e uma chave publicável do projeto.');
 if(!c.rateLimitHmacKey||! /^[A-Za-z0-9_-]{43,128}$/.test(c.rateLimitHmacKey))
  throw new HelpdeskError(503,'rate_limit_configuration_required','Configure a chave HMAC exclusiva do limitador no servidor.');
 return {rateLimitHmacKey:c.rateLimitHmacKey,databaseUrl:c.databaseUrl,supabaseUrl:supabase.origin,
  publishableKey:c.publishableKey,...(c.databaseCa?{databaseCa:c.databaseCa}:{})};
}

/** Production gate remains first. The diagnostic must not call this with a fabricated approval. */
export function validateRuntimeConfig(c:RuntimeConfig):BackendConfig{
 if(c?.releaseApproved!=='true')
  throw new HelpdeskError(503,'release_gate_closed','Ambiente ainda não liberado para atendimento.');
 return validateBackendConfig(c);
}
