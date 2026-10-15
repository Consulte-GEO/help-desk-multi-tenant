import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
let provisionInspector;
try{({provisionInspector}=await import('../../provision-import-inspector.mjs'));}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
test('operator provisions only fixed inspector and seals its password for the recipient',async()=>{
 assert.equal(typeof provisionInspector,'function');
 const calls=[];
 const sealed=await provisionInspector({accessToken:'operator-fixture',publicKey:keys.publicKey,fetch:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/api-keys?reveal=true'))return Response.json([{name:'service_role',api_key:'admin-fixture'}]);
  const body=JSON.parse(options.body);assert.equal(body.email,'imp02-inspector@consultegeo.com.br');assert.equal(body.email_confirm,true);
  assert.deepEqual(body.app_metadata,{setup_import_inspector:true});assert.match(body.password,/^Aa1![a-f0-9]{64}$/);
  return Response.json({id:'11111111-1111-4111-8111-111111111111',app_metadata:body.app_metadata},{status:201});
 }});
 const payload=JSON.parse(privateDecrypt({key:keys.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},sealed));
 assert.equal(payload.userId,'11111111-1111-4111-8111-111111111111');assert.match(payload.password,/^Aa1![a-f0-9]{64}$/);
 assert.equal(calls.length,2);assert.equal(calls[1].options.headers.apikey,'admin-fixture');
 assert.equal(calls[0].url,'https://api.supabase.com/v1/projects/yglcnirbnbwjqpvalqif/api-keys?reveal=true');
 assert.equal(calls[0].options.headers.Authorization,'Bearer operator-fixture');
 assert.equal(calls[1].url,'https://yglcnirbnbwjqpvalqif.supabase.co/auth/v1/admin/users');
 assert(!sealed.includes(Buffer.from(payload.password)));
});
test('operator refuses weak recipient keys before any network or account change',async()=>{
 assert.equal(typeof provisionInspector,'function');
 const weak=generateKeyPairSync('rsa',{modulusLength:1024,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 await assert.rejects(()=>provisionInspector({accessToken:'fixture',publicKey:weak.publicKey,fetch:()=>{throw Error('MUST_NOT_SEND');}}),/RECIPIENT_KEY/);
});
test('existing account is never reset after a conflicting create',async()=>{
 assert.equal(typeof provisionInspector,'function');let count=0;
 await assert.rejects(()=>provisionInspector({accessToken:'fixture',publicKey:keys.publicKey,fetch:async()=>++count===1?Response.json([{name:'service_role',api_key:'admin-fixture'}]):Response.json({message:'exists'},{status:422})}),/CREATE_FAILED_422/);
 assert.equal(count,2);
});

test('operator prefers enabled modern secret keys over legacy keys and never chooses disabled or publishable keys',async()=>{
 let used;
 await provisionInspector({accessToken:'operator-fixture',publicKey:keys.publicKey,fetch:async(url,options)=>{
  if(url.includes('/api-keys'))return Response.json([
   {name:'service_role',api_key:'legacy-admin-fixture'},
   {name:'disabled',type:'secret',disabled:true,api_key:'sb_secret_disabled'},
   {name:'public',type:'publishable',disabled:false,api_key:'sb_publishable_fixture'},
   {name:'hidden',type:'secret',disabled:false,api_key:null},
   {name:'backend',type:'secret',disabled:false,api_key:'sb_secret_enabled'},
  ]);
  used=options.headers;return Response.json({id:'11111111-1111-4111-8111-111111111111',app_metadata:{setup_import_inspector:true}},{status:201});
 }});
 assert.equal(used.apikey,'sb_secret_enabled');assert.equal(used.Authorization,'Bearer sb_secret_enabled');
});

test('operator falls back to enabled legacy service_role only when a usable modern secret is absent',async()=>{
 let used;
 await provisionInspector({accessToken:'operator-fixture',publicKey:keys.publicKey,fetch:async(url,options)=>{
  if(url.includes('/api-keys'))return Response.json([
   {name:'disabled',type:'secret',disabled:true,api_key:'sb_secret_disabled'},
   {name:'service_role',disabled:true,api_key:'legacy-disabled'},
   {name:'anon',api_key:'anon-fixture'},
   {name:'service_role',disabled:false,api_key:'legacy-enabled'},
  ]);
  used=options.headers.apikey;return Response.json({id:'11111111-1111-4111-8111-111111111111',app_metadata:{setup_import_inspector:true}},{status:201});
 }});
 assert.equal(used,'legacy-enabled');
});

test('operator never creates an account when management returns no usable administrative key',async()=>{
 let calls=0;
 await assert.rejects(()=>provisionInspector({accessToken:'operator-fixture',publicKey:keys.publicKey,fetch:async()=>{
  calls++;return Response.json([{name:'anon',type:'publishable',api_key:'sb_publishable_fixture'},{name:'service_role',disabled:true,api_key:'disabled'}]);
 }}),/OPERATOR_KEYS_UNAVAILABLE/);
 assert.equal(calls,1);
});

test('operator malformed JSON errors never echo management keys or the generated inspector password',async t=>{
 for(const stage of ['management','auth'])await t.test(stage,async()=>{
  let calls=0,password;
  await assert.rejects(()=>provisionInspector({accessToken:'operator-secret-DO-NOT-LOG',publicKey:keys.publicKey,fetch:async(_url,options)=>{
   calls++;
   if(calls===1&&stage==='auth')return Response.json([{type:'secret',name:'backend',api_key:'sb_secret_DO-NOT-LOG'}]);
   password=options.body?JSON.parse(options.body).password:'sb_secret_DO-NOT-LOG';
   return new Response('{"secret":"'+password+'", BAD_JSON}',{status:200});
  }}),e=>e.message==='OPERATOR_RESPONSE_INVALID'&&!String(e.stack).includes(password));
  assert.equal(calls,stage==='management'?1:2);
 });
});

test('operator sanitizes failed HTTP and transport errors and never retries account creation',async t=>{
 for(const mode of ['http','transport'])await t.test(mode,async()=>{
  let calls=0;
  await assert.rejects(()=>provisionInspector({accessToken:'fixture',publicKey:keys.publicKey,fetch:async()=>{
   calls++;if(calls===1)return Response.json([{name:'service_role',api_key:'admin-secret-DO-NOT-LOG'}]);
   if(mode==='transport')throw Error('admin-secret-DO-NOT-LOG');
   return Response.json({password:'password-DO-NOT-LOG',error:'admin-secret-DO-NOT-LOG'},{status:422});
  }}),e=>e.message===(mode==='http'?'INSPECTOR_CREATE_FAILED_422':'OPERATOR_REQUEST_FAILED')&&!String(e.stack).includes('DO-NOT-LOG'));
  assert.equal(calls,2);
 });
});
