// Browser-safe client. Only the pure canonical contract is a runtime dependency;
// server service, repository, credentials and private object locators are never imported.
import {copyJson,record,uuid,integer,sha,enumValue,text,parseSnapshot,canonicalJson,contentHash} from '../import-process/canonical.ts';
import type {Process,Revision,Artifact,WriteResult,ReceiptLookup} from '../import-process/contracts.ts';
export interface CaseData {process:Process;currentRevision:Revision;artifacts:Omit<Artifact,'objectKey'|'objectVersion'>[];}
export type WriteOutcome='not_started'|'not_committed'|'unknown';
export class ProcessHttpError extends Error {
 readonly code:string; readonly status:number; readonly outcome:WriteOutcome; readonly requestId:string|null;
 constructor(code:string,status:number,outcome:WriteOutcome,requestId:string|null=null){
  const label=code==='VERSION_CONFLICT'?'O processo foi alterado por outra sessão.':outcome==='unknown'?
   'Não foi possível confirmar a gravação. Recupere o recibo repetindo a mesma operação.':'Não foi possível concluir o pedido.';
  super(label);this.name='ProcessHttpError';this.code=code;this.status=status;this.outcome=outcome;this.requestId=requestId;
 }
}
export interface ClientOptions {sessionFetch(input:string,init:RequestInit):Promise<Response>;basePath?:string;timeoutMs?:number;}
const PROCESS_KEYS=['workspaceId','accountId','caseId','workRef','requesterId','createdBy','purpose','target','status','linkState','version','headRevision','headHash','createdAt','updatedAt'];
function date(v:unknown){if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('INVALID_DATE');}
async function revision(raw:unknown,caseId:string,number?:number):Promise<Revision> {
 const r=record(raw,['workspaceId','accountId','caseId','number','parentHash','actorId','reason','createdAt','snapshot','hash']);
 [r.workspaceId,r.accountId,r.caseId,r.actorId].forEach(uuid);integer(r.number,1);sha(r.hash);
 if(r.caseId!==caseId||number!==undefined&&r.number!==number)throw Error('WRONG_REVISION');
 if(r.parentHash!==null)sha(r.parentHash);text(r.reason,1,1000);date(r.createdAt);parseSnapshot(r.snapshot);
 const {hash,...body}=r;if(await contentHash(body)!==hash)throw Error('INVALID_REVISION_HASH');
 return r as unknown as Revision;
}
async function caseData(raw:unknown,caseId:string):Promise<CaseData> {
 const x=record(raw,['process','currentRevision','artifacts']),p=record(x.process,PROCESS_KEYS);
 [p.workspaceId,p.accountId,p.caseId,p.requesterId,p.createdBy].forEach(uuid);
 if(p.caseId!==caseId)throw Error('WRONG_CASE');if(p.workRef!==null)text(p.workRef,1,512);
 integer(p.version,1);integer(p.headRevision,1,p.version as number);sha(p.headHash);date(p.createdAt);date(p.updatedAt);
 enumValue(p.status,['draft','cancelled']);enumValue(p.linkState,['awaiting_ticket']);enumValue(p.purpose,['new_work','history','reports','reconciliation']);
 const target=record(p.target,['system','contractVersion']);text(target.system,1,100);text(target.contractVersion,1,100);
 const r=await revision(x.currentRevision,caseId,p.headRevision as number);
 if(r.hash!==p.headHash||r.accountId!==p.accountId||r.workspaceId!==p.workspaceId)throw Error('WRONG_HEAD');
 if(!Array.isArray(x.artifacts)||x.artifacts.length>1000)throw Error('INVALID_ARTIFACTS');
 const seen=new Set<string>();for(const raw of x.artifacts){
  const a=record(raw,['workspaceId','accountId','caseId','id','name','mime','bytes','sha256','status','rejectionCode','createdBy','createdAt','verifiedAt','retainUntil']);
  uuid(a.id);uuid(a.createdBy);if(seen.has(a.id as string))throw Error('DUPLICATE_ARTIFACT');seen.add(a.id as string);
  if(a.workspaceId!==p.workspaceId||a.accountId!==p.accountId||a.caseId!==caseId)throw Error('WRONG_ARTIFACT');
  text(a.name,1,200);text(a.mime,1,128);integer(a.bytes,1,60*1024*1024);sha(a.sha256);enumValue(a.status,['pending','ready','rejected']);
  date(a.createdAt);date(a.retainUntil);if(a.verifiedAt!==null)date(a.verifiedAt);if(a.rejectionCode!==null)text(a.rejectionCode,1,128);
 }
 return x as unknown as CaseData;
}
function receipt(raw:unknown,caseId:string,operationId:string,expectedVersion:number):WriteResult {
 const extra=raw&&typeof raw==='object'&&Object.hasOwn(raw,'artifactId')?['artifactId','artifactStatus']:[];
 const r=record(raw,['caseId','operationId','version','revision','hash','status','replayed',...extra]);
 if(r.caseId!==caseId||r.operationId!==operationId||r.version!==expectedVersion+1||typeof r.replayed!=='boolean')throw Error('WRONG_RECEIPT');
 integer(r.revision,1,r.version as number);sha(r.hash);enumValue(r.status,['draft','cancelled']);
 if(extra.length){uuid(r.artifactId);enumValue(r.artifactStatus,['pending','ready','rejected']);}
 return r as unknown as WriteResult;
}
const etag=(caseId:string,version:number)=>`"imp:${caseId}:${version}"`;
async function readBody(r:Response,signal:AbortSignal):Promise<unknown> {
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers.get('content-type')||'')||!r.body)throw Error('INVALID_RESPONSE');
 const reader=r.body.getReader();let done=false;
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try {
  let size=0;const chunks:Uint8Array[]=[];
  for(;;){const p=await reader.read();if(p.done){done=true;break;}size+=p.value.byteLength;if(size>4*1024*1024)throw Error('RESPONSE_TOO_LARGE');chunks.push(p.value);}
  if(signal.aborted)throw Error('ABORTED');const all=new Uint8Array(size);let at=0;for(const p of chunks){all.set(p,at);at+=p.length;}
  return copyJson(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all)),4*1024*1024);
 }finally{signal.removeEventListener('abort',cancel);if(!done)cancel();reader.releaseLock();}
}
/** Uses the host's session fetch. No token persistence or automatic network retries. */
export function createImportProcessClient(o:ClientOptions){
 const base=o.basePath??'/v1/import-processes',timeout=o.timeoutMs??45000;
 if(typeof o.sessionFetch!=='function'||!/^\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/.test(base)||!Number.isInteger(timeout)||timeout<1||timeout>120000)throw Error('INVALID_CLIENT_CONFIG');
 async function send<T>(path:string,body:unknown|undefined,signal:AbortSignal|undefined,check:(x:unknown,r:Response)=>Promise<T>|T):Promise<T>{
  const writing=body!==undefined,ctl=new AbortController();let dispatched=false,timer:ReturnType<typeof setTimeout>|undefined;
  let rejectAbort:(e:unknown)=>void=()=>{};
  const unavailable=()=>new ProcessHttpError('TRANSPORT_UNAVAILABLE',0,writing&&dispatched?'unknown':'not_started');
  const abort=()=>{ctl.abort();rejectAbort(unavailable());};
  if(signal?.aborted)throw unavailable();
  let serialized:string|undefined;const headers:Record<string,string>={Accept:'application/json'};
  try {
   if(writing){serialized=canonicalJson(body);const b=body as {operationId:string;expectedVersion:number};uuid(b.operationId);integer(b.expectedVersion);
    headers['Content-Type']='application/json';headers['Idempotency-Key']=b.operationId;
    if(path){headers['If-Match']=etag(path.split('/')[1]!,b.expectedVersion);}
   }
  }catch{throw new ProcessHttpError('CLIENT_INVALID_INPUT',0,'not_started');}
  signal?.addEventListener('abort',abort,{once:true});
  const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject;timer=setTimeout(abort,timeout);if(signal?.aborted)abort();});
  const work=async():Promise<T>=>{
   if(ctl.signal.aborted)throw unavailable();dispatched=true;
   let r:Response;try{r=await o.sessionFetch(base+path,{method:writing?'POST':'GET',headers,body:serialized,signal:ctl.signal,redirect:'error',cache:'no-store',credentials:'omit'});}catch{throw unavailable();}
   let raw:unknown;try{raw=await readBody(r,ctl.signal);}catch{throw new ProcessHttpError('INVALID_RESPONSE',r.status,writing?'unknown':'not_started');}
   const requestId=r.headers.get('x-request-id');
   if(!r.ok){
    try{
     const e=record(raw,['status','code','message','requestId','outcome']);uuid(e.requestId);
     if(e.status!==r.status||e.requestId!==requestId||typeof e.code!=='string'||!/^[A-Z][A-Z0-9_]{1,79}$/.test(e.code))throw Error();
     const outcome=enumValue(e.outcome,['not_started','not_committed','unknown']);
     if(e.code==='WRITE_OUTCOME_UNKNOWN'&&outcome!=='unknown')throw Error();
     throw new ProcessHttpError(e.code,r.status,outcome,requestId);
    }catch(e){if(e instanceof ProcessHttpError)throw e;throw new ProcessHttpError('INVALID_RESPONSE',r.status,writing?'unknown':'not_started');}
   }
   try{return await check(raw,r);}catch{throw new ProcessHttpError('INVALID_RESPONSE',r.status,writing?'unknown':'not_started',requestId);}
  };
  try{return await Promise.race([interrupted,work()]);}
  finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);ctl.abort();}
 }
 function write(path:string,caseId:string,input:unknown,signal?:AbortSignal){
  const body=copyJson(input) as {operationId:string;expectedVersion:number};
  return send(path,body,signal,(x,r)=>{
   const out=receipt(x,caseId,body.operationId,body.expectedVersion);
   if(r.headers.get('etag')!==etag(caseId,out.version)||![200,201].includes(r.status))throw Error('ETAG_MISMATCH');return out;
  });
 }
 return {
  async createCase(input:unknown,signal?:AbortSignal){const body=copyJson(input) as {scope:{caseId:string}};return write('',uuid(body.scope.caseId),body,signal);},
  async getCase(caseId:string,signal?:AbortSignal):Promise<CaseData>{uuid(caseId);return send('/'+caseId,undefined,signal,async(x,r)=>{
   if(r.status!==200)throw Error();const d=await caseData(x,caseId);if(r.headers.get('etag')!==etag(caseId,d.process.version))throw Error();return d;
  });},
  async getRevision(caseId:string,number:number,signal?:AbortSignal){uuid(caseId);integer(number,1);return send('/'+caseId+'/revisions/'+number,undefined,signal,async(x,r)=>{
   const v=await revision(x,caseId,number);if(r.status!==200||r.headers.get('etag')!==`"rev:${caseId}:${number}:${v.hash}"`)throw Error();return v;
  });},
  async getOperationReceipt(caseId:string,operationId:string,expectedVersion:number,requestHash:string,signal?:AbortSignal):Promise<ReceiptLookup>{
   uuid(caseId);uuid(operationId);integer(expectedVersion);sha(requestHash);
   return send('/'+caseId+'/operations/'+operationId,undefined,signal,(raw,r)=>{
    if(r.status!==200)throw Error('INVALID_STATUS');
    const x=record(raw,['caseId','operationId','status','requestHash','receipt']);
    if(x.caseId!==caseId||x.operationId!==operationId)throw Error('WRONG_OPERATION');
    if(x.status==='unconfirmed'){
     if(x.receipt!==null||x.requestHash!==null||r.headers.has('etag'))throw Error('INVALID_UNCONFIRMED');
    }else if(x.status==='confirmed'){
     if(sha(x.requestHash)!==requestHash)throw Error('REQUEST_HASH_MISMATCH');
     const value=receipt(x.receipt,caseId,operationId,expectedVersion);
     if(value.replayed!==true||r.headers.get('etag')!==etag(caseId,value.version))throw Error('INVALID_RECEIPT');
    }else throw Error('INVALID_LOOKUP_STATUS');
    return x as unknown as ReceiptLookup;
   });
  },
  saveRevision(caseId:string,input:unknown,signal?:AbortSignal){return write('/'+uuid(caseId)+'/revisions',caseId,input,signal);},
  cancelCase(caseId:string,input:unknown,signal?:AbortSignal){return write('/'+uuid(caseId)+'/cancellation',caseId,input,signal);},
  registerArtifact(caseId:string,input:unknown,signal?:AbortSignal){return write('/'+uuid(caseId)+'/artifacts',caseId,input,signal);},
  finalizeArtifact(caseId:string,artifactId:string,input:unknown,signal?:AbortSignal){return write('/'+uuid(caseId)+'/artifacts/'+uuid(artifactId)+'/verification',caseId,input,signal);}
 };
}
export type ImportProcessClient=ReturnType<typeof createImportProcessClient>;
