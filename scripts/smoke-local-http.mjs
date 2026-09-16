/** Real loopback HTTP against `npm run demo`. Persistence is still in-memory. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:4317',checks=[];
const configuration=await (await fetch(base+'/demo-config')).json();assert.equal(configuration.mode,'local-demo');
const lab=configuration.contexts.find(x=>x.key==='lab'),school=configuration.contexts.find(x=>x.key==='school');
async function call(path,who='laboratory',method='GET',body,key=randomUUID()){
 const profile=configuration.profiles.find(x=>x.key===who);const response=await fetch(base+'/v1'+path,{method,headers:{authorization:'Bearer '+profile.token,'x-workspace-id':profile.workspace_id,'content-type':'application/json','idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})});return {response,body:await response.json()};
}
function passed(name){checks.push({check:name,result:'passed'});}
for(const [who,account] of [['laboratory',lab.account_id],['school',school.account_id]]){const r=await call('/tickets',who);assert.equal(r.response.status,200);assert.ok(r.body.items.every(t=>t.account_id===account));}passed('HTTP account isolation in local demo');
assert.equal((await call('/capabilities')).body.release,'0.4.0');passed('HTTP advertises current version');
const input={account_id:lab.account_id,product_instance_id:lab.product_instance_id,service_code:lab.service_code,subject:'M1 smoke via HTTP',description:'Loopback only; fictitious data.',priority:'normal'},key=randomUUID();
const created=await call('/tickets','laboratory','POST',input,key);assert.equal(created.response.status,201);const id=created.body.id;
const replay=await call('/tickets','laboratory','POST',input,key);assert.equal(replay.response.status,200);assert.equal(replay.body.id,id);passed('HTTP create and idempotent replay');
assert.equal((await call('/tickets/'+id,'school')).response.status,404);passed('HTTP known ID from sibling account denied');
for(let i=0;i<55;i++)assert.equal((await call('/tickets/'+id+'/messages','laboratory','POST',{body:'Public message '+i})).response.status,201);
const first=await call('/tickets/'+id+'/messages');assert.equal(first.body.items.length,50);assert.ok(first.body.next_cursor);
const next=await call('/tickets/'+id+'/messages?cursor='+encodeURIComponent(first.body.next_cursor));assert.equal(next.body.items.length,5);assert.equal(next.body.next_cursor,null);assert.equal(new Set([...first.body.items,...next.body.items].map(x=>x.id)).size,55);passed('HTTP pagination across 55 actual API-created messages');
assert.equal((await call('/tickets/'+id+'/notes','agent','POST',{body:'PRIVATE LOCAL NOTE'})).response.status,201);
assert.equal((await call('/tickets/'+id+'/notes')).response.status,403);assert.doesNotMatch(JSON.stringify((await call('/tickets/'+id+'/messages')).body),/PRIVATE LOCAL NOTE/);passed('HTTP public/private conversation separation');


for(const asset of ['/app.js','/conversation-state.js','/mutation-state.js']){const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);assert.ok((await r.text()).length>100);}passed('HTTP serves all JavaScript modules including mutation guard');
assert.equal((await call('/tickets?limit=1&limit=100')).response.status,400);assert.equal((await call('/tickets?cursor=')).response.status,400);assert.equal((await call('/tickets?account_id=')).response.status,400);passed('HTTP rejects duplicate parameters and empty selectors');
const profile=configuration.profiles.find(p=>p.key==='laboratory');
const encoded=await fetch(base+'/v1/tickets',{method:'POST',headers:{authorization:'Bearer '+profile.token,'x-workspace-id':profile.workspace_id,'content-type':'application/json','content-encoding':'gzip','idempotency-key':randomUUID()},body:'{}'});assert.equal(encoded.status,415);passed('HTTP rejects compressed bodies rather than silently decoding unsupported input');

const humanLogout=await fetch(base+'/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+profile.token}});
assert.equal(humanLogout.status,401);
const noM2M=await fetch(base+'/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer hd_session_'+'z'.repeat(43)}});
assert.equal(noM2M.status,503);assert.equal((await noM2M.json()).code,'feature_not_configured');
assert.equal((await call('/me')).response.status,200);
passed('HTTP self-revocation rejects human tokens and does not fake a missing M2M backend');

console.log(JSON.stringify({scope:'Real loopback HTTP; DEMO MEMORY only. Not Supabase/PostgreSQL/Netlify.',checks},null,2));
