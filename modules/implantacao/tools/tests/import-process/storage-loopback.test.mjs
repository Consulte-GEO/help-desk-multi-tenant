// Real local sockets; Supabase and scanner servers below are protocol fixtures,
// not proof that a cloud bucket or malware engine has been qualified.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createSupabaseArtifactStorage,createArtifactInspector,createHttpContentScanner} from '../../../modules/import-process/storage.ts';
import {id,scope} from './fixtures.mjs';
const token=role=>['e30',Buffer.from(JSON.stringify({role,sub:id(9)})).toString('base64url'),'signature'].join('.');
const bytes=Buffer.from('%PDF-1.7\nlocal socket fixture\n%%EOF');
const hash=b=>createHash('sha256').update(b).digest('hex');
const artifact={...scope,id:id(8),objectKey:[scope.workspaceId,scope.accountId,scope.caseId,id(8)].join('/'),status:'pending',mime:'application/pdf',bytes:bytes.length};
async function setup(t){
 const state={calls:[],bytes,scan:'clean',valid:true,reportHash:null,etag:'"immutable-v1"',public:false,redirect:false,tooLarge:false,streamOversize:false,scannerStatus:200,scannerDelay:0};
 const server=http.createServer(async(req,res)=>{
  const body=Buffer.concat(await Array.fromAsync(req));state.calls.push({url:req.url,method:req.method,headers:req.headers,body});
  if(req.url==='/scan'){
   if(state.scannerDelay)await new Promise(r=>setTimeout(r,state.scannerDelay));
   res.writeHead(state.scannerStatus,{'content-type':'application/json'});res.end(JSON.stringify({protocol:'setup-content-inspection/v1',sha256:state.reportHash??hash(body),bytes:body.length,mime:'application/pdf',scan:state.scan,contentValidated:state.valid}));return;
  }
  if(req.url.startsWith('/storage/v1/bucket/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'setup-import-artifacts',public:state.public}));return;}
  if(req.method==='POST'){res.setHeader('content-type','application/json');res.end(JSON.stringify({url:'/object/upload/sign/setup-import-artifacts/'+artifact.objectKey+'?token=test-signature'}));return;}
  if(req.method==='PUT'){res.statusCode=201;res.end('{}');return;}
  if(state.redirect){res.writeHead(302,{location:'/scan'});res.end();return;}
  if(state.etag)res.setHeader('etag',state.etag);
  if(state.tooLarge)res.setHeader('content-length',String(60*1024*1024+1));
  if(state.streamOversize){
   res.setHeader('transfer-encoding','chunked');const chunk=Buffer.alloc(1024*1024,80);
   for(let n=0;n<61&&!res.destroyed;n++)if(!res.write(chunk))await new Promise(r=>{
    const done=()=>{res.off('drain',done);res.off('close',done);r()};res.once('drain',done);res.once('close',done);
   });
   if(!res.destroyed)res.end();return;
  }
  res.setHeader('content-type','text/plain');res.end(state.bytes);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const origin='http://127.0.0.1:'+server.address().port;
 const storage=createSupabaseArtifactStorage({supabaseUrl:origin,publishableKey:'sb_publishable_test',accessToken:()=>token('authenticated'),allowInsecureLocalhost:true});
 const scanner=createHttpContentScanner({url:origin+'/scan',token:'test-scanner-secret',allowInsecureLocalhost:true});
 return {state,origin,storage,scanner,inspector:createArtifactInspector({storage,scanner})};
}
test('IMP02 concrete signed upload uses authenticated REST and immutable PUT',async t=>{
 const x=await setup(t),signed=await x.storage.createSignedUpload(artifact);
 assert.equal(signed.method,'PUT');assert.equal(signed.headers['x-upsert'],'false');assert.equal(signed.expiresIn,7200);
 assert.equal((await fetch(signed.url,{method:signed.method,headers:signed.headers,body:bytes})).status,201);
 assert.equal(x.state.calls[0].headers.authorization,'Bearer '+token('authenticated'));
 assert.equal(x.state.calls[0].headers['x-upsert'],'false');assert.equal(x.state.calls[1].body.toString(),bytes.toString());
 assert.equal(JSON.stringify(signed).includes(token('authenticated')),false);
});
test('IMP02 inspection hashes actual bytes, ignores metadata MIME, binds scanner and immutable version',async t=>{
 const x=await setup(t),result=await x.inspector.inspect(artifact.objectKey);
 assert.equal(result.sha256,hash(bytes));assert.equal(result.bytes,bytes.length);assert.equal(result.mime,'application/pdf');
 assert.equal(result.private,true);assert.equal(result.contentValidated,true);assert.equal(result.scan,'clean');assert.match(result.objectVersion,/immutable-v1/);
 const scan=x.state.calls.find(c=>c.url==='/scan');assert.deepEqual(scan.body,bytes);assert.equal(scan.headers.authorization,'Bearer test-scanner-secret');assert.equal(scan.headers['x-content-sha256'],hash(bytes));
});
test('IMP02 scanner unavailable, wrong digest, unsupported bytes and timeout fail closed',async t=>{
 const x=await setup(t);
 await assert.rejects(()=>createArtifactInspector({storage:x.storage}).inspect(artifact.objectKey),/INSPECTION_UNAVAILABLE/);
 x.state.scannerStatus=503;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/STORAGE_DEPENDENCY_UNAVAILABLE/);
 x.state.scannerStatus=200;x.state.reportHash='f'.repeat(64);await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/INVALID_CONTENT_INSPECTION/);
 x.state.reportHash=null;x.state.bytes=Buffer.from('not a supported file');await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/UNSUPPORTED_ARTIFACT_CONTENT/);
 x.state.bytes=bytes;x.state.scannerDelay=300;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey,AbortSignal.timeout(100)),e=>e.name==='TimeoutError');
});
test('IMP02 infected and structurally unsafe scanner reports never imply ready',async t=>{
 const x=await setup(t);x.state.scan='infected';assert.equal((await x.inspector.inspect(artifact.objectKey)).scan,'infected');
 x.state.scan='clean';x.state.valid=false;assert.equal((await x.inspector.inspect(artifact.objectKey)).contentValidated,false);
});
test('IMP02 public bucket, missing immutable ETag, redirects and excessive byte length fail closed',async t=>{
 const x=await setup(t);x.state.public=true;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/ARTIFACT_BUCKET_NOT_PRIVATE/);
 x.state.public=false;x.state.etag=null;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/STORAGE_VERSION_UNAVAILABLE/);
 x.state.etag='W/"weak"';await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/STORAGE_VERSION_UNAVAILABLE/);
 x.state.etag='"v1"';x.state.redirect=true;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey));
 x.state.redirect=false;x.state.tooLarge=true;await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/STORAGE_BODY_LIMIT/);
});
test('IMP02 normal request rejects privileged token, path substitution and finalized artifact',async t=>{
 const x=await setup(t);
 const privileged=createSupabaseArtifactStorage({supabaseUrl:x.origin,publishableKey:'sb_publishable_test',accessToken:()=>token('service_role'),allowInsecureLocalhost:true});
 await assert.rejects(()=>privileged.createSignedUpload(artifact),/INVALID_STORAGE_CREDENTIAL/);assert.equal(x.state.calls.length,0);
 await assert.rejects(()=>x.storage.createSignedUpload({...artifact,objectKey:artifact.objectKey+'/../escape'}),/INVALID_ARTIFACT_KEY/);
 await assert.rejects(()=>x.storage.createSignedUpload({...artifact,status:'ready'}),/ARTIFACT_NOT_PENDING/);assert.equal(x.state.calls.length,0);
 assert.throws(()=>createHttpContentScanner({url:'http://example.com/scan',token:'secret'}));
});
test('IMP02 untrusted chunked response is bounded by actual bytes before scanner',async t=>{
 const x=await setup(t);x.state.streamOversize=true;
 await assert.rejects(()=>x.inspector.inspect(artifact.objectKey),/STORAGE_BODY_LIMIT/);
 assert.equal(x.state.calls.some(c=>c.url==='/scan'),false);
});
