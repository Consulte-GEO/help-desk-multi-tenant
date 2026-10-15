import {copyJson,contentHash,record,text,uuid,sha,integer,enumValue,parseSnapshot,canonicalJson,fail,ProcessError} from './canonical.ts';
import type {Snapshot} from './canonical.ts';
import type {Scope,Authority,Operation,Process,Revision,Artifact,WriteResult,Receipt,Options,Transaction,Inspection,ReceiptLookup} from './contracts.ts';

export const LIMITS=Object.freeze({fileBytes:60*1024*1024,caseBytes:1024*1024*1024,files:1000});
const scopeKeys=['workspaceId','accountId','caseId','workRef'] as const;
function selection(input:unknown):Scope {
  const r=record(copyJson(input),scopeKeys);
  uuid(r.workspaceId);uuid(r.accountId);uuid(r.caseId);if(r.workRef!==null)text(r.workRef,1,512);
  return r as unknown as Scope;
}
function matches(scope:Scope,p:Scope):boolean {return scopeKeys.every(k=>scope[k]===p[k]);}
function command(input:unknown,extra:string[]) {
  const r=record(copyJson(input),['scope','operationId','expectedVersion',...extra]);
  r.scope=selection(r.scope);uuid(r.operationId);integer(r.expectedVersion);
  return r as Record<string,unknown>&{scope:Scope;operationId:string;expectedVersion:number};
}
function authorityStamp(a:Authority):string {const {expiresAt:_,...fixed}=a;return canonicalJson(fixed);}
const mimeExtensions:Record<string,string[]>={
 'application/pdf':['pdf'],
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['xlsx'],
 'application/vnd.ms-excel':['xls'], 'image/png':['png'],'image/jpeg':['jpg','jpeg']
};
function fileMetadata(r:Record<string,unknown>) {
 const name=text(r.name,1,200),mime=text(r.mime,1,128);
 if(/[\\/\u0000-\u001f\u007f]/.test(name)||name.startsWith('.')||name!==name.trim()||
   (!Object.hasOwn(mimeExtensions,mime)||!mimeExtensions[mime]!.includes(name.split('.').pop()!.toLowerCase())))fail('INVALID_ARTIFACT_NAME_OR_MIME');
 return {name,mime,bytes:integer(r.bytes,1,LIMITS.fileBytes),sha256:sha(r.sha256)};
}
function inspection(raw:unknown):Inspection {
 const x=record(copyJson(raw),['sha256','bytes','mime','private','contentValidated','scan','objectVersion']);
 sha(x.sha256);integer(x.bytes,1,LIMITS.fileBytes);text(x.mime,1,128);text(x.objectVersion,1,512);
 if(typeof x.private!=='boolean'||typeof x.contentValidated!=='boolean')fail('INVALID_INSPECTION');
 enumValue(x.scan,['clean','infected','unavailable']);
 return x as unknown as Inspection;
}

/** Server application service; hosted.ts supplies the optional authenticated HTTP mount.
 * No localStorage fallback, operational approvals, execution, tokens or notifications. */
export function createImportProcessService(options:Options) {
 if(!options?.repository?.transaction||!options?.authority?.resolve||!options?.inspector?.inspect||
    typeof options.clock!=='function'||typeof options.newId!=='function')fail('INVALID_PROCESS_PORTS');
 const retentionDays=integer(options.retentionDays,1,3650);
 const authorityMs=integer(options.timeouts?.authorityMs??10000,1,10000);
 const inspectionMs=integer(options.timeouts?.inspectionMs??30000,1,30000);
 async function bounded<T>(ms:number,work:(signal:AbortSignal)=>Promise<T>):Promise<T> {
   const control=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try {
     return await Promise.race([Promise.resolve().then(()=>work(control.signal)),new Promise<never>((_,reject)=>{
       timer=setTimeout(()=>{control.abort();reject(new Error('DEPENDENCY_TIMEOUT'));},ms);
     })]);
   } finally {if(timer)clearTimeout(timer);control.abort();}
 }
 const now=()=>{const d=options.clock();if(!(d instanceof Date)||!Number.isFinite(+d))fail('INVALID_CLOCK');return d;};
 async function authorize(credential:unknown,s:Scope,op:Operation):Promise<Authority> {
   let raw:unknown;
   try {raw=await bounded(authorityMs,signal=>options.authority.resolve(credential,copyJson(s),op,signal));}
   catch(error){if(error instanceof ProcessError&&error.code==='ACCESS_DENIED')throw error;fail('AUTHORITY_UNAVAILABLE');}
   const r=record(copyJson(raw),[...scopeKeys,'actorId','requesterId','role','accessVersion','expiresAt']);
   const a=r as unknown as Authority;
   const checked=selection(Object.fromEntries(scopeKeys.map(k=>[k,r[k]])));
   if(!matches(s,checked))fail('AUTHORITY_SCOPE_MISMATCH');
   uuid(a.actorId);uuid(a.requesterId);enumValue(a.role,['requester','support']);integer(a.accessVersion,1);
   if(a.role==='requester'&&a.actorId!==a.requesterId)fail('ACCESS_DENIED');
   if(typeof a.expiresAt!=='string'||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=+now())fail('AUTHORITY_EXPIRED');
   return a;
 }
 async function transaction<T>(credential:unknown,s:Scope,op:Operation,work:(tx:Transaction,a:Authority)=>Promise<T>):Promise<T> {
   const a=await authorize(credential,s,op);
   return options.repository.transaction(a,async tx=>{
     const result=await work(tx,a);
     const fresh=await authorize(credential,s,op);
     if(Date.parse(a.expiresAt)<=+now()||authorityStamp(fresh)!==authorityStamp(a))fail('AUTHORITY_CHANGED');
     return copyJson(result,4*1024*1024); // composed response, not the 1 MiB command limit
   });
 }
 function checkProcess(p:Process|null,a:Authority):Process {
   if(!p)fail('CASE_NOT_FOUND');
   try {
     record(copyJson(p),[...scopeKeys,'requesterId','createdBy','purpose','target','status','linkState','version','headRevision','headHash','createdAt','updatedAt']);
     integer(p.version,1);integer(p.headRevision,1,p.version);sha(p.headHash);enumValue(p.status,['draft','cancelled']);
     uuid(p.requesterId);uuid(p.createdBy);enumValue(p.purpose,['new_work','history','reports','reconciliation']);
     enumValue(p.linkState,['awaiting_ticket']);const t=record(p.target,['system','contractVersion']);text(t.system,1,100);text(t.contractVersion,1,100);
     if(!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.updatedAt)))fail('INVALID_CLOCK');
   } catch {fail('PROCESS_INTEGRITY');}
   if(!matches(p,a)||p.requesterId!==a.requesterId||a.role==='requester'&&p.requesterId!==a.actorId)fail('ACCESS_DENIED');
   return p;
 }
 async function verifyRevision(r:Revision|null,p:Process,number:number) {
   if(!r||r.caseId!==p.caseId||r.accountId!==p.accountId||r.workspaceId!==p.workspaceId||r.number!==number)fail('REVISION_INTEGRITY');
   try {record(r,['workspaceId','accountId','caseId','number','parentHash','actorId','reason','createdAt','snapshot','hash']);}
   catch {fail('REVISION_INTEGRITY');}
   const {hash,...body}=r;
   if(hash!==await contentHash(body)||number===p.headRevision&&hash!==p.headHash)fail('REVISION_INTEGRITY');
   parseSnapshot(r.snapshot);return r;
 }
 function checkedArtifact(value:Artifact,s:Scope):Artifact {
   try {
     record(copyJson(value),['workspaceId','accountId','caseId','id','name','mime','bytes','sha256','objectKey','objectVersion','status','rejectionCode','createdBy','createdAt','verifiedAt','retainUntil']);
     if(value.workspaceId!==s.workspaceId||value.accountId!==s.accountId||value.caseId!==s.caseId)fail('SCOPE');
     uuid(value.id);uuid(value.createdBy);fileMetadata(value as unknown as Record<string,unknown>);
     if(value.objectKey!==[s.workspaceId,s.accountId,s.caseId,value.id].join('/'))fail('KEY');
     enumValue(value.status,['pending','ready','rejected']);
     if(value.status==='pending') {
       if(value.objectVersion!==null||value.verifiedAt!==null||value.rejectionCode!==null)fail('STATE');
     } else {
       text(value.objectVersion,1,512);if(!Number.isFinite(Date.parse(value.verifiedAt!)))fail('STATE');
       if(value.status==='ready'&&value.rejectionCode!==null)fail('STATE');
       if(value.status==='rejected')text(value.rejectionCode,1,100);
     }
     if(!Number.isFinite(Date.parse(value.createdAt))||!Number.isFinite(Date.parse(value.retainUntil)))fail('STATE');
     return value;
   } catch {fail('ARTIFACT_INTEGRITY');}
 }
 async function validateArtifacts(tx:Transaction,snapshot:Snapshot,s:Scope):Promise<void> {
   for(const artifactId of snapshot.artifactIds) {
     const raw=await tx.readArtifact(artifactId);if(!raw)fail('ARTIFACT_NOT_READY');
     const a=checkedArtifact(raw,s);if(a.id!==artifactId)fail('ARTIFACT_INTEGRITY');
     if(a.status!=='ready')fail('ARTIFACT_NOT_READY');
   }
 }
 async function replay(tx:Transaction,a:Authority,c:{operationId:string},hash:string):Promise<WriteResult|null> {
   const receipt=await tx.readReceipt(a.actorId,c.operationId);
   if(!receipt)return null;
   if(receipt.workspaceId!==a.workspaceId||receipt.accountId!==a.accountId||receipt.caseId!==a.caseId||
      receipt.actorId!==a.actorId||receipt.operationId!==c.operationId)fail('RECEIPT_INTEGRITY');
   if(receipt.requestHash!==hash)fail('IDEMPOTENCY_CONFLICT');
   try {
     record(copyJson(receipt),['workspaceId','accountId','caseId','actorId','operationId','requestHash','result']);
     sha(receipt.requestHash);
     const r=receipt.result, extras=Object.hasOwn(r,'artifactId')?['artifactId','artifactStatus']:[];
     record(r,['caseId','operationId','version','revision','hash','status','replayed',...extras]);
     if(r.caseId!==a.caseId||r.operationId!==c.operationId||r.replayed!==false)fail('SHAPE');
     integer(r.version,1);integer(r.revision,1,r.version);sha(r.hash);enumValue(r.status,['draft','cancelled']);
     if(extras.length){uuid(r.artifactId);enumValue(r.artifactStatus,['pending','ready','rejected']);}
     const revision=await tx.readRevision(r.revision);
     if(!revision||revision.hash!==r.hash||revision.caseId!==a.caseId||revision.accountId!==a.accountId||revision.workspaceId!==a.workspaceId)fail('HASH');
     record(revision,['workspaceId','accountId','caseId','number','parentHash','actorId','reason','createdAt','snapshot','hash']);
     const {hash:storedHash,...revisionBody}=revision;
     if(revision.number!==r.revision||await contentHash(revisionBody)!==storedHash)fail('HASH');
     parseSnapshot(revision.snapshot);
   } catch {fail('RECEIPT_INTEGRITY');}
   return {...copyJson(receipt.result),replayed:true};
 }
 function assertEditable(p:Process,expected:number) {
   if(p.status!=='draft')fail('CASE_NOT_EDITABLE');
   if(p.version!==expected)fail('VERSION_CONFLICT');
 }
 async function audit(tx:Transaction,a:Authority,p:Process,operation:Operation,c:{operationId:string;reason?:unknown},hash:string,extra:Partial<WriteResult>={}):Promise<WriteResult> {
   const result:WriteResult={caseId:p.caseId,operationId:c.operationId,version:p.version,revision:p.headRevision,
     hash:p.headHash,status:p.status,replayed:false,...extra};
   const key={workspaceId:p.workspaceId,accountId:p.accountId,caseId:p.caseId,actorId:a.actorId};
   await tx.insertEvent({...key,version:p.version,operation,at:p.updatedAt,revision:p.headRevision,hash:p.headHash,reason:typeof c.reason==='string'?c.reason:null});
   const receipt:Receipt={...key,operationId:c.operationId,requestHash:hash,result};
   await tx.insertReceipt(receipt);return result;
 }
 async function newRevision(a:Authority,p:Process|null,snapshot:Snapshot,reason:string):Promise<Revision> {
   const body={workspaceId:a.workspaceId,accountId:a.accountId,caseId:a.caseId,
     number:p?p.headRevision+1:1,parentHash:p?p.headHash:null,actorId:a.actorId,reason,createdAt:now().toISOString(),snapshot};
   return {...body,hash:await contentHash(body)};
 }
 return {
   capabilities:Object.freeze({operational:false,workflow:'draft_only',storageRequiresQualification:true}),
   async createCase(credential:unknown,input:unknown):Promise<WriteResult> {
     const c=command(input,['purpose','target','snapshot','reason']);
     if(c.expectedVersion!==0)fail('VERSION_CONFLICT');
     const purpose=enumValue(c.purpose,['new_work','history','reports','reconciliation']);
     const t=record(c.target,['system','contractVersion']);const target={system:text(t.system,1,100),contractVersion:text(t.contractVersion,1,100)};
     const snapshot=parseSnapshot(c.snapshot),reason=text(c.reason,1,1000),hash=await contentHash({operation:'create',command:c});
     return transaction(credential,c.scope,'create',async(tx,a)=>{
       const existing=await tx.readProcess();if(existing)checkProcess(existing,a);
       const prior=await replay(tx,a,c,hash);if(prior)return prior;
       if(existing)fail('CASE_ALREADY_EXISTS');
       await validateArtifacts(tx,snapshot,a);
       const revision=await newRevision(a,null,snapshot,reason);
       const p:Process={...c.scope,requesterId:a.requesterId,createdBy:a.actorId,purpose,target,status:'draft',linkState:'awaiting_ticket',
         version:1,headRevision:1,headHash:revision.hash,createdAt:revision.createdAt,updatedAt:revision.createdAt};
       await tx.insertProcess(p);await tx.insertRevision(revision);
       return audit(tx,a,p,'create',c,hash);
     });
   },
   async saveRevision(credential:unknown,input:unknown):Promise<WriteResult> {
     const c=command(input,['snapshot','reason']);const snapshot=parseSnapshot(c.snapshot),reason=text(c.reason,1,1000);
     const hash=await contentHash({operation:'revise',command:c});
     return transaction(credential,c.scope,'revise',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a);
       const prior=await replay(tx,a,c,hash);if(prior)return prior;
       assertEditable(p,c.expectedVersion);
       await verifyRevision(await tx.readRevision(p.headRevision),p,p.headRevision);
       await validateArtifacts(tx,snapshot,a);
       const r=await newRevision(a,p,snapshot,reason),updated={...p,version:p.version+1,headRevision:r.number,headHash:r.hash,updatedAt:r.createdAt};
       await tx.insertRevision(r);await tx.updateProcess(updated,p.version);
       return audit(tx,a,updated,'revise',c,hash);
     });
   },
   async getCase(credential:unknown,input:unknown) {
     const s=selection(input);
     return transaction(credential,s,'read',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a);
       const currentRevision=await verifyRevision(await tx.readRevision(p.headRevision),p,p.headRevision);
       const artifacts=(await tx.listArtifacts()).map(raw=>{const {objectKey:_,objectVersion:__,...publicData}=checkedArtifact(raw,p);return publicData;});
       return {process:p,currentRevision,artifacts};
     });
   },
   async getRevision(credential:unknown,input:unknown,number:number) {
     const s=selection(input);integer(number,1);
     return transaction(credential,s,'read',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a);
       return verifyRevision(await tx.readRevision(number),p,number);
     });
   },
   async getOperationReceipt(credential:unknown,input:unknown,operationId:string):Promise<ReceiptLookup> {
     const s=selection(input);uuid(operationId);
     return transaction(credential,s,'read',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a);
       const stored=await tx.readReceipt(a.actorId,operationId);
       if(!stored)return {caseId:s.caseId,operationId,status:'unconfirmed',requestHash:null,receipt:null};
       // Use the same integrity checks as retry. Reading never resends a mutation.
       const receipt=await replay(tx,a,{operationId},stored.requestHash);
       if(!receipt||receipt.version>p.version||receipt.revision>p.headRevision)fail('RECEIPT_INTEGRITY');
       return {caseId:s.caseId,operationId,status:'confirmed',requestHash:stored.requestHash,receipt};
     });
   },
   async cancelCase(credential:unknown,input:unknown):Promise<WriteResult> {
     const c=command(input,['reason']);text(c.reason,1,1000);const hash=await contentHash({operation:'cancel',command:c});
     return transaction(credential,c.scope,'cancel',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a),prior=await replay(tx,a,c,hash);if(prior)return prior;
       assertEditable(p,c.expectedVersion);const updated:Process={...p,status:'cancelled',version:p.version+1,updatedAt:now().toISOString()};
       await tx.updateProcess(updated,p.version);return audit(tx,a,updated,'cancel',c,hash);
     });
   },
   async registerArtifact(credential:unknown,input:unknown):Promise<WriteResult> {
     const c=command(input,['name','mime','bytes','sha256']);const meta=fileMetadata(c),hash=await contentHash({operation:'artifact.register',command:c});
     return transaction(credential,c.scope,'artifact.register',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a),prior=await replay(tx,a,c,hash);if(prior)return prior;
       assertEditable(p,c.expectedVersion);
       const files=(await tx.listArtifacts()).map(raw=>checkedArtifact(raw,p));
       // A signed upload can carry any size up to the bucket's per-file limit.
       // Pending/rejected objects still occupy storage; declared bytes cannot
       // release a reservation. Only immutable bytes verified ready are exact.
       const reserved=files.reduce((n,f)=>n+(f.status==='ready'?f.bytes:LIMITS.fileBytes),0);
       if(files.length>=LIMITS.files||reserved+LIMITS.fileBytes>LIMITS.caseBytes)fail('ARTIFACT_QUOTA');
       const id=uuid(options.newId()),created=now();
       const file:Artifact={workspaceId:p.workspaceId,accountId:p.accountId,caseId:p.caseId,id,...meta,
         objectKey:[p.workspaceId,p.accountId,p.caseId,id].join('/'),objectVersion:null,
         status:'pending',rejectionCode:null,createdBy:a.actorId,createdAt:created.toISOString(),verifiedAt:null,
         retainUntil:new Date(+created+retentionDays*86400000).toISOString()};
       const updated={...p,version:p.version+1,updatedAt:created.toISOString()};
       await tx.insertArtifact(file);await tx.updateProcess(updated,p.version);
       return audit(tx,a,updated,'artifact.register',c,hash,{artifactId:id,artifactStatus:'pending'});
     });
   },
   async finalizeArtifact(credential:unknown,input:unknown):Promise<WriteResult> {
     const c=command(input,['artifactId']);const id=uuid(c.artifactId),hash=await contentHash({operation:'artifact.verify',command:c});
     // Network inspection occurs OUTSIDE the database transaction. The following
     // transaction rechecks scope, version, artifact identity and live authority.
     const initial=await transaction(credential,c.scope,'artifact.verify',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a),prior=await replay(tx,a,c,hash);
       if(prior)return {receipt:prior,artifact:null};
       assertEditable(p,c.expectedVersion);const artifact=await tx.readArtifact(id);
       if(!artifact)fail('ARTIFACT_NOT_PENDING');checkedArtifact(artifact,p);if(artifact.id!==id||artifact.status!=='pending')fail('ARTIFACT_NOT_PENDING');
       return {receipt:null,artifact};
     });
     if(initial.receipt)return initial.receipt;
     let observed:Inspection;
     try {observed=inspection(await bounded(inspectionMs,signal=>options.inspector.inspect(initial.artifact!.objectKey,signal)));}catch{fail('INSPECTION_UNAVAILABLE');}
     if(observed.scan==='unavailable')fail('INSPECTION_UNAVAILABLE');
     return transaction(credential,c.scope,'artifact.verify',async(tx,a)=>{
       const p=checkProcess(await tx.readProcess(),a),prior=await replay(tx,a,c,hash);if(prior)return prior;
       assertEditable(p,c.expectedVersion);const file=await tx.readArtifact(id);
       if(file)checkedArtifact(file,p);
       if(!file||file.status!=='pending'||canonicalJson(file)!==canonicalJson(initial.artifact))fail('ARTIFACT_CHANGED');
       const code=!observed.private?'NOT_PRIVATE':observed.scan==='infected'?'MALWARE_DETECTED':!observed.contentValidated?'UNSAFE_DOCUMENT':
         observed.sha256!==file.sha256?'HASH_MISMATCH':observed.bytes!==file.bytes?'SIZE_MISMATCH':observed.mime!==file.mime?'MIME_MISMATCH':null;
       const updated={...p,version:p.version+1,updatedAt:now().toISOString()};
       const finished:Artifact={...file,status:code?'rejected':'ready',rejectionCode:code,objectVersion:observed.objectVersion,verifiedAt:updated.updatedAt};
       await tx.updateArtifact(finished);await tx.updateProcess(updated,p.version);
       return audit(tx,a,updated,'artifact.verify',c,hash,{artifactId:id,artifactStatus:finished.status});
     });
   }
 };
}
