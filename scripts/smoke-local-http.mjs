/** Real loopback HTTP against `npm run demo`. Persistence is still in-memory. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eventPresentation} from '../web/timeline-state.js';
const base='http://127.0.0.1:4317',checks=[];
const configuration=await (await fetch(base+'/demo-config')).json();assert.equal(configuration.mode,'local-demo');
const lab=configuration.contexts.find(x=>x.key==='lab'),school=configuration.contexts.find(x=>x.key==='school');
async function call(path,who='laboratory',method='GET',body,key=randomUUID(),extraHeaders={}){
 const profile=configuration.profiles.find(x=>x.key===who);const response=await fetch(base+'/v1'+path,{method,headers:{authorization:'Bearer '+profile.token,'x-workspace-id':profile.workspace_id,'content-type':'application/json','idempotency-key':key,...extraHeaders},...(body?{body:JSON.stringify(body)}:{})});return {response,body:await response.json()};
}
function passed(name){checks.push({check:name,result:'passed'});}
for(const [who,account] of [['laboratory',lab.account_id],['school',school.account_id]]){const r=await call('/tickets',who);assert.equal(r.response.status,200);assert.ok(r.body.items.every(t=>t.account_id===account));}passed('HTTP account isolation in local demo');
assert.equal((await call('/capabilities')).body.release,'0.8.0');passed('HTTP advertises current version');
const input={account_id:lab.account_id,product_instance_id:lab.product_instance_id,service_code:lab.service_code,subject:'M1 smoke via HTTP',description:'Loopback only; fictitious data.',priority:'normal'},key=randomUUID();
const created=await call('/tickets','laboratory','POST',input,key);assert.equal(created.response.status,201);const id=created.body.id;
const replay=await call('/tickets','laboratory','POST',input,key);assert.equal(replay.response.status,200);assert.equal(replay.body.id,id);passed('HTTP create and idempotent replay');
assert.equal((await call('/tickets/'+id,'school')).response.status,404);passed('HTTP known ID from sibling account denied');
for(let i=0;i<55;i++)assert.equal((await call('/tickets/'+id+'/messages','laboratory','POST',{body:'Public message '+i})).response.status,201);
const first=await call('/tickets/'+id+'/messages');assert.equal(first.body.items.length,50);assert.ok(first.body.next_cursor);
const next=await call('/tickets/'+id+'/messages?cursor='+encodeURIComponent(first.body.next_cursor));assert.equal(next.body.items.length,5);assert.equal(next.body.next_cursor,null);assert.equal(new Set([...first.body.items,...next.body.items].map(x=>x.id)).size,55);passed('HTTP pagination across 55 actual API-created messages');
assert.equal((await call('/tickets/'+id+'/notes','agent','POST',{body:'PRIVATE LOCAL NOTE'})).response.status,201);
assert.equal((await call('/tickets/'+id+'/notes')).response.status,403);assert.doesNotMatch(JSON.stringify((await call('/tickets/'+id+'/messages')).body),/PRIVATE LOCAL NOTE/);passed('HTTP public/private conversation separation');


for(const asset of ['/app.js','/conversation-state.js','/mutation-state.js','/support-catalog-state.js','/ticket-list-state.js','/timeline-state.js']){const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);assert.ok((await r.text()).length>100);}passed('HTTP serves all JavaScript modules including mutation guard');
assert.equal((await call('/tickets?limit=1&limit=100')).response.status,400);assert.equal((await call('/tickets?cursor=')).response.status,400);assert.equal((await call('/tickets?account_id=')).response.status,400);passed('HTTP rejects duplicate parameters and empty selectors');
const profile=configuration.profiles.find(p=>p.key==='laboratory');
const encoded=await fetch(base+'/v1/tickets',{method:'POST',headers:{authorization:'Bearer '+profile.token,'x-workspace-id':profile.workspace_id,'content-type':'application/json','content-encoding':'gzip','idempotency-key':randomUUID()},body:'{}'});assert.equal(encoded.status,415);passed('HTTP rejects compressed bodies rather than silently decoding unsupported input');

const humanLogout=await fetch(base+'/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+profile.token}});
assert.equal(humanLogout.status,401);
const noM2M=await fetch(base+'/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer hd_session_'+'z'.repeat(43)}});
assert.equal(noM2M.status,503);assert.equal((await noM2M.json()).code,'feature_not_configured');
assert.equal((await call('/me')).response.status,200);
passed('HTTP self-revocation rejects human tokens and does not fake a missing M2M backend');

const beforeCatalog=(await call('/tickets','agent')).body.items.length;
for(const [who,account] of [['laboratory',lab.account_id],['school',school.account_id]]){
 const r=await call('/support-contexts',who);assert.equal(r.response.status,200);assert.equal(r.response.headers.get('cache-control'),'no-store');assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].account_id,account);assert.ok(r.body.items[0].account_name);assert.ok(r.body.items[0].product_name);assert.ok(r.body.items[0].service_name);assert.equal(r.body.next_cursor,null);
 assert.deepEqual(Object.keys(r.body.items[0]).sort(),['account_id','account_name','product_instance_id','product_name','environment','service_code','service_name'].sort());
}
passed('HTTP authorized catalog supplies names without sibling account or private data');
const firstCatalog=await call('/support-contexts?limit=1','agent');assert.equal(firstCatalog.body.items.length,1);assert.ok(firstCatalog.body.next_cursor);
const lastCatalog=await call('/support-contexts?limit=1&cursor='+encodeURIComponent(firstCatalog.body.next_cursor),'agent');assert.equal(lastCatalog.body.items.length,1);assert.equal(lastCatalog.body.next_cursor,null);assert.notEqual(firstCatalog.body.items[0].account_id,lastCatalog.body.items[0].account_id);
assert.equal((await call('/tickets','agent')).body.items.length,beforeCatalog);
passed('HTTP catalog pagination keeps two contexts distinct and creates no tickets');
assert.equal((await call('/support-contexts?account_id='+school.account_id)).response.status,404);
assert.equal((await call('/support-contexts?limit=1&limit=100')).response.status,400);
assert.equal((await call('/support-contexts?cursor='+encodeURIComponent(firstCatalog.body.next_cursor),'laboratory')).response.status,400);
assert.equal((await call('/capabilities')).body.capabilities.support_catalog,true);
passed('HTTP catalog denies forbidden filters and a cursor from another actor');

// Create enough newer tickets to prove the search is not limited to the first 25.
for(let i=0;i<30;i++)assert.equal((await call('/tickets','laboratory','POST',{...input,subject:'M1F lote pesquisável '+i,priority:i%2?'high':'normal'})).response.status,201);
assert.ok(!(await call('/tickets?limit=25')).body.items.some(t=>t.id===id));
const found=await call('/tickets?q='+encodeURIComponent('M1 smoke via HTTP'));assert.equal(found.response.status,200);assert.deepEqual(found.body.items.map(t=>t.id),[id]);
passed('HTTP server search reaches a ticket beyond the first 25 without preloading pages');
const filtered=await call('/tickets?q='+encodeURIComponent('M1F lote')+'&status=received&priority=high');assert.equal(filtered.body.items.length,15);assert.ok(filtered.body.items.every(t=>t.priority==='high'&&t.status==='received'));
passed('HTTP combines literal query, public status and priority before pagination');
const ids=[];let cursor;do{const r=await call('/tickets?limit=7&q='+encodeURIComponent('M1F lote')+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(r.response.status,200);ids.push(...r.body.items.map(t=>t.id));cursor=r.body.next_cursor;}while(cursor);
assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);const cursorPage=await call('/tickets?limit=1&q='+encodeURIComponent('M1F lote'));
assert.equal((await call('/tickets?limit=1&q=outro&cursor='+encodeURIComponent(cursorPage.body.next_cursor))).response.status,400);
passed('HTTP filtered pagination has 30 distinct results and rejects cursor reuse with another query');
assert.equal((await call('/tickets?q='+encodeURIComponent('M1F lote'),'school')).body.items.length,0);
assert.equal((await call('/tickets?q='+encodeURIComponent('PRIVATE LOCAL NOTE'))).body.items.length,0);
assert.equal((await call('/tickets?q=M1F&q=outro')).response.status,400);assert.equal((await call('/capabilities')).body.capabilities.ticket_search,true);
passed('HTTP search preserves account/private-note isolation and advertises the implemented capability');


const beforePriority=await call('/tickets/'+id,'agent'),priorityVersion=beforePriority.body.version,priorityKey=randomUUID();
const priorityBody={priority:'urgent',reason:'INTERNAL PRIORITY LOCAL REASON'};
const changed=await call('/tickets/'+id,'agent','PATCH',priorityBody,priorityKey,{'if-match':'"'+priorityVersion+'"'});
assert.equal(changed.response.status,200);assert.equal(changed.body.priority,'urgent');assert.equal(changed.body.version,priorityVersion+1);assert.equal(changed.response.headers.get('etag'),'"'+(priorityVersion+1)+'"');assert.doesNotMatch(JSON.stringify(changed.body),/INTERNAL PRIORITY LOCAL REASON|contractSnapshot/);
const priorityReplay=await call('/tickets/'+id,'agent','PATCH',priorityBody,priorityKey,{'if-match':'"'+priorityVersion+'"'});assert.equal(priorityReplay.response.headers.get('idempotency-replayed'),'true');assert.deepEqual(priorityReplay.body,changed.body);
passed('HTTP priority update is versioned, minimizes response and supports exact replay');
const stalePriority=await call('/tickets/'+id,'agent','PATCH',{priority:'low',reason:'Stale reason'},randomUUID(),{'if-match':'"'+priorityVersion+'"'});assert.equal(stalePriority.response.status,412);assert.equal((await call('/tickets/'+id)).body.priority,'urgent');
assert.equal((await call('/tickets/'+id,'agent','PATCH',{priority:'high',reason:'Other'},priorityKey,{'if-match':'"'+priorityVersion+'"'})).response.status,409);
passed('HTTP stale version and changed idempotency payload do not overwrite priority');
for(const who of ['laboratory','school'])assert.ok([403,404].includes((await call('/tickets/'+id,who,'PATCH',{priority:'low',reason:'Unauthorized'},randomUUID(),{'if-match':'"'+(priorityVersion+1)+'"'})).response.status));
assert.equal((await call('/tickets/'+id,'agent','PATCH',{priority:'low',reason:'Extra',account_id:school.account_id},randomUUID(),{'if-match':'"'+(priorityVersion+1)+'"'})).response.status,400);
passed('HTTP requester, sibling account and mass assignment cannot change priority');
for(const who of ['laboratory','agent']){
 const events=[];let nextCursor;
 do{const response=await call('/tickets/'+id+'/timeline?limit=20'+(nextCursor?'&cursor='+encodeURIComponent(nextCursor):''),who);assert.equal(response.response.status,200);events.push(...response.body.items);nextCursor=response.body.next_cursor;assert.ok(events.length<100);}while(nextCursor);
 assert.equal(new Set(events.map(e=>e.id)).size,events.length);
 for(const e of events)eventPresentation(e,who==='agent');
 const priorityEvents=events.filter(e=>e.type==='ticket.priority_changed');assert.equal(priorityEvents.length,1);assert.equal(priorityEvents[0].data.version,priorityVersion+1);
 if(who==='agent'){assert.equal(priorityEvents[0].data.reason,priorityBody.reason);assert.ok(events.some(e=>e.type==='note.created'));}
 else{assert.doesNotMatch(JSON.stringify(events),/INTERNAL PRIORITY LOCAL REASON|note.created|PRIVATE LOCAL NOTE/);assert.deepEqual(Object.keys(priorityEvents[0].data).sort(),['from','to','version']);}
}
passed('HTTP paginated timeline and real presentation module keep internal reasons out of client events');
const current=(await call('/tickets/'+id,'agent')).body,noop=await call('/tickets/'+id,'agent','PATCH',{priority:current.priority,reason:'Reviewed unchanged'},randomUUID(),{'if-match':'"'+current.version+'"'});
assert.equal(noop.response.status,200);assert.equal(noop.body.version,current.version);assert.equal((await call('/capabilities')).body.capabilities.ticket_priority_update,true);assert.equal((await call('/capabilities')).body.capabilities.ticket_timeline,true);
passed('HTTP same-priority review is a no-op and capabilities announce only implemented operations');

console.log(JSON.stringify({scope:'Real loopback HTTP; DEMO MEMORY only. Not Supabase/PostgreSQL/Netlify.',checks},null,2));
