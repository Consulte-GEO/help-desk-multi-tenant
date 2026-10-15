/** Administrative CI operator only. Never imported by a Function/browser.
 * The existing Supabase operator token stays in GitHub Secrets. A new dedicated
 * account password leaves the runner only as RSA-OAEP ciphertext, to a public
 * key whose private half stays with the operator. No generic Auth admin API.
 */
import {createPublicKey,publicEncrypt,randomBytes,constants} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const PROJECT='yglcnirbnbwjqpvalqif',EMAIL='imp02-inspector@consultegeo.com.br';
async function boundedJson(response){
 let reader;
 try{
  reader=response.body?.getReader();if(!reader)throw Error();
  const chunks=[];let size=0;
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>65536){await reader.cancel();throw Error();}chunks.push(Buffer.from(item.value));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{throw Error('OPERATOR_RESPONSE_INVALID');}
 finally{try{reader?.releaseLock();}catch{}}
}
export async function provisionInspector({accessToken,publicKey,fetch:send=globalThis.fetch}){
 let recipient;try{recipient=createPublicKey(publicKey);}catch{throw Error('RECIPIENT_KEY_INVALID');}
 if(recipient.asymmetricKeyType!=='rsa'||recipient.asymmetricKeyDetails.modulusLength<3072)throw Error('RECIPIENT_KEY_WEAK');
 if(typeof accessToken!=='string'||!accessToken)throw Error('OPERATOR_CREDENTIAL_REQUIRED');
 const request=async(url,options)=>{try{return await send(url,options);}catch{throw Error('OPERATOR_REQUEST_FAILED');}};
 const keysResponse=await request(`https://api.supabase.com/v1/projects/${PROJECT}/api-keys?reveal=true`,{
  headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!keysResponse.ok){await keysResponse.body?.cancel().catch(()=>{});throw Error('OPERATOR_KEYS_UNAVAILABLE_'+keysResponse.status);}
 const keys=await boundedJson(keysResponse);
 const usable=k=>k&&k.disabled!==true&&typeof k.api_key==='string'&&k.api_key.length>0;
 // Management returns masked values unless reveal=true. Prefer the modern
 // secret key; legacy service_role is only an administrative CI fallback.
 const adminKey=Array.isArray(keys)?(keys.find(k=>k?.type==='secret'&&usable(k))??
  keys.find(k=>k?.name==='service_role'&&(!k.type||k.type==='legacy')&&usable(k)))?.api_key:undefined;
 if(typeof adminKey!=='string'||!adminKey)throw Error('OPERATOR_KEYS_UNAVAILABLE');
 const password='Aa1!'+randomBytes(32).toString('hex');
 const response=await request(`https://${PROJECT}.supabase.co/auth/v1/admin/users`,{method:'POST',
  headers:{apikey:adminKey,Authorization:'Bearer '+adminKey,'content-type':'application/json'},
  body:JSON.stringify({email:EMAIL,password,email_confirm:true,app_metadata:{setup_import_inspector:true}}),
  signal:AbortSignal.timeout(15000),redirect:'error'});
 // Never update/reset an existing identity on conflict; stop for operator review.
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('INSPECTOR_CREATE_FAILED_'+response.status);}
 const user=await boundedJson(response);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(user?.id)||
  user.app_metadata?.setup_import_inspector!==true||user.app_metadata?.is_admin===true)throw Error('INSPECTOR_IDENTITY_INVALID');
 return publicEncrypt({key:recipient,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},
  Buffer.from(JSON.stringify({project:PROJECT,email:EMAIL,userId:user.id,password})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4||process.argv[2]!=='--execute'){
  console.log('Administrative plan only: fixed IMP02 inspector; no network. Execute via the reviewed manual workflow.');
 }else{
  try{
   const publicKey=Buffer.from(process.env.INSPECTOR_RECIPIENT_PUBLIC_KEY||'','base64').toString('utf8');
   const sealed=await provisionInspector({accessToken:process.env.SUPABASE_ACCESS_TOKEN,publicKey});
   writeFileSync(process.argv[3],sealed,{flag:'wx',mode:0o600});
   console.log('Inspector created; credential sealed for the operator. No plaintext credential written.');
  }catch(error){
   // Only our fixed diagnostics may reach CI logs. Parser, fetch, crypto and IO
   // exceptions can contain response fragments, credentials or local paths.
   const safe=/^(?:RECIPIENT_KEY_(?:INVALID|WEAK)|OPERATOR_(?:CREDENTIAL_REQUIRED|KEYS_UNAVAILABLE(?:_\d{3})?|REQUEST_FAILED|RESPONSE_INVALID)|INSPECTOR_(?:CREATE_FAILED_\d{3}|IDENTITY_INVALID))$/;
   console.error(safe.test(error?.message)?error.message:'INSPECTOR_OPERATOR_FAILED');process.exitCode=1;
  }
 }
}
