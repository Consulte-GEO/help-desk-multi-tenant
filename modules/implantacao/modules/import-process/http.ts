import {ProcessError,copyJson,record,uuid,integer,canonicalJson,MAX_JSON_BYTES,text} from './canonical.ts';
import type {Scope,Operation} from './contracts.ts';
import type {createImportProcessService} from './service.ts';

export type ImportProcessService=ReturnType<typeof createImportProcessService>;
export interface ImportProcessHttpOptions {
  origin:string;
  service:ImportProcessService;
  /** All ports are constructed by the trusted host, never deserialized from HTTP. */
  authenticate(request:Request,signal:AbortSignal):Promise<unknown|null>;
  locate(credential:unknown,caseId:string,operation:Operation,signal:AbortSignal):Promise<Scope|null>;
  admit(credential:unknown,operation:Operation,signal:AbortSignal):Promise<boolean>;
  /** Closed by default. Enabling a draft endpoint does not approve operations. */
  enabled?:()=>boolean;
  timeouts?:{portMs:number;bodyMs:number};
}
type Outcome='not_started'|'not_committed'|'unknown';
class BoundaryError extends Error {
  readonly status:number; readonly code:string;
  constructor(status:number,code:string){super(code);this.status=status;this.code=code;}
}
function deny(status:number,code:string):never {throw new BoundaryError(status,code);}
const messages:Record<string,string>={
 PROCESS_GATE_CLOSED:'Módulo indisponível até sua qualificação e liberação.',
 AUTHENTICATION_REQUIRED:'Entre novamente para continuar.',
 ACCESS_DENIED:'Você não tem acesso a este processo.',
 CASE_NOT_FOUND:'Processo não encontrado ou indisponível.',
 VERSION_CONFLICT:'O processo foi alterado. Preserve sua edição e confira a versão atual.',
 WRITE_OUTCOME_UNKNOWN:'Não foi possível confirmar a gravação. Repita a mesma operação para recuperar o recibo.',
 PRECONDITION_REQUIRED:'A versão confirmada do processo é obrigatória.',
 INVALID_COMMAND:'O pedido contém campos inválidos ou incompatíveis.',
 RATE_LIMITED:'Limite de solicitações atingido. Tente novamente sem alterar a operação.',
};
function response(body:unknown,status:number,requestId:string,etag?:string):Response {
 const headers:Record<string,string>={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Authorization, Origin','x-request-id':requestId};
 if(etag)headers.etag=etag;
 return new Response(canonicalJson(body,4*MAX_JSON_BYTES),{status,headers});
}
export function processEtag(caseId:string,version:number):string {
 return `"imp:${uuid(caseId)}:${integer(version,1)}"`;
}
function precondition(req:Request,caseId:string,version:number) {
 const raw=req.headers.get('if-match');if(!raw)deny(428,'PRECONDITION_REQUIRED');
 const found=/^"imp:([0-9a-f-]{36}):([1-9][0-9]*)"$/.exec(raw);
 if(!found||found[1]!==caseId||!Number.isSafeInteger(Number(found[2])))deny(400,'INVALID_PRECONDITION');
 if(Number(found[2])!==version)deny(400,'PRECONDITION_BODY_MISMATCH');
}
async function bounded<T>(milliseconds:number,parent:AbortSignal,action:(signal:AbortSignal)=>Promise<T>):Promise<T> {
 if(parent.aborted)deny(409,'REQUEST_ABORTED');
 const c=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let rejectAbort:(reason:unknown)=>void=()=>{};
 const abort=()=>{c.abort();rejectAbort(new BoundaryError(409,'REQUEST_ABORTED'));};
 parent.addEventListener('abort',abort,{once:true});
 try {
  return await Promise.race([Promise.resolve().then(()=>action(c.signal)),new Promise<never>((_,reject)=>{
   rejectAbort=reject;timer=setTimeout(()=>{c.abort();reject(new Error('PORT_TIMEOUT'));},milliseconds);
   if(parent.aborted)abort();
  })]);
 } finally {if(timer)clearTimeout(timer);parent.removeEventListener('abort',abort);c.abort();}
}
async function jsonBody(req:Request,ms:number):Promise<unknown> {
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))deny(415,'JSON_REQUIRED');
 if(req.headers.has('content-encoding')&&req.headers.get('content-encoding')!=='identity')deny(415,'CONTENT_ENCODING_NOT_SUPPORTED');
 const declared=req.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||!Number.isSafeInteger(Number(declared))))deny(400,'INVALID_CONTENT_LENGTH');
 if(declared!==null&&Number(declared)>MAX_JSON_BYTES)deny(413,'PAYLOAD_TOO_LARGE');
 if(!req.body)deny(400,'INVALID_JSON');
 const reader=req.body.getReader();let done=false;
 try {
  const bytes=await bounded(ms,req.signal,async signal=>{
   const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
   try {
    const chunks:Uint8Array[]=[];let count=0;
    while(true){const x=await reader.read();if(x.done){done=true;break;}count+=x.value.byteLength;
     if(count>MAX_JSON_BYTES)deny(413,'PAYLOAD_TOO_LARGE');chunks.push(x.value);
    }
    if(signal.aborted)throw new Error('BODY_CANCELLED');
    if(declared!==null&&Number(declared)!==count)deny(400,'CONTENT_LENGTH_MISMATCH');
    const result=new Uint8Array(count);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
   } finally {signal.removeEventListener('abort',cancel);}
  });
  try {return copyJson(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}
  catch(error){if(error instanceof ProcessError&&error.code==='JSON_LIMIT')deny(413,'PAYLOAD_TOO_LARGE');deny(400,'INVALID_JSON');}
 } catch(error){if(error instanceof BoundaryError)throw error;deny(408,'BODY_TIMEOUT');}
 finally {if(!done)void reader.cancel().catch(()=>{});reader.releaseLock();}
}
function commandBody(input:unknown,keys:string[]):Record<string,unknown> {
 try {return record(input,keys);}catch{deny(422,'INVALID_COMMAND');}
}
interface Route {operation:Operation;kind:'create'|'read'|'revision'|'receipt'|'save'|'cancel'|'register'|'verify';caseId?:string;number?:number;artifactId?:string;operationId?:string;method:'GET'|'POST';extra:string[];}
function route(url:URL):Route {
 const base='/v1/import-processes',p=url.pathname;
 if(url.search)deny(400,'QUERY_NOT_ALLOWED');
 if(p===base)return {kind:'create',operation:'create',method:'POST',extra:['scope','purpose','target','snapshot','reason']};
 const r=/^\/v1\/import-processes\/([0-9a-f-]{36})(?:\/(revisions|cancellation|artifacts|operations)(?:\/([0-9a-f-]+)(?:\/(verification))?)?)?$/.exec(p);
 if(!r)deny(404,'ROUTE_NOT_FOUND');
 let caseId:string;try{caseId=uuid(r[1]);}catch{deny(404,'ROUTE_NOT_FOUND');}
 if(!r[2])return {kind:'read',operation:'read',caseId,method:'GET',extra:[]};
 if(r[2]==='operations'&&r[3]&&!r[4]){
  let operationId:string;try{operationId=uuid(r[3]);}catch{deny(404,'ROUTE_NOT_FOUND');}
  return {kind:'receipt',operation:'read',caseId,operationId,method:'GET',extra:[]};
 }
 if(r[2]==='revisions'&&!r[3])return {kind:'save',operation:'revise',caseId,method:'POST',extra:['snapshot','reason']};
 if(r[2]==='revisions'&&r[3]&&!r[4]&&/^[1-9][0-9]*$/.test(r[3])){
  let number:number;try{number=integer(Number(r[3]),1);}catch{deny(404,'ROUTE_NOT_FOUND');}
  return {kind:'revision',operation:'read',caseId,number,method:'GET',extra:[]};
 }
 if(r[2]==='cancellation'&&!r[3])return {kind:'cancel',operation:'cancel',caseId,method:'POST',extra:['reason']};
 if(r[2]==='artifacts'&&!r[3])return {kind:'register',operation:'artifact.register',caseId,method:'POST',extra:['name','mime','bytes','sha256']};
 if(r[2]==='artifacts'&&r[3]&&r[4]==='verification'){
  let artifactId:string;try{artifactId=uuid(r[3]);}catch{deny(404,'ROUTE_NOT_FOUND');}
  return {kind:'verify',operation:'artifact.verify',caseId,artifactId,method:'POST',extra:[]};
 }
 return deny(404,'ROUTE_NOT_FOUND');
}
function serviceError(error:unknown,writing:boolean,started:boolean):{status:number;code:string;outcome:Outcome} {
 const outcome:Outcome=started?'not_committed':'not_started';
 if(error instanceof BoundaryError)return {status:error.status,code:error.code,outcome};
 if(error instanceof ProcessError){
  const code=error.code;
  if(['ACCESS_DENIED','AUTHORITY_SCOPE_MISMATCH','AUTHORITY_EXPIRED'].includes(code))return {status:403,code:'ACCESS_DENIED',outcome};
  if(code==='CASE_NOT_FOUND')return {status:404,code,outcome};
  if(code==='VERSION_CONFLICT')return {status:412,code,outcome};
  if(['IDEMPOTENCY_CONFLICT','CASE_ALREADY_EXISTS','CASE_NOT_EDITABLE','ARTIFACT_NOT_PENDING','ARTIFACT_CHANGED','AUTHORITY_CHANGED'].includes(code))return {status:409,code,outcome};
  if(code==='JSON_LIMIT'||code==='ARTIFACT_QUOTA')return {status:413,code:'PAYLOAD_TOO_LARGE',outcome};
  if(code==='PROCESS_STORAGE_UNAVAILABLE'||code==='AUTHORITY_UNAVAILABLE'||code==='INSPECTION_UNAVAILABLE')return {status:503,code,outcome};
  if(['PROCESS_INTEGRITY','REVISION_INTEGRITY','ARTIFACT_INTEGRITY','RECEIPT_INTEGRITY','INVALID_CLOCK'].includes(code))return {status:503,code:'PROCESS_INTEGRITY_FAILURE',outcome};
  if(code.startsWith('INVALID_')||['ARTIFACT_NOT_READY','ARTIFACT_NOT_DECLARED','DUPLICATE_ARTIFACT','DUPLICATE_SOURCE_ID','RECORD_REFERENCE_NOT_FOUND','SOURCE_LOCATION_REQUIRED','PRESENCE_VALUE_CONFLICT','SEMANTIC_MEASUREMENT_CONFLICT'].includes(code))return {status:422,code:'INVALID_COMMAND',outcome};
 }
 return {status:503,code:writing&&started?'WRITE_OUTCOME_UNKNOWN':'PROCESS_UNAVAILABLE',outcome:writing&&started?'unknown':'not_started'};
}
/** Web Request/Response adapter; the trusted host supplies DB, sessions and grants. */
export function createImportProcessHttpHandler(o:ImportProcessHttpOptions):(req:Request)=>Promise<Response> {
 const u=new URL(o.origin);
 if(u.origin!==o.origin||u.username||u.password||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('INVALID_HTTP_ORIGIN');
 for(const port of ['authenticate','locate','admit'] as const)if(typeof o[port]!=='function')throw new Error('INVALID_HTTP_PORTS');
 if(!o.service||typeof o.service.createCase!=='function')throw new Error('INVALID_HTTP_PORTS');
 const portMs=integer(o.timeouts?.portMs??5000,1,10000),bodyMs=integer(o.timeouts?.bodyMs??5000,1,10000);
 return async(req:Request)=>{
  const requestId=crypto.randomUUID();let writing=false,started=false;
  try {
   const r=route(new URL(req.url));writing=r.method==='POST';
   if(o.enabled?.()!==true)deny(503,'PROCESS_GATE_CLOSED');
   if(req.method!==r.method)deny(405,'METHOD_NOT_ALLOWED');
   if(req.signal.aborted)deny(409,'REQUEST_ABORTED');
   const origin=req.headers.get('origin');
   if(writing&&origin!==o.origin||origin!==null&&origin!==o.origin)deny(403,'ORIGIN_DENIED');
   const bearer=req.headers.get('authorization')||'';
   if(bearer.length>8192||!/^Bearer [A-Za-z0-9._~+\/-]+=*$/.test(bearer))deny(401,'AUTHENTICATION_REQUIRED');
   let credential:unknown;
   try {credential=await bounded(portMs,req.signal,s=>o.authenticate(req,s));}
   catch(error){if(error instanceof BoundaryError)throw error;deny(503,'AUTHENTICATION_UNAVAILABLE');}
   if(credential===null||credential===undefined||credential===false)deny(401,'AUTHENTICATION_REQUIRED');
   let admitted:boolean;
   try {admitted=await bounded(portMs,req.signal,s=>o.admit(credential,r.operation,s));}
   catch(error){if(error instanceof BoundaryError)throw error;deny(503,'ADMISSION_UNAVAILABLE');}
   if(admitted!==true){if(admitted===false)deny(429,'RATE_LIMITED');deny(503,'ADMISSION_UNAVAILABLE');}
   let body:Record<string,unknown>={},scope:Scope;
   if(writing){
    body=commandBody(await jsonBody(req,bodyMs),['operationId','expectedVersion',...r.extra]);
    try{uuid(body.operationId);integer(body.expectedVersion);}catch{deny(422,'INVALID_COMMAND');}
    const key=req.headers.get('idempotency-key');if(!key)deny(400,'IDEMPOTENCY_KEY_REQUIRED');
    if(key!==body.operationId)deny(400,'IDEMPOTENCY_KEY_MISMATCH');
    if(r.caseId)precondition(req,r.caseId,body.expectedVersion as number);
   }
   if(r.kind==='create'){
    try {const s=record(body.scope,['workspaceId','accountId','caseId','workRef']);uuid(s.caseId);scope=s as unknown as Scope;}catch{deny(422,'INVALID_COMMAND');}
   }else{
    let found:Scope|null;
    try{found=await bounded(portMs,req.signal,s=>o.locate(credential,r.caseId!,r.operation,s));}
    catch(error){if(error instanceof BoundaryError)throw error;deny(503,'DIRECTORY_UNAVAILABLE');}
    if(!found)deny(404,'CASE_NOT_FOUND');
    try{scope=copyJson(found);record(scope,['workspaceId','accountId','caseId','workRef']);[scope.workspaceId,scope.accountId,scope.caseId].forEach(uuid);if(scope.workRef!==null)text(scope.workRef,1,512);if(scope.caseId!==r.caseId)throw Error();}
    catch{deny(503,'DIRECTORY_UNAVAILABLE');}
   }
   if(req.signal.aborted)deny(409,'REQUEST_ABORTED');
   if(r.kind==='read'){
    const result=await o.service.getCase(credential,scope);
    return response(result,200,requestId,processEtag(result.process.caseId,result.process.version));
   }
   if(r.kind==='revision'){
    const result=await o.service.getRevision(credential,scope,r.number!);
    return response(result,200,requestId,`"rev:${result.caseId}:${result.number}:${result.hash}"`);
   }
   if(r.kind==='receipt'){
    const result=await o.service.getOperationReceipt(credential,scope,r.operationId!);
    return response(result,200,requestId,result.status==='confirmed'?processEtag(result.caseId,result.receipt.version):undefined);
   }
   const input={...body,scope,...(r.kind==='verify'?{artifactId:r.artifactId}:{})};
   started=true;
   const result=r.kind==='create'?await o.service.createCase(credential,input):r.kind==='save'?await o.service.saveRevision(credential,input):
    r.kind==='cancel'?await o.service.cancelCase(credential,input):r.kind==='register'?await o.service.registerArtifact(credential,input):await o.service.finalizeArtifact(credential,input);
   // An aborted HTTP stream is not evidence of a rollback. The same operation key recovers the receipt.
   if(req.signal.aborted)return response({code:'WRITE_OUTCOME_UNKNOWN',message:messages.WRITE_OUTCOME_UNKNOWN,requestId,outcome:'unknown'},503,requestId);
   return response(result,r.kind==='create'&&!result.replayed?201:200,requestId,processEtag(result.caseId,result.version));
  }catch(error){
   const mapped=serviceError(error,writing,started);
   return response({...mapped,message:messages[mapped.code]||'Não foi possível concluir o pedido com segurança.',requestId},mapped.status,requestId);
  }
 };
}
