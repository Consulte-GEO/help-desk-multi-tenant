import {fail,integer,record,text,uuid} from './canonical.ts';
import type {Artifact,Inspection} from './contracts.ts';

export const ARTIFACT_BUCKET='setup-import-artifacts';
const MAX_BYTES=60*1024*1024;
type Fetcher=typeof globalThis.fetch;
type EndpointOptions={allowInsecureLocalhost?:boolean};
function endpoint(value:string,options:EndpointOptions):URL {
 let url:URL;try{url=new URL(value);}catch{fail('INVALID_STORAGE_ENDPOINT');}
 if(url.username||url.password||url.search||url.hash||
   (url.protocol!=='https:'&&!(options.allowInsecureLocalhost&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))fail('INVALID_STORAGE_ENDPOINT');
 return url;
}
function objectPath(key:string):string {
 const parts=text(key,1,512).split('/');if(parts.length!==4)fail('INVALID_ARTIFACT_KEY');
 parts.forEach(uuid);return parts.join('/');
}
/** This is a defense against accidental privileged configuration, not JWT verification.
 * Supabase validates signature/expiry and enforces its storage policies. */
function authenticatedToken(raw:string):string {
 text(raw,1,12000);
 try {
  const part=raw.split('.')[1];if(!part)fail('INVALID_STORAGE_CREDENTIAL');
  const claims=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  if(claims.role!=='authenticated'||typeof claims.sub!=='string')fail('INVALID_STORAGE_CREDENTIAL');uuid(claims.sub);
 }catch{fail('INVALID_STORAGE_CREDENTIAL');}
 return raw;
}
function publicApiKey(raw:string):string {
 const key=text(raw,1,12000);
 if(key.startsWith('sb_secret_'))fail('INVALID_STORAGE_CREDENTIAL');
 if(!key.startsWith('sb_publishable_')){
  try{const p=JSON.parse(atob(key.split('.')[1]!.replace(/-/g,'+').replace(/_/g,'/')));if(p.role!=='anon')fail('INVALID_STORAGE_CREDENTIAL');}
  catch{fail('INVALID_STORAGE_CREDENTIAL');}
 }
 return key;
}
async function boundedBody(response:Response,max:number):Promise<Uint8Array<ArrayBuffer>> {
 const announced=response.headers.get('content-length');
 if(announced!==null&&(!/^\d+$/.test(announced)||Number(announced)>max)){await response.body?.cancel();fail('STORAGE_BODY_LIMIT');}
 const reader=response.body?.getReader();if(!reader)fail('EMPTY_STORAGE_BODY');
 const chunks:Uint8Array[]=[];let size=0;
 try {
  while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;
   if(size>max){await reader.cancel();fail('STORAGE_BODY_LIMIT');}chunks.push(result.value);}
 }finally{reader.releaseLock();}
 if(!size)fail('EMPTY_STORAGE_BODY');
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function json(response:Response):Promise<unknown> {
 if(!response.ok){await response.body?.cancel();fail('STORAGE_DEPENDENCY_UNAVAILABLE');}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBody(response,16384)));}
 catch{fail('STORAGE_INVALID_RESPONSE');}
}
export interface SupabaseInspectorTokenOptions extends EndpointOptions {
 supabaseUrl:string;publishableKey:string;email:string;password:string;userId:string;fetch?:Fetcher;clock?:()=>number;
}
/** Server-only identity. Credentials must come from protected Function secrets.
 * Independent warm instances never share rotating refresh tokens. Each logs in
 * with its own password grant, caches a verified short-lived access token, and
 * discards the refresh token. No administrative key is accepted or needed. */
export function createSupabaseInspectorTokenProvider(options:SupabaseInspectorTokenOptions):{accessToken:()=>Promise<string>} {
 const origin=endpoint(options.supabaseUrl,options);if(origin.pathname!=='/')fail('INVALID_STORAGE_ENDPOINT');
 const apiKey=publicApiKey(options.publishableKey),userId=uuid(options.userId);
 const email=text(options.email,3,320),password=text(options.password,1,4096);
 const send=options.fetch??globalThis.fetch,now=options.clock??Date.now;
 let cached:{token:string;renewAt:number}|undefined,inflight:Promise<string>|undefined,retryAt=0;
 async function authenticate():Promise<string> {
  try{
   // One timeout covers login, bounded response consumption, and server validation.
   const signal=AbortSignal.timeout(5000);
   const read=async(response:Response):Promise<unknown>=>{
    if(!response.ok){await response.body?.cancel();throw Error();}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBody(response,65536)));
   };
   const started=now(),base=origin.origin+'/auth/v1';
   const session=await read(await send(base+'/token?grant_type=password',{method:'POST',headers:{apikey:apiKey,'content-type':'application/json'},
    body:JSON.stringify({email,password}),signal,redirect:'error',cache:'no-store'})) as {access_token?:unknown;token_type?:unknown;expires_in?:unknown};
   if(!session||session.token_type!=='bearer'||typeof session.access_token!=='string')throw Error();
   const token=authenticatedToken(session.access_token);
   const claims=JSON.parse(atob(token.split('.')[1]!.replace(/-/g,'+').replace(/_/g,'/')));
   if(claims.sub!==userId||claims.iss!==base||claims.app_metadata?.setup_import_inspector!==true||
    !Number.isSafeInteger(claims.exp)||claims.exp*1000<=started+60000||claims.exp*1000>started+3660000||
    !Number.isSafeInteger(session.expires_in)||Number(session.expires_in)<=60||Number(session.expires_in)>3600)throw Error();
   // Decoding above only rejects bad configuration. Auth verifies the actual JWT
   // and returns current app_metadata; Storage verifies it again on every read.
   const user=await read(await send(base+'/user',{headers:{apikey:apiKey,Authorization:'Bearer '+token},signal,redirect:'error',cache:'no-store'})) as {id?:unknown;app_metadata?:{setup_import_inspector?:unknown}};
   if(!user||user.id!==userId||user.app_metadata?.setup_import_inspector!==true)throw Error();
   const renewAt=Math.min(claims.exp*1000,started+Number(session.expires_in)*1000)-60000;
   if(renewAt<=now())throw Error();
   cached={token,renewAt};retryAt=0;return token;
  }catch{
   cached=undefined;retryAt=now()+30000;fail('INSPECTOR_AUTH_UNAVAILABLE');
  }
 }
 return {async accessToken(){
  if(cached&&now()<cached.renewAt)return cached.token;
  if(now()<retryAt)fail('INSPECTOR_AUTH_UNAVAILABLE');
  // Share just this instance's renewal, including current failure, across callers.
  if(!inflight)inflight=authenticate().finally(()=>{inflight=undefined;});
  return inflight;
 }};
}
export interface PrivateArtifactBytes {bytes:Uint8Array<ArrayBuffer>;objectVersion:string;private:true;}
export interface PrivateArtifactStorage {read(objectKey:string,signal?:AbortSignal):Promise<PrivateArtifactBytes>;}
export interface SignedArtifactUpload {url:string;method:'PUT';headers:Record<string,string>;expiresIn:7200;}
export interface SupabaseArtifactStorageOptions extends EndpointOptions {
 supabaseUrl:string;publishableKey:string;accessToken:()=>string|Promise<string>;bucket?:string;fetch?:Fetcher;
}
/** Construct separately for requester upload signing and dedicated inspector reads.
 * Caller MUST authorize the case and load its pending Artifact before signing.
 * RLS must independently enforce live case grant + pending registration on INSERT.
 * The inspector identity alone receives SELECT; neither identity receives UPDATE/DELETE. */
export function createSupabaseArtifactStorage(options:SupabaseArtifactStorageOptions) {
 const origin=endpoint(options.supabaseUrl,options);if(origin.pathname!=='/')fail('INVALID_STORAGE_ENDPOINT');
 const bucket=options.bucket??ARTIFACT_BUCKET;if(bucket!==ARTIFACT_BUCKET)fail('INVALID_ARTIFACT_BUCKET');
 const apiKey=publicApiKey(options.publishableKey);
 const send=options.fetch??globalThis.fetch;
 const base=origin.origin+'/storage/v1';
 async function headers(){return {apikey:apiKey,Authorization:'Bearer '+authenticatedToken(await options.accessToken())};}
 return {
  async createSignedUpload(artifact:Artifact,signal?:AbortSignal):Promise<SignedArtifactUpload> {
   const key=objectPath(artifact.objectKey);
   if(key!==[artifact.workspaceId,artifact.accountId,artifact.caseId,artifact.id].join('/')||artifact.status!=='pending')fail('ARTIFACT_NOT_PENDING');
   integer(artifact.bytes,1,MAX_BYTES);text(artifact.mime,1,128);
   const path='/object/upload/sign/'+bucket+'/'+key;
   const result=await json(await send(base+path,{method:'POST',headers:{...await headers(),'content-type':'application/json','x-upsert':'false'},body:'{}',redirect:'error',signal}));
   if(!result||typeof result!=='object'||typeof (result as {url?:unknown}).url!=='string')fail('STORAGE_INVALID_RESPONSE');
   // Match the SDK: Storage returns a path relative to /storage/v1, not origin.
   const signed=new URL(base+(result as {url:string}).url);
   if(signed.origin!==origin.origin||signed.pathname!=='/storage/v1'+path||!signed.searchParams.get('token')||signed.username||signed.password||signed.hash)fail('STORAGE_INVALID_RESPONSE');
   return {url:signed.href,method:'PUT',headers:{'content-type':artifact.mime,'x-upsert':'false','cache-control':'no-store'},expiresIn:7200};
  },
  async read(key:string,signal?:AbortSignal):Promise<PrivateArtifactBytes> {
   objectPath(key);const auth=await headers();
   const raw=await json(await send(base+'/bucket/'+bucket,{headers:auth,redirect:'error',signal,cache:'no-store'}));
   if(!raw||typeof raw!=='object'||(raw as {id?:unknown}).id!==bucket||(raw as {public?:unknown}).public!==false)fail('ARTIFACT_BUCKET_NOT_PRIVATE');
   const response=await send(base+'/object/'+bucket+'/'+key,{headers:auth,redirect:'error',signal,cache:'no-store'});
   if(response.status!==200){await response.body?.cancel();fail('STORAGE_DEPENDENCY_UNAVAILABLE');}
   const version=response.headers.get('etag');
   if(!version||version.startsWith('W/')||!/^"[^"\x00-\x1f]{1,200}"$/.test(version)){await response.body?.cancel();fail('STORAGE_VERSION_UNAVAILABLE');}
   const bytes=await boundedBody(response,MAX_BYTES);
   return {bytes,objectVersion:'etag:'+version,private:true};
  }
 };
}

export interface ContentScanInput {bytes:Uint8Array<ArrayBuffer>;sha256:string;mimeHint:string;}
export interface ContentScanReport {sha256:string;bytes:number;mime:string;scan:'clean'|'infected'|'unavailable';contentValidated:boolean;}
export interface ContentScanner {scan(input:ContentScanInput,signal?:AbortSignal):Promise<ContentScanReport>;}
/** Prepared HTTP gateway protocol. No scanner engine is bundled or implied.
 * Qualified gateway must inspect the exact request bytes and return bounded JSON.
 * contentValidated requires format safety (archive expansion/depth/ratio limits,
 * no encrypted payloads, parser validation); an antivirus OK alone is insufficient. */
export function createHttpContentScanner(options:EndpointOptions&{url:string;token:string;fetch?:Fetcher}):ContentScanner {
 const url=endpoint(options.url,options),token=text(options.token,1,12000),send=options.fetch??globalThis.fetch;
 return {async scan(input,signal){
  const raw=await json(await send(url,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/octet-stream',
   'x-inspection-protocol':'setup-content-inspection/v1','x-content-sha256':input.sha256,'x-content-bytes':String(input.bytes.length),'x-content-mime-hint':input.mimeHint},
   body:input.bytes,signal,redirect:'error'}));
  const report=record(raw,['protocol','sha256','bytes','mime','scan','contentValidated']);
  if(report.protocol!=='setup-content-inspection/v1'||report.sha256!==input.sha256||report.bytes!==input.bytes.length||
    !['clean','infected','unavailable'].includes(String(report.scan))||typeof report.contentValidated!=='boolean')fail('INVALID_CONTENT_INSPECTION');
  text(report.mime,1,128);
  return {sha256:input.sha256,bytes:input.bytes.length,mime:report.mime as string,scan:report.scan as ContentScanReport['scan'],contentValidated:report.contentValidated};
 }};
}
function mimeHint(bytes:Uint8Array):string {
 const starts=(prefix:number[])=>prefix.every((n,i)=>bytes[i]===n);
 if(starts([0x25,0x50,0x44,0x46,0x2d]))return 'application/pdf';
 if(starts([137,80,78,71,13,10,26,10]))return 'image/png';
 if(starts([255,216,255]))return 'image/jpeg';
 if(starts([208,207,17,224,161,177,26,225]))return 'application/vnd.ms-excel';
 if(starts([80,75,3,4]))return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 fail('UNSUPPORTED_ARTIFACT_CONTENT');
}
export function createArtifactInspector(options:{storage:PrivateArtifactStorage;scanner?:ContentScanner}) {
 return {async inspect(key:string,signal?:AbortSignal):Promise<Inspection> {
  if(!options.scanner)fail('INSPECTION_UNAVAILABLE');
  const stored=await options.storage.read(key,signal),bytes=stored.bytes;
  integer(bytes.length,1,MAX_BYTES);if(stored.private!==true)fail('ARTIFACT_BUCKET_NOT_PRIVATE');text(stored.objectVersion,1,400);
  const hint=mimeHint(bytes),hash=await crypto.subtle.digest('SHA-256',bytes);
  const sha256=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  const report=await options.scanner.scan({bytes,sha256,mimeHint:hint},signal);
  if(report.sha256!==sha256||report.bytes!==bytes.length||report.scan==='unavailable')fail('INSPECTION_UNAVAILABLE');
  if(signal?.aborted)throw signal.reason;
  return {sha256,bytes:bytes.length,mime:report.mime,private:true,scan:report.scan,
   contentValidated:report.contentValidated&&report.mime===hint,objectVersion:stored.objectVersion+';sha256:'+sha256};
 }};
}
