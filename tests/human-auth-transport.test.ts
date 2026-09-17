import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';
const time=1_800_000_000_000,config={supabase_url:'https://projecttest.supabase.co',publishable_key:'sb_publishable_test_only'};
const payload=()=>({access_token:'eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiJmaWN0aXRpb3VzIn0.dGVzdA',refresh_token:'opaque-refresh-for-tests',token_type:'bearer',expires_in:3600,expires_at:time/1000+3600,user:{id:'11111111-1111-4111-8111-111111111111',app_metadata:{role:'admin'},private_extra:'not forwarded'}});
const json=(v:unknown,headers:Record<string,string>={})=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json',...headers}});
const code=(expected:string)=>(e:unknown)=>e instanceof HumanAuthError&&e.code===expected;
test('transport accepts only project HTTPS origin and publishable key',()=>{
 for(const supabase_url of ['http://projecttest.supabase.co','https://projecttest.supabase.co.evil.test','https://projecttest.supabase.co/path','https://x:pass@projecttest.supabase.co','https://projecttest.supabase.co?to=evil','https://127.0.0.1','javascript:alert(1)'])assert.throws(()=>createHumanAuthTransport({...config,supabase_url}),code('invalid_auth_config'));
 for(const publishable_key of ['service_role','sb_secret_private','eyJ.secret.key','sb_publishable_\r\nsecret'])assert.throws(()=>createHumanAuthTransport({...config,publishable_key}),code('invalid_auth_config'));
});
test('password, refresh, local logout use only dedicated routes; no credentials in URL',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async(url,init)=>{calls.push({url:String(url),init});return String(url).includes('logout')?new Response(null,{status:204}):json(payload());}});
 const r=await auth.signIn(' mail@example.test ',' secret password ');await auth.refresh(r.refreshToken);await auth.signOut(r.accessToken);
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname+new URL(c.url).search),['/auth/v1/token?grant_type=password','/auth/v1/token?grant_type=refresh_token','/auth/v1/logout?scope=local']);
 assert.equal(JSON.parse(calls[0].init.body).password,' secret password ');assert.equal(JSON.parse(calls[0].init.body).email,'mail@example.test');assert.deepEqual(JSON.parse(calls[1].init.body),{refresh_token:r.refreshToken});assert.equal(calls[2].init.body,undefined);
 for(const c of calls){assert.equal(c.init.redirect,'error');assert.equal(c.init.credentials,'omit');assert.equal(c.init.cache,'no-store');assert.equal(c.init.referrerPolicy,'no-referrer');assert.doesNotMatch(c.url,/secret|opaque-refresh/);}
 assert.deepEqual(Object.keys(r).sort(),['accessToken','expiresAt','refreshToken','userId']);assert.doesNotMatch(JSON.stringify(r),/admin|private_extra/);
});
test('invalid credentials are rejected before network; valid unicode password preserved',async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>{calls++;return json(payload());}});
 for(const password of ['', 'a\0b','\ud800','a'.repeat(4097)])await assert.rejects(auth.signIn('person@example.test',password),code('invalid_login'));
 await assert.rejects(auth.signIn('not-an-email','secret'),code('invalid_login'));assert.equal(calls,0);await auth.signIn('mail@example.test',' 😀 válido ');assert.equal(calls,1);
});
test('malformed/privileged/incomplete provider responses never become a session',async()=>{
 const candidates=[null,[],{}, {...payload(),access_token:'hd_session_'+ 'a'.repeat(44)}, {...payload(),refresh_token:'with spaces'}, {...payload(),token_type:'basic'}, {...payload(),expires_in:0}, {...payload(),expires_in:86401}, {...payload(),expires_in:'3600'}, {...payload(),expires_at:time/1000-10}, {...payload(),user:{id:'demo-human'}}, {...payload(),user:null}];
 for(const v of candidates){const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>json(v)});await assert.rejects(auth.signIn('mail@example.test','secret'),code('auth_response_invalid'));}
});
test('network time is subtracted from token lifetime; body metadata cannot extend expiry',async()=>{
 let now=time;const p=payload();delete (p as any).expires_at;const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async()=>{now+=3000;return json(p);}});const s=await auth.signIn('mail@example.test','secret');assert.equal(s.expiresAt,time+3600000);
});
test('error responses and thrown diagnostics do not leak raw provider details',async()=>{
 for(const status of [400,401,403,429,500,503,302]){const auth=createHumanAuthTransport(config,{fetcher:async()=>new Response('secret-refreshtoken-provider-detail',{status})});await assert.rejects(auth.signIn('mail@example.test','secret'),(e:any)=>e instanceof HumanAuthError&&!/secret-refreshtoken/.test(e.message));}
 const auth=createHumanAuthTransport(config,{fetcher:async()=>{throw Error('super-private-password');}});await assert.rejects(auth.refresh('refresh-token'),(e:any)=>e.code==='auth_unavailable'&&!/private/.test(e.message));
});
test('invalid refresh is distinguishable from temporary service or rate limit failure',async()=>{
 for(const [status,expected] of [[400,'session_rejected'],[401,'session_rejected'],[403,'session_rejected'],[429,'auth_rate_limited'],[503,'auth_unavailable']] as const){const auth=createHumanAuthTransport(config,{fetcher:async()=>new Response('{}',{status})});await assert.rejects(auth.refresh('refresh-token'),code(expected));}
});
test('logout confirms only exact HTTP204 and leaves other sessions scope untouched',async()=>{
 for(const status of [200,401,403,500]){const auth=createHumanAuthTransport(config,{fetcher:async()=>new Response('{}',{status})});await assert.rejects(auth.signOut(payload().access_token),code('auth_logout_unconfirmed'));}
});
test('unexpected content-type, utf8 and JSON fail safely',async()=>{
 for(const response of [new Response('<html>secret</html>'),new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}}),new Response('{',{headers:{'content-type':'application/json'}})]){const auth=createHumanAuthTransport(config,{fetcher:async()=>response});await assert.rejects(auth.signIn('mail@example.test','secret'),(e:any)=>e instanceof HumanAuthError&&!/secret|Unexpected/.test(e.message));}
});
test('decoded body cap is enforced even without trustworthy Content-Length',async()=>{
 for(const headers of [{},{'content-length':'4'},{'content-length':'70000'}] as Record<string,string>[]){const auth=createHumanAuthTransport(config,{fetcher:async()=>json({...payload(),padding:'x'.repeat(66000)},headers)});await assert.rejects(auth.signIn('mail@example.test','secret'),code('auth_response_invalid'));}
});
test('uncompressed response length mismatch is rejected',async()=>{
 const auth=createHumanAuthTransport(config,{fetcher:async()=>json(payload(),{'content-length':'3'})});await assert.rejects(auth.signIn('mail@example.test','secret'),code('auth_response_invalid'));
});
test('browser-decoded gzip does not compare compressed Content-Length with decoded bytes',async()=>{
 const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>json(payload(),{'content-length':'240','content-encoding':'gzip'})});assert.ok((await auth.signIn('mail@example.test','secret')).accessToken);
});
test('auth request deadline covers a stalled fetch and aborts it',async()=>{
 let signal:AbortSignal|undefined;const auth=createHumanAuthTransport(config,{timeoutMs:20,fetcher:async(_url,init)=>{signal=init?.signal??undefined;return new Promise(()=>{});}});await assert.rejects(auth.signIn('mail@example.test','secret'),code('auth_unavailable'));assert.equal(signal?.aborted,true);
});
test('response body stalled after headers is cancelled when deadline expires',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
 const auth=createHumanAuthTransport(config,{timeoutMs:20,fetcher:async()=>new Response(body,{headers:{'content-type':'application/json'}})});await assert.rejects(auth.signIn('mail@example.test','secret'));await new Promise(r=>setTimeout(r,5));assert.equal(cancelled,true);
});
test('malformed JSON and invalid UTF8 are incompatible responses, not retryable transport failures',async()=>{
 for(const content of ['{',new Uint8Array([0xff])]){
  const auth=createHumanAuthTransport(config,{fetcher:async()=>new Response(content,{headers:{'content-type':'application/json'}})});
  await assert.rejects(auth.refresh('refresh-token'),code('auth_response_invalid'));
 }
});
