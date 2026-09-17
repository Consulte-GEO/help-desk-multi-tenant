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
assert.equal((await call('/capabilities')).body.release,'0.19.0');passed('HTTP advertises current version');
const input={account_id:lab.account_id,product_instance_id:lab.product_instance_id,service_code:lab.service_code,subject:'M1 smoke via HTTP',description:'Loopback only; fictitious data.',priority:'normal'},key=randomUUID();
const created=await call('/tickets','laboratory','POST',input,key);assert.equal(created.response.status,201);const id=created.body.id;
const replay=await call('/tickets','laboratory','POST',input,key);assert.equal(replay.response.status,200);assert.equal(replay.body.id,id);passed('HTTP create and idempotent replay');
assert.equal((await call('/tickets/'+id,'school')).response.status,404);passed('HTTP known ID from sibling account denied');
for(let i=0;i<55;i++)assert.equal((await call('/tickets/'+id+'/messages','laboratory','POST',{body:'Public message '+i})).response.status,201);
const first=await call('/tickets/'+id+'/messages');assert.equal(first.body.items.length,50);assert.ok(first.body.next_cursor);
const next=await call('/tickets/'+id+'/messages?cursor='+encodeURIComponent(first.body.next_cursor));assert.equal(next.body.items.length,5);assert.equal(next.body.next_cursor,null);assert.equal(new Set([...first.body.items,...next.body.items].map(x=>x.id)).size,55);passed('HTTP pagination across 55 actual API-created messages');
assert.equal((await call('/tickets/'+id+'/notes','agent','POST',{body:'PRIVATE LOCAL NOTE'})).response.status,201);
assert.equal((await call('/tickets/'+id+'/notes')).response.status,403);assert.doesNotMatch(JSON.stringify((await call('/tickets/'+id+'/messages')).body),/PRIVATE LOCAL NOTE/);passed('HTTP public/private conversation separation');


for(const asset of ['/app.js','/shared/instant.js','/ticket-actions.js','/human-auth.js','/human-session.js','/session-fetch.js','/conversation-state.js','/mutation-state.js','/support-catalog-state.js','/ticket-list-state.js','/timeline-state.js']){const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);assert.ok((await r.text()).length>100);}passed('HTTP serves all JavaScript modules including mutation guard');
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


const assigneeStart=(await call('/tickets/'+id,'agent')).body,assignmentKey=randomUUID(),assignmentBody={action:'claim',reason:'PRIVATE ASSIGNMENT REASON'};
assert.deepEqual(assigneeStart.assignment,{state:'unassigned',can_claim:true,can_release:false});
const claimed=await call('/tickets/'+id+'/assignments','agent','POST',assignmentBody,assignmentKey,{'if-match':'"'+assigneeStart.version+'"'});
assert.equal(claimed.response.status,200);assert.equal(claimed.body.version,assigneeStart.version+1);assert.deepEqual(claimed.body.assignment,{state:'mine',can_claim:false,can_release:true});assert.doesNotMatch(JSON.stringify(claimed.body),/agent-demo|assigned_to|assignedTo/);
passed('HTTP operator claims responsibility with version increment and no principal identifier in DTO');
const sameClaim=await call('/tickets/'+id+'/assignments','agent','POST',assignmentBody,assignmentKey,{'if-match':'"'+assigneeStart.version+'"'});assert.equal(sameClaim.response.headers.get('idempotency-replayed'),'true');assert.equal(sameClaim.body.version,claimed.body.version);
const released=await call('/tickets/'+id+'/assignments','agent','POST',{action:'release',reason:'Returning for triage'},randomUUID(),{'if-match':'"'+claimed.body.version+'"'});assert.equal(released.response.status,200);assert.equal(released.body.assignment.state,'unassigned');
const oldReplay=await call('/tickets/'+id+'/assignments','agent','POST',assignmentBody,assignmentKey,{'if-match':'"'+assigneeStart.version+'"'});assert.equal(oldReplay.body.assignment.state,'mine');assert.equal((await call('/tickets/'+id,'agent')).body.assignment.state,'unassigned');
passed('HTTP claim replay and release preserve original responses without reassigning again');
for(const who of ['laboratory','school'])assert.equal((await call('/tickets/'+id+'/assignments',who,'POST',assignmentBody,randomUUID(),{'if-match':'"'+released.body.version+'"'})).response.status,who==='laboratory'?403:404);
assert.equal((await call('/tickets/'+id+'/assignments','agent','POST',{...assignmentBody,assigned_to:'someone'},randomUUID(),{'if-match':'"'+released.body.version+'"'})).response.status,400);
passed('HTTP assignment denies customer, sibling account and arbitrary target injection');
assert.equal((await call('/tickets/'+id+'/assignments','agent','POST',assignmentBody,randomUUID(),{'if-match':'"'+assigneeStart.version+'"'})).response.status,412);
assert.equal((await call('/tickets/'+id+'/assignments','agent','POST',assignmentBody,randomUUID(),{'if-match':''})).response.status,428);
passed('HTTP assignment requires current version and rejects stale updates');
const staffHistory=(await call('/tickets/'+id+'/timeline?limit=50','agent')).body.items,privateAssignment=staffHistory.filter(e=>e.type==='ticket.assignment_changed');assert.equal(privateAssignment.length,2);for(const e of privateAssignment){assert.deepEqual(Object.keys(e.data).sort(),['action','reason','version']);assert.equal(eventPresentation(e,true).internal,true);}
assert.doesNotMatch(JSON.stringify((await call('/tickets/'+id+'/timeline?limit=100')).body),/ticket.assignment_changed|PRIVATE ASSIGNMENT REASON|Returning for triage/);
passed('HTTP assignment history stays private and projection excludes assignee identifiers');
assert.equal('assignment' in (await call('/tickets/'+id)).body,false);assert.ok((await call('/tickets','laboratory')).body.items.every(t=>!('assignment' in t)));assert.equal((await call('/capabilities')).body.capabilities.ticket_self_assignment,true);
const html=await (await fetch(base+'/')).text();for(const name of ['assignment-form','assignment-reason','claim-ticket','release-ticket','assignment-reload'])assert.ok(html.includes('id="'+name+'"'));
passed('HTTP customer lists omit assignment and shipped interface contains explicit claim/release controls');

// Review v0.11: responsibility filter on the real local HTTP transport.
const beforeFilter=(await call('/tickets/'+id,'agent')).body;
const filterClaim=await call('/tickets/'+id+'/assignments','agent','POST',{action:'claim',reason:'Review filter'},randomUUID(),{'if-match':'"'+beforeFilter.version+'"'});
assert.equal(filterClaim.response.status,200);
const ownView=await call('/tickets?assignment=mine&q='+id,'agent');assert.equal(ownView.response.status,200);assert.deepEqual(ownView.body.items.map(t=>t.id),[id]);
const freeView=await call('/tickets?assignment=unassigned&q='+id,'agent');assert.equal(freeView.response.status,200);assert.equal(freeView.body.items.length,0);
passed('HTTP mine/unassigned views are applied on the server, not only loaded items');
assert.equal((await call('/tickets?assignment=mine','laboratory')).response.status,403);
assert.equal((await call('/tickets?assignment=unassigned','school')).response.status,403);
assert.equal((await call('/tickets?assignment=other','agent')).response.status,400);
assert.equal((await call('/tickets?assignment=mine&assignment=unassigned','agent')).response.status,400);
passed('HTTP responsibility filters deny customers and malformed selectors');
const invalidText=await call('/tickets/'+id+'/messages','agent','POST',{body:'Not persistable\u0000'},randomUUID());
assert.equal(invalidText.response.status,400);assert.doesNotMatch(JSON.stringify(invalidText.body),/Not persistable/);
const invalidUnicode=await call('/tickets/'+id+'/messages','agent','POST',{body:'Not persistable\uD800'},randomUUID());assert.equal(invalidUnicode.response.status,400);
passed('HTTP rejects JSON-escaped NUL and lone surrogate before writing a message');
const filterReleased=await call('/tickets/'+id+'/assignments','agent','POST',{action:'release',reason:'Review complete'},randomUUID(),{'if-match':'"'+filterClaim.body.version+'"'});
assert.equal(filterReleased.response.status,200);assert.deepEqual((await call('/tickets?assignment=unassigned&q='+id,'agent')).body.items.map(t=>t.id),[id]);
assert.equal((await call('/capabilities')).body.capabilities.ticket_assignment_filter,true);
assert.ok(html.includes('id="assignment-filter"'));
passed('HTTP released ticket returns to unassigned and the capability/UI are shipped');

const actionCustomer=await call('/tickets/'+id),actionAgent=await call('/tickets/'+id,'agent');
for(const result of [actionCustomer,actionAgent]){const a=result.body.available_actions;assert.equal(a.ticket_id,id);assert.equal(a.version,result.body.version);assert.equal(result.response.headers.get('etag'),'"'+a.version+'"');assert.equal(result.response.headers.get('cache-control'),'no-store');}
assert.equal(actionAgent.body.available_actions.read_notes,true);assert.equal(actionCustomer.body.available_actions.read_notes,false);assert.equal(actionCustomer.body.available_actions.change_priority,false);assert.deepEqual(actionCustomer.body.available_actions.transitions,[]);
passed('HTTP current detail actions match the version and keep customer privileges restricted');
assert.ok(!('available_actions' in created.body));assert.ok(!('available_actions' in replay.body));assert.ok((await call('/tickets','agent')).body.items.every(t=>!('available_actions' in t)));assert.ok(!('available_actions' in filterReleased.body));
assert.equal((await call('/capabilities')).body.capabilities.ticket_action_hints,true);
passed('HTTP current actions are not copied into lists, commands or stored replay responses');
const beforeOpen=(await call('/tickets/'+id,'agent')).body;assert.equal(beforeOpen.internal_status,'new');
const opened=await call('/tickets/'+id+'/transitions','agent','POST',{to:'open',reason:'Synthetic triage accepted'},randomUUID(),{'if-match':'"'+beforeOpen.version+'"'});assert.equal(opened.response.status,200);
const beforeResolve=(await call('/tickets/'+id,'agent')).body;
const resolved=await call('/tickets/'+id+'/transitions','agent','POST',{to:'resolved',reason:'Synthetic action contract check'},randomUUID(),{'if-match':'"'+beforeResolve.version+'"'});assert.equal(resolved.response.status,200);
const reopenHints=(await call('/tickets/'+id)).body;
assert.deepEqual(reopenHints.available_actions.transitions,[{to:'open',requires_reason:true},{to:'closed',requires_reason:false}]);
const refusedReopen=await call('/tickets/'+id+'/transitions','laboratory','POST',{to:'open',reason:''},randomUUID(),{'if-match':'"'+reopenHints.version+'"'});assert.equal(refusedReopen.response.status,400);
assert.equal((await call('/tickets/'+id)).body.version,reopenHints.version);
passed('HTTP reopen hints require a reason and the actual command rejects an empty one');

console.log(JSON.stringify({scope:'Real loopback HTTP; DEMO MEMORY only. Not Supabase/PostgreSQL/Netlify.',checks},null,2));
