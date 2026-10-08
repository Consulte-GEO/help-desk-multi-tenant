import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';
const U='11111111-1111-4111-8111-111111111111',F='22222222-2222-4222-8222-222222222222',W='33333333-3333-4333-8333-333333333333',now=Date.now(),hash='a'.repeat(56),config={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'},link=config.supabase_url+'/auth/v1/verify?type=recovery&token='+hash;
const jwt=(aal='aal1',sub=U)=>'e30.'+Buffer.from(JSON.stringify({aal,sub,exp:Math.floor(now/1000)+120})).toString('base64url')+'.synthetic';
const value=(factors:any[]=[],token=jwt())=>({token_type:'bearer',access_token:token,refresh_token:'synthetic_refresh',expires_in:120,user:{id:U,factors}}),creds=(factors:any[]=[],token=jwt())=>({accessToken:token,refreshToken:'synthetic_refresh',expiresAt:now+120000,userId:U,mfaFactors:factors});
const fields={email:'synthetic@example.test',password:'synthetic',workspace:W};function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('direct recovery link uses only POST token_hash/type, never follows its redirect or installs URL bearer',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(value());}});const r=await auth.verifyRecovery!(link+'&redirect_to=https%3A%2F%2Fevil.test',);assert.equal(r.userId,U);assert.equal(calls.length,1);assert.equal(calls[0].url,config.supabase_url+'/auth/v1/verify');assert.deepEqual(JSON.parse(calls[0].init.body),{token_hash:hash,type:'recovery'});assert.equal(calls[0].init.headers.authorization,undefined);assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.credentials,'omit');
});
test('wrong origin/type/path, duplicates, bearer fragments and PKCE links cannot consume any token',async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json(value());}});for(const bad of [link.replace('synthetic','evil'),link.replace('recovery','magiclink'),link.replace('/verify','/user'),link+'&type=recovery',link+'&token_hash='+hash,link+'#access_token='+jwt(),link.replace(hash,'pkce_'+hash),'https://name:password@synthetic.supabase.co/auth/v1/verify?type=recovery&token='+hash,link+'&email=someone%40example.test'])await assert.rejects(auth.verifyRecovery!(bad),(e:any)=>e.code==='invalid_recovery_link');assert.equal(calls,0);
});
test('recovery credential response validates identity claims and excludes raw metadata',async()=>{
 for(const raw of [value([],jwt('aal1',W)),{...value(),user:{id:'invalid'}},value([{}])]){const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async()=>Response.json(raw)});await assert.rejects(auth.verifyRecovery!(link));}const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async()=>Response.json({...value(),secret:'private',user:{...value().user,user_metadata:{role:'admin'}}})});assert.doesNotMatch(JSON.stringify(await auth.verifyRecovery!(link)),/private|admin|metadata/);
});
test('expired/refused recovery link is sanitized and never retried',async()=>{
 for(const status of [403,429,503]){let n=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{n++;return Response.json({error_code:'otp_expired',msg:'private '+hash},{status});}});await assert.rejects(auth.verifyRecovery!(link),(e:any)=>!e.message.includes(hash)&&!e.message.includes('private'));assert.equal(n,1);}
});
test('recovery password sends only own password with validated identity reply, never current password or metadata',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(url,init)=>{calls.push({url,init});return Response.json({id:U});}});await auth.changeRecoveryPassword!(jwt(),U,' nova senha ');assert.equal(calls[0].init.method,'PUT');assert.deepEqual(JSON.parse(calls[0].init.body),{password:' nova senha '});assert.equal(calls[0].init.headers.authorization,'Bearer '+jwt());const bad=createHumanAuthTransport(config,{fetcher:async()=>Response.json({id:W})});await assert.rejects(bad.changeRecoveryPassword!(jwt(),U,'new'));
});
test('recovery never adopts credentials into workspace, dispatches business, grants or observable state',async()=>{
 let discovery=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds(),changeRecoveryPassword:async()=>{},workspaces:async()=>{discovery++;return [];},signOut:async()=>{}});await s.beginRecovery(link);assert.equal(s.state().phase,'recovering_password');assert.equal(s.state().recoveryReady,true);assert.equal(s.state().workspace,null);await assert.rejects(s.authorization());await assert.rejects(s.signIn(fields));assert.equal(discovery,0);assert.doesNotMatch(JSON.stringify(s.state()),/synthetic_refresh|e30|a{56}/);
});
test('verified factors require own TOTP MFA before password write and success clears recovery for new login',async()=>{
 let writes=0;const out:string[]=[];const factor={id:F,type:'totp' as const};const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds([factor]),verifyMfa:async()=>creds([factor],jwt('aal2')),changeRecoveryPassword:async()=>{writes++;},signOut:async token=>{out.push(token);}});await s.beginRecovery(link);assert.equal(s.state().recoveryReady,false);await assert.rejects(s.changeRecoveryPassword('new'));await assert.rejects(s.verifyRecoveryMfa(W,'123456'));assert.equal(writes,0);await s.verifyRecoveryMfa(F,'123456');assert.equal(s.state().recoveryReady,true);await s.changeRecoveryPassword('new');assert.equal(writes,1);assert.equal(s.state().phase,'signed_out');assert.deepEqual(out,[jwt('aal2')]);
});
test('unsupported verified factor closes recovery rather than resetting MFA or allowing password write',async()=>{
 let writes=0,out=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds([{id:F,type:'phone'}]),changeRecoveryPassword:async()=>{writes++;},signOut:async()=>{out++;}});await assert.rejects(s.beginRecovery(link),(e:any)=>e.code==='unsupported_mfa');assert.equal(s.state().phase,'signed_out');assert.equal(writes,0);assert.equal(out,1);
});
test('lost password response closes recovery, attempts logout, never automatically replays update',async()=>{
 let writes=0,out=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds(),changeRecoveryPassword:async()=>{writes++;throw new HumanAuthError('auth_unavailable');},signOut:async()=>{out++;}});await s.beginRecovery(link);await assert.rejects(s.changeRecoveryPassword('new'));assert.equal(writes,1);assert.equal(out,1);assert.equal(s.state().phase,'signed_out');
});
test('cancel before verification result waits and revokes late own credentials without installing them',async()=>{
 const wait=deferred<ReturnType<typeof creds>>(),out:string[]=[];const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:()=>wait.promise,signOut:async token=>{out.push(token);}});const start=s.beginRecovery(link),stale=assert.rejects(start,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();const ending=s.signOut();await assert.rejects(s.signIn(fields));wait.resolve(creds());await stale;await ending;assert.deepEqual(out,[jwt()]);assert.equal(s.state().phase,'signed_out');
});
test('invalid recovered password cannot dispatch or replace the owned recovery context',async()=>{
 let writes=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds(),changeRecoveryPassword:async()=>{writes++;},signOut:async()=>{}});await s.beginRecovery(link);await assert.rejects(s.changeRecoveryPassword(''));assert.equal(writes,0);assert.equal(s.state().phase,'recovering_password');await s.signOut();
});

test('malformed verification success revokes only privately validated recovery cleanup credentials',async()=>{
 const out:string[]=[];const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async(url,init)=>{if(String(url).includes('/logout')){out.push(new Headers(init?.headers).get('authorization')!);return new Response(null,{status:204});}return Response.json({...value(),refresh_token:''});}});const s=createHumanSession(auth);await assert.rejects(s.beginRecovery(link));assert.deepEqual(out,['Bearer '+jwt()]);assert.equal(s.state().phase,'signed_out');
});
test('MFA wrong code permits explicit retry while cancellation waits for newest recovery verification token',async()=>{
 const wait=deferred<ReturnType<typeof creds>>(),factor={id:F,type:'totp' as const},out:string[]=[];let attempts=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),verifyRecovery:async()=>creds([factor]),verifyMfa:async()=>{if(++attempts===1)throw new HumanAuthError('mfa_failed');return wait.promise;},signOut:async token=>{out.push(token);}});await s.beginRecovery(link);await assert.rejects(s.verifyRecoveryMfa(F,'000000'));assert.equal(s.state().recoveryReady,false);const verify=s.verifyRecoveryMfa(F,'123456'),stale=assert.rejects(verify);const end=s.signOut();await assert.rejects(s.signIn(fields));wait.resolve(creds([factor],jwt('aal2')));await stale;await end;assert.deepEqual(out,[jwt('aal2')]);
});

import {discardRecoveryNavigation} from '../web/recovery-password.js';
test('navigation credentials are discarded before Auth boot without any token/session adoption',()=>{
 for(const href of ['https://helpdesk.example/index.html#type=recovery&access_token=private&refresh_token=private','https://helpdesk.example/?type=recovery&token_hash=private','https://helpdesk.example/?code=private']){let target='';assert.equal(discardRecoveryNavigation({href},{replaceState:(_a,_b,url)=>{target=String(url);}}),true);assert.doesNotMatch(target,/private|token|code|#|\?/);}
 let calls=0;assert.equal(discardRecoveryNavigation({href:'https://helpdesk.example/#guide'},{replaceState:()=>{calls++;}}),false);assert.equal(calls,0);
});

test('bare token query or fragment is removed even without recovery metadata',()=>{
 for(const href of ['https://helpdesk.example/?token=synthetic_secret','https://helpdesk.example/#token=synthetic_secret']){let target='';assert.equal(discardRecoveryNavigation({href},{replaceState:(_a,_b,url)=>{target=String(url);}}),true);assert.equal(target,'/');}
});
