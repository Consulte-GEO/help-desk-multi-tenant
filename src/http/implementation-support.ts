import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {controlledJson} from './controlled-json.ts';
import {createImplementationSupportOperations,implementationFailure as fail,implementationHash,implementationRecord as record,implementationRow,implementationStaff,readImplementationMethods,pagedImplementationMethods,pagedImplementationTables} from '../infrastructure/implementation-support.ts';
import type {ImplementationStore,ImplementationAi,ImplementationKind,ImplementationTransaction} from '../infrastructure/implementation-support.ts';
import {validateImplementationSupportAiRequest} from '../infrastructure/implementation-support-ai.ts';

const BASE='/v1/implementation-support';
const kinds=new Set<ImplementationKind>(['draft','import','laudo']);
export interface ImplementationSupportOptions{origin:string;authenticate:(request:Request)=>Promise<Principal>;store:ImplementationStore;ai?:ImplementationAi;enabled?:()=>boolean;afterAuthentication?:(principal:Principal)=>Promise<void>;}
function json(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Authorization, X-Workspace-Id, Origin',...headers}});}
async function bodyJson(req:Request,limit:number){const length=Number(req.headers.get('content-length'));if(length>limit)throw fail(413,'payload_too_large');return controlledJson(req,limit,5000);}
function version(req:Request,body:Record<string,unknown>):number|undefined{const raw=body.expected_version??req.headers.get('if-match');if(raw===null||raw===undefined)return undefined;const n=typeof raw==='number'?raw:Number(String(raw).replace(/^"|"$/g,''));if(!Number.isSafeInteger(n)||n<0)throw fail(400,'invalid_implementation_version');return n;}
function key(req:Request):string{const k=req.headers.get('idempotency-key');if(!k)throw fail(400,'invalid_idempotency_key');return uuidIdentifier(k);}
function utf8Size(body:unknown){return Buffer.byteLength(JSON.stringify(body),'utf8');}
function safeAsset(raw:Record<string,unknown>){const mime=String(raw.mime??''),encoded=String(raw.base64??'');if(!['image/png','image/jpeg','image/webp'].includes(mime)||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw fail(415,'invalid_implementation_image');const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.length>3*1024*1024)throw fail(413,'implementation_image_too_large');const ok=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!ok)throw fail(415,'invalid_implementation_image');return {mime,base64:bytes.toString('base64'),filename:String(raw.filename??'image').replace(/[\x00-\x1f]/g,'').slice(0,200),bytes:bytes.length,storage_state:'stored_uninspected'};}
/** Staff API only. Legacy RPC names are a fixed application command vocabulary,
 * never a database function name, grant, bearer capability or SQL fragment. */
export function createImplementationSupportHandler(options:ImplementationSupportOptions){
 return async(req:Request):Promise<Response>=>{
  try{
   if(options.enabled?.()===false)throw fail(503,'implementation_support_unavailable');
   const url=new URL(req.url),path=url.pathname;if(path!==BASE&&!path.startsWith(BASE+'/'))throw fail(404,'not_found');
   if(!['GET','POST','PUT','DELETE'].includes(req.method))throw fail(405,'method_not_allowed');
   const origin=req.headers.get('origin');if(origin!==null&&origin!==options.origin||req.method!=='GET'&&origin!==options.origin)throw fail(403,'origin_denied');
   const p=await options.authenticate(req);implementationStaff(p);await options.afterAuthentication?.(p);
   const allowedQuery=new Set(['account_id','kind','before']);for(const k of url.searchParams.keys())if(!allowedQuery.has(k)||url.searchParams.getAll(k).length!==1)throw fail(400,'unknown_parameter');if(url.searchParams.has('before'))uuidIdentifier(url.searchParams.get('before'));
   if(path===BASE+'/session'){
    if(req.method!=='GET')throw fail(405,'method_not_allowed');const accounts=await options.store.accounts(p),notifications=await options.store.notificationsAvailable?.(p)??false;return json({actorId:p.id,workspaceId:p.workspaceId,accounts,enabled:true,sourceIntegration:'helpdesk',limits:{help_image_max_bytes:3145728,vision_image_max_bytes:3145728,versions_per_page:100},capabilities:{drafts:true,versions:true,submissions:true,review:true,exports:true,stepHelp:true,ai:!!options.ai,originalFileStorage:false,geoExecution:false,notifications}});
   }
   const input=req.method==='GET'?{}:await bodyJson(req,path.includes('/ai/')||path===BASE+'/assets'?5*1024*1024:2*1024*1024);
   const a=uuidIdentifier(input.account_id??url.searchParams.get('account_id'));implementationStaff(p,a);
   const expected=version(req,input),signal=AbortSignal.any([req.signal,AbortSignal.timeout(55000)]);
   const transact=<T>(work:(tx:ImplementationTransaction)=>Promise<T>)=>{if(signal.aborted)throw fail(409,'request_cancelled');return options.store.run(p,a,work);};
   const mutate=async(work:(tx:ImplementationTransaction)=>Promise<unknown>)=>{
    const operation=key(req),hash=implementationHash({path,method:req.method,accountId:a,expected:expected??null,body:input});
    const result=await transact(async tx=>{const prior=await tx.receipt(operation);if(prior){if(prior.hash!==hash)throw fail(409,'implementation_idempotency_conflict');return prior.result;}const data=await work(tx);if(signal.aborted)throw fail(409,'request_cancelled');const output={data,receipt:{operation_id:operation,confirmed:true}};if(utf8Size(output)>8*1024*1024)throw fail(413,'payload_too_large');await tx.remember(operation,{hash,result:output});return output;});return json(result);
   };
   const notification=/^\/v1\/implementation-support\/notifications\/([0-9a-f-]{36})(?:\/([0-9a-f-]{36}))?$/.exec(path);
   if(notification){if(req.method!=='GET')throw fail(405,'method_not_allowed');return json({data:await transact(tx=>createImplementationSupportOperations(tx,p,a,expected).rpc('implementation-email-status',{id:uuidIdentifier(notification[1]),...(notification[2]?{notification_id:uuidIdentifier(notification[2])}:{})}))});}
   if(path===BASE+'/rpc'){
    if(req.method!=='POST')throw fail(405,'method_not_allowed');const method=String(input.method??''),args=record(input.args??{});if(readImplementationMethods.has(method)){const result=await transact(tx=>createImplementationSupportOperations(tx,p,a,expected).rpc(method,args));return json(pagedImplementationMethods.has(method)?result:{data:result});}return await mutate(tx=>createImplementationSupportOperations(tx,p,a,expected).rpc(method,args));
   }
   if(path===BASE+'/query'){
    if(req.method!=='POST')throw fail(405,'method_not_allowed');const filters=input.filters??[];if(!Array.isArray(filters)||filters.length>20)throw fail(400,'invalid_implementation_filter');const parsed=filters.map(value=>{const f=record(value);return {field:String(f.field??''),op:String(f.op??''),value:f.value};});
    const before=input.before===undefined?undefined:uuidIdentifier(input.before),table=String(input.table??'');const execute=(tx:ImplementationTransaction)=>createImplementationSupportOperations(tx,p,a,expected).query(table,String(input.action??'select'),input.values,parsed,before);
    if(input.action==='select'||input.action===undefined){const result=await transact(execute);return json(pagedImplementationTables.has(table)?result:{data:result});}return await mutate(execute);
   }
   const assets=/^\/v1\/implementation-support\/assets(?:\/([0-9a-f-]{36}))?$/.exec(path);
   if(assets){
    if(!assets[1]&&req.method==='POST')return await mutate(async tx=>{const body=safeAsset(input);if(expected!==0)throw fail(428,'precondition_required');const op=createImplementationSupportOperations(tx,p,a,expected);const d=await op.create('help_image',body);return {path:d.id,id:d.id,version:d.version,storage_state:'stored_uninspected'};});
    if(assets[1]&&req.method==='GET'){const d=await transact(tx=>tx.read(uuidIdentifier(assets[1])));if(!d||d.kind!=='help_image'||d.body.deleted_at)throw fail(404,'implementation_not_found');const bytes=Buffer.from(String(d.body.base64),'base64');return new Response(bytes,{headers:{'content-type':String(d.body.mime),'cache-control':'private, no-store','x-content-type-options':'nosniff','x-implementation-version':String(d.version),'content-disposition':'inline','content-security-policy':"default-src 'none'; sandbox"}});}
    if(assets[1]&&req.method==='DELETE')return await mutate(async tx=>{const op=createImplementationSupportOperations(tx,p,a,expected),d=await tx.read(uuidIdentifier(assets[1]));if(!d||d.kind!=='help_image')throw fail(404,'implementation_not_found');op.requireVersion(d);d.body={filename:d.body.filename,mime:d.body.mime,deleted_at:new Date().toISOString(),storage_state:'removed'};return op.save(d,'image_removed');});
    throw fail(405,'method_not_allowed');
   }
   const ai=/^\/v1\/implementation-support\/ai\/(importa|laudo)$/.exec(path);
   if(ai){
    if(req.method!=='POST')throw fail(405,'method_not_allowed');if(!options.ai)throw fail(503,'ai_unavailable');const kind=ai[1] as 'importa'|'laudo';const {account_id:_account,expected_version:_version,...body}=input;
    if(kind==='laudo'&&body.action==='confirm'){
     const response=await mutate(async tx=>{const token=uuidIdentifier(body.reading_token),d=await tx.read(token);if(!d||d.kind!=='laudo'||d.ownerId!==p.id)throw fail(404,'implementation_not_found');const fields=Array.isArray(body.fields)?body.fields.slice(0,600):[];const sanitized=fields.map(v=>{const f=record(v);if(!['acertou','corrigiu','faltou','sobrou','rejeitou'].includes(String(f.verdict)))throw fail(400,'invalid_ai_request');return {field:String(f.field??'').slice(0,80),result_index:Number(f.result_index??0),verdict:f.verdict,ocr_value_hash:implementationHash(f.ocr_value??null),final_value_hash:implementationHash(f.final_value??null)};});const op=createImplementationSupportOperations(tx,p,a,expected);await op.event(d,'laudo_confirmation',{fields:sanitized});return {ok:true,confirmation:{reading_token:d.id,fields:sanitized.length}};});return json((await response.json()).data);
    }
    if(kind==='laudo'&&body.consent!==true)throw fail(400,'ai_consent_required');
    validateImplementationSupportAiRequest(kind,body);
    const operation=key(req),hash=implementationHash({kind,body});
    const prior=await transact(async tx=>{
     // The advisory lock serializes first admission, without holding a database
     // connection while the external provider runs. Pending jobs never retry it.
     await tx.receipt(operation);const job=await tx.read(operation);
     if(job){if(job.kind!=='ai_request'||job.ownerId!==p.id||job.body.request_hash!==hash)throw fail(409,'implementation_idempotency_conflict');if(job.body.state==='complete')return {complete:true,result:job.body.result};throw fail(job.body.state==='pending'?409:503,job.body.state==='pending'?'implementation_ai_pending':'ai_unavailable');}
     if(!await tx.quota(kind==='laudo'?3:1))throw fail(429,'implementation_ai_quota_exceeded');
     await createImplementationSupportOperations(tx,p,a,undefined).create('ai_request',{request_hash:hash,kind,state:'pending',original_stored:false},operation);return {complete:false};
    });
    if(prior.complete)return json(prior.result);
    let result:unknown;
    try{result=await options.ai(kind,body,{principal:p,accountId:a,signal});if(signal.aborted)throw fail(409,'request_cancelled');}
    catch(error){try{await options.store.run(p,a,async tx=>{const d=await tx.read(operation);if(d&&d.body.state==='pending'){d.body={...d.body,state:'failed'};await createImplementationSupportOperations(tx,p,a,undefined).save(d,'ai_failed');}});}catch{/* The pending record remains a closed retry barrier. */}throw error;}
    const completed=await transact(async tx=>{
     const job=await tx.read(operation);if(!job||job.ownerId!==p.id||job.body.state!=='pending')throw fail(409,'implementation_ai_pending');const op=createImplementationSupportOperations(tx,p,a,undefined);let output=result;
     if(kind==='laudo'){const obj=record(result),d=await op.create('laudo',{result:obj,file_hash:typeof body.file_hash==='string'?body.file_hash.slice(0,128):null,file_name_hash:implementationHash(body.file_name??null),page:body.page??1,source:'ai_review_required',original_stored:false});output={...obj,reading_token:d.id};}
     job.body={...job.body,state:'complete',result:output};await op.save(job,'ai_completed');return output;
    });return json(completed);
   }
   const docs=/^\/v1\/implementation-support\/(drafts|documents)(?:\/([0-9a-f-]{36})(?:\/(versions|exports|audit|cancellation|submissions)(?:\/([0-9a-f-]{36}))?)?)?$/.exec(path);
   if(docs){
    const id=docs[2]?uuidIdentifier(docs[2]):undefined,part=docs[3],eventId=docs[4]?uuidIdentifier(docs[4]):undefined,isDraft=docs[1]==='drafts';
    if(eventId&&(!['versions','audit'].includes(part??'')||req.method!=='GET'))throw fail(405,'method_not_allowed');
    if(req.method==='GET'&&part&&!['versions','exports','audit'].includes(part)||!isDraft&&part&&part!=='versions'||!isDraft&&req.method!=='GET'&&part||!isDraft&&!id&&req.method!=='GET'&&req.method!=='POST'||!isDraft&&id&&req.method!=='GET'&&!['PUT','DELETE'].includes(req.method))throw fail(405,'method_not_allowed');
    if(req.method==='GET')return json(await transact(async tx=>{
     if(!id){const raw=isDraft?'draft':url.searchParams.get('kind')??undefined;if(raw!==undefined&&!kinds.has(raw as ImplementationKind))throw fail(400,'invalid_implementation_kind');return {data:(await tx.list(raw as ImplementationKind|undefined)).filter(d=>kinds.has(d.kind)).map(d=>({...implementationRow(d),summary:true}))};}
     const d=await tx.read(id);if(!d||!kinds.has(d.kind)||isDraft&&d.kind!=='draft')throw fail(404,'implementation_not_found');
     if(eventId){const e=await tx.event(id,eventId);if(!e||part==='versions'&&!e.body.snapshot)throw fail(404,'implementation_not_found');return {data:{id:e.id,type:e.type,actor:e.actorId,created_at:e.createdAt,...e.body}};}
     if(part){const entries=await tx.events(id,false,url.searchParams.get('before')??undefined,part==='versions',part==='exports'?['export']:undefined,part==='audit'?['export','comment']:undefined),page=entries.slice(0,100);return {data:page.map(e=>({id:e.id,type:e.type,actor:e.actorId,created_at:e.createdAt,...e.body})),more:entries.length>100,next_cursor:entries.length>100?page.at(-1)!.id:null};}
     return {data:implementationRow(d)};
    }));
    if(isDraft){
     if(!id&&req.method!=='POST'||id&&!part&&!['PUT','DELETE'].includes(req.method)||part&&req.method!=='POST'||part==='versions')throw fail(405,'method_not_allowed');
     const args=record(input.args??input);const method=part==='cancellation'||req.method==='DELETE'?'cancel_draft_by_token':part==='submissions'?'submit-for-validation':part==='exports'?'record_export_by_token':part==='audit'?'record_audit_by_token':'upsert_draft_by_token';return await mutate(tx=>createImplementationSupportOperations(tx,p,a,expected).rpc(method,{...args,...(id?{p_draft_id:id,p_token:id,draftId:id}:{})}));
    }
    return await mutate(async tx=>{const op=createImplementationSupportOperations(tx,p,a,expected);if(!id){const kind=String(input.kind) as ImplementationKind;if(!['import','laudo'].includes(kind))throw fail(400,'invalid_implementation_kind');if(expected!==0)throw fail(428,'precondition_required');return implementationRow(await op.create(kind,record(input.body)));}const d=await tx.read(id);if(!d||!kinds.has(d.kind))throw fail(404,'implementation_not_found');if(d.kind==='draft')throw fail(409,'implementation_draft_requires_workflow');op.requireVersion(d);d.body=req.method==='DELETE'?{...d.body,status:'cancelled'}:record(input.body);return op.save(d,'document_saved');});
   }
   throw fail(404,'not_found');
  }catch(error){const e=error as {status?:unknown;code?:unknown};const status=Number(e?.status),valid=Number.isInteger(status)&&status>=400&&status<=599;const code=valid&&typeof e.code==='string'&&/^[a-z][a-z0-9_]{1,79}$/.test(e.code)?e.code:'implementation_support_unavailable';return json({type:'about:blank',status:valid?status:503,code,error:code,detail:'A operação não foi confirmada. Atualize o registro antes de tentar novamente.'},valid?status:503);}
 };
}
