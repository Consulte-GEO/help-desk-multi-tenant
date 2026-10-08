import test from 'node:test';import assert from 'node:assert/strict';import * as navigation from '../web/recovery-password.js';
const captureRecoveryNavigation=(navigation as any).captureRecoveryNavigation;
const H='a'.repeat(56),ORIGIN='https://synthetic.supabase.co';
function intake(suffix:string){const cleared:string[]=[];const value=captureRecoveryNavigation({href:'https://helpdesk.example/'+suffix},{replaceState:(_a:any,_b:any,url:any)=>{cleared.push(String(url));}});return {value,cleared};}
test('strict hash fragment is removed immediately and handed off once without serialized secret or URL bearer',()=>{
 const {value,cleared}=intake('#type=recovery&token_hash='+H);assert.deepEqual(cleared,['/']);assert.equal(value.discarded,true);assert.equal(value.hasLink(),true);assert.doesNotMatch(JSON.stringify(value),/a{56}|token_hash|access_token/);assert.equal(value.takeLink(ORIGIN),ORIGIN+'/auth/v1/verify?type=recovery&token_hash='+H);assert.equal(value.hasLink(),false);assert.equal(value.takeLink(ORIGIN),null);
});
test('query hashes, bearer/refresh/code fragments, mixed/duplicate/type/PKCE/invalid fragments do not become recoverable context',()=>{
 for(const suffix of ['?type=recovery&token_hash='+H,'#access_token=private&refresh_token=private&type=recovery','#code=private&type=recovery','#type=magiclink&token_hash='+H,'#type=recovery&type=recovery&token_hash='+H,'#type=recovery&token_hash='+H+'&redirect_to=https://evil.test','#type=recovery&token_hash=pkce_'+H,'#type=recovery&token_hash=short','#type=recovery&token_hash='+H+'&access_token=private','?token=private#type=recovery&token_hash='+H]){const {value,cleared}=intake(suffix);assert.deepEqual(cleared,['/']);assert.equal(value.hasLink(),false);assert.equal(value.takeLink(ORIGIN),null);}
});
test('unrelated navigation is preserved and cannot claim recovery from metadata',()=>{
 const {value,cleared}=intake('#guide');assert.equal(value.discarded,false);assert.equal(value.hasLink(),false);assert.deepEqual(cleared,[]);assert.equal(value.takeLink(ORIGIN),null);
});
test('abandoning intake clears hash, and an invalid configured provider cannot redirect its secret',()=>{
 const {value}=intake('#type=recovery&token_hash='+H);value.clear();assert.equal(value.takeLink(ORIGIN),null);const v=intake('#type=recovery&token_hash='+H).value;assert.throws(()=>v.takeLink('https://evil.test'));assert.equal(v.hasLink(),false);
});
test('oversized fragments and control/damaged input never survive URL cleanup as a pending hash',()=>{
 for(const h of ['b'.repeat(257),'%00'+H,'pkce_'+H]){const {value}=intake('#type=recovery&token_hash='+h);assert.equal(value.hasLink(),false);}const v=intake('#type=recovery&token_hash='+H+'&padding='+'x'.repeat(4096));assert.equal(v.value.hasLink(),false);
});

import {readFileSync} from 'node:fs';
test('prepared email template uses fixed existing site fragment hash and contains no session, redirect or signup metadata',()=>{
 const html=readFileSync(new URL('../supabase/templates/recovery.html',import.meta.url),'utf8');assert.match(html,/https:\/\/helpdesk-consultegeo\.netlify\.app\/#type=recovery&amp;token_hash=\{\{ \.TokenHash \}\}/);assert.doesNotMatch(html,/ConfirmationURL|access_token|refresh_token|RedirectTo|\.Data|script|iframe/);const fragment=html.match(/href="([^"]+)"/)![1]!.replace('&amp;','&').replace('{{ .TokenHash }}',H);const value=captureRecoveryNavigation({href:fragment},{replaceState(){}});assert.equal(value.hasLink(),true);
});
