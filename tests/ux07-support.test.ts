import test from 'node:test';
import assert from 'node:assert/strict';
import {testDom,elements,TestElement} from './helpers/dom-port.ts';
const ui=()=>import('../web/optional-support.js');
const helper=()=>import('../web/support-presentation.js');
// Explicit boundary: testDom is a controlled DOM test double, not a browser HTMLElement.
const host=(root:TestElement)=>root as unknown as HTMLElement;
const by=(root:TestElement,action:string)=>elements(root).find(e=>e.attributes['data-ops-action']===action)!;
const tick=()=>new Promise(r=>setImmediate(r));
const now=Date.parse('2026-10-13T12:00:00.000Z');
const grant=()=>({id:'private-package-reference',expiresAt:'2026-10-13T13:00:00.000Z',objectCount:3});
function fields(root:TestElement){return {rating:elements(root).find(e=>e.attributes.name==='rating')!,comment:elements(root).find(e=>e.attributes.name==='comment')!,form:elements(root).find(e=>e.tagName==='form')!};}

test('UX07 knowledge distinguishes empty from unavailable and never calls opening at mount',async()=>{
 const m=await ui(),root=testDom();let n=0;
 const old=m.renderKnowledge(host(root),{items:[]},()=>{n++;});assert.match(root.textContent,/Nenhuma orientação/);assert.equal(n,0);
 assert.ok(old?.dispose,'Renderer must return cleanup');m.renderKnowledge(host(root),null,()=>{n++;});assert.match(root.textContent,/indisponível/i);assert.ok(by(root,'open-ticket'));by(root,'open-ticket').dispatch('click');assert.equal(n,1);
});
test('UX07 knowledge renders only title/snippet as text and keeps no fabricated links',async()=>{
 const m=await ui(),root=testDom();m.renderKnowledge(host(root),{items:[{title:'<script>HACK</script>',snippet:'Instrução',url:'PRIVATE_URL',category:'PRIVATE_KIND'}] } as any,()=>{});
 assert.ok(elements(root).some(e=>e.attributes['data-support-article']!==undefined));assert.match(root.textContent,/<script>/);assert.doesNotMatch(root.textContent,/PRIVATE_/);assert.equal(elements(root).filter(e=>['script','a'].includes(e.tagName)).length,0);
});
test('UX07 knowledge missing host action is unavailable rather than a false CTA',async()=>{
 const m=await ui(),root=testDom();m.renderKnowledge(host(root),null,undefined as any);assert.ok(by(root,'open-ticket')?.disabled);
});
test('UX07 replacement scrubs prior content and old dispose cannot remove the new panel',async()=>{
 const m=await ui(),root=testDom();root.setAttribute('data-host','keep');const a=m.renderKnowledge(host(root),{items:[{title:'OLD_PERSON',snippet:'OLD_SECRET'}]},()=>{});const nodes=elements(root).slice(1);
 m.renderMacroPreview(host(root),{body:'NEW_PREVIEW',sent:false});assert.ok(a?.dispose);a.dispose();assert.ok(nodes.every(e=>!e.textContent.includes('OLD_')));assert.match(root.textContent,/NEW_PREVIEW/);assert.equal(root.attributes['data-host'],'keep');
});
test('UX07 old knowledge button is inert after replacement',async()=>{
 const m=await ui(),root=testDom();let n=0;m.renderKnowledge(host(root),null,()=>{n++;});const b=by(root,'open-ticket');assert.ok(b);m.renderKnowledge(host(root),{items:[]},()=>{n+=10;});b.dispatch('click');assert.equal(n,0);
});
test('UX07 opening callback is single-flight, handles failures without private diagnostics',async()=>{
 const m=await ui(),root=testDom();let n=0,reject:(v:any)=>void=()=>{};m.renderKnowledge(host(root),null,()=>{n++;return new Promise<void>((_,r)=>reject=r);});const b=by(root,'open-ticket');assert.ok(b);b.dispatch('click');b.dispatch('click');assert.equal(n,1);reject(Error('PRIVATE_EXCEPTION'));await tick();assert.doesNotMatch(root.textContent,/PRIVATE_EXCEPTION/);assert.match(root.textContent,/Não foi possível/);assert.equal(b.disabled,false);
});
test('UX07 macro requires an actual unsent preview and exposes no send/copy action',async()=>{
 const m=await ui(),root=testDom();const p=m.renderMacroPreview(host(root),{body:'NOT_A_PREVIEW',sent:true} as any);assert.doesNotMatch(root.textContent,/NOT_A_PREVIEW/);assert.match(root.textContent,/indisponível/i);assert.ok(p?.dispose);
 m.renderMacroPreview(host(root),{body:'<b>Texto literal</b>',sent:false});assert.match(root.textContent,/<b>/);assert.match(root.textContent,/nada.*enviado/i);assert.equal(elements(root).filter(e=>e.tagName==='button').length,0);
});
test('UX07 empty macro does not masquerade as content',async()=>{
 const m=await ui(),root=testDom();m.renderMacroPreview(host(root),{body:'   ',sent:false});assert.match(root.textContent,/Nenhum texto/);
});
test('UX07 external work recognizes only own keys and never declares the ticket resolved',async()=>{
 const m=await ui(),root=testDom();for(const state of ['__proto__','constructor','toString','done','unknown']){m.renderExternalWork(host(root),{state});assert.match(root.textContent,/indisponível/i);assert.doesNotMatch(root.textContent,/function|Object|resolvido/i);}
 m.renderExternalWork(host(root),{state:'awaiting_human_validation'});assert.match(root.textContent,/validação humana/i);assert.ok(elements(root).some(e=>e.attributes['data-support-state']==='awaiting_human_validation'));assert.doesNotMatch(root.textContent,/Chamado resolvido/);
});
test('UX07 external state does not expose raw integration payload',async()=>{
 const m=await ui(),root=testDom();m.renderExternalWork(host(root),{state:'waiting_release',url:'PRIVATE_LINK',ticket:'PRIVATE_TICKET'} as any);assert.doesNotMatch(root.textContent,/PRIVATE_|Chamado resolvido/);assert.match(root.textContent,/evidência de publicação/);
});
test('UX07 package date and counts are advisory; invalid and expired grants cannot request',async()=>{
 const m=await helper();assert.equal(typeof m.packageAvailability,'function');assert.equal(m.packageAvailability(grant(),now).state,'ready');assert.equal(m.packageAvailability({...grant(),expiresAt:'2026-02-30T00:00:00.000Z'},now).state,'invalid');assert.equal(m.packageAvailability(grant(),Date.parse(grant().expiresAt)).state,'expired');assert.equal(m.packageAvailability(null,now).state,'unavailable');assert.equal(m.packageAvailability(grant(),NaN).state,'invalid');
});
test('UX07 package display excludes id token URL and unknown object properties',async()=>{
 const m=await ui(),root=testDom();let calls=0;const p=m.renderPackage(host(root),{...grant(),url:'PRIVATE_URL',token:'PRIVATE_TOKEN'} as any,()=>{calls++;},{now:()=>now});assert.ok(p?.dispose);assert.doesNotMatch(root.textContent,/PRIVATE_|private-package-reference/);assert.match(root.textContent,/São Paulo/);assert.match(root.textContent,/3/);assert.equal(calls,0);assert.ok(by(root,'request-package'));
});
test('UX07 package rechecks clock on explicit click and never authorizes by date',async()=>{
 const m=await ui(),root=testDom();let clock=now,n=0;m.renderPackage(host(root),grant(),()=>{n++;},{now:()=>clock});const b=by(root,'request-package');assert.ok(b);clock=Date.parse(grant().expiresAt);b.dispatch('click');assert.equal(n,0);assert.match(root.textContent,/expir/i);assert.equal(b.disabled,true);
});
test('UX07 package requests original reference once while pending; callback does not prove download',async()=>{
 const m=await ui(),root=testDom();let finish:()=>void=()=>{};const calls:string[]=[];m.renderPackage(host(root),grant(),(id:string)=>{calls.push(id);return new Promise<void>(r=>finish=r);},{now:()=>now});const b=by(root,'request-package');assert.ok(b);b.dispatch('click');b.dispatch('click');assert.deepEqual(calls,[grant().id]);finish();await tick();assert.match(root.textContent,/encaminhada/);assert.doesNotMatch(root.textContent,/Download concluído|Pacote autorizado/);assert.equal(b.disabled,false);
});
test('UX07 late package response cannot affect a new audience panel',async()=>{
 const m=await ui(),root=testDom();let finish:()=>void=()=>{};const p=m.renderPackage(host(root),grant(),()=>new Promise<void>(r=>finish=r),{now:()=>now});const b=by(root,'request-package');assert.ok(b);b.dispatch('click');m.renderExternalWork(host(root),{state:'waiting_internal'});finish();await tick();p.dispose();assert.match(root.textContent,/desenvolvimento/);assert.doesNotMatch(root.textContent,/encaminhada/);
});
test('UX07 CSAT has explicit labels no default score and no vote on mount',async()=>{
 const m=await ui(),root=testDom();let n=0;m.mountCsat(host(root),async()=>{n++;return {rating:5,attribution:'invitation_possession'};});const {rating,comment}=fields(root);assert.equal(rating.value,'');assert.ok(comment);assert.equal(comment.attributes.maxlength,'2000');assert.match(root.textContent,/Muito insatisfeito/);assert.match(root.textContent,/Muito satisfeito/);assert.equal(n,0);
});
test('UX07 CSAT inline rating error is accessible and stops missing or out-of-range score',async()=>{
 const m=await ui(),root=testDom();let n=0;m.mountCsat(host(root),async()=>{n++;return {rating:5,attribution:'invitation_possession'};});const {rating,form}=fields(root);
 for(const value of ['', '0', '6','-1','2.5','toString']){rating.value=value;form.dispatch('submit');assert.equal(n,0);assert.equal(rating.attributes['aria-invalid'],'true');}assert.equal(root.ownerDocument.activeElement,rating);
});
test('UX07 CSAT does not send overlong comments and shows remaining count',async()=>{
 const m=await ui(),root=testDom();let n=0;m.mountCsat(host(root),async()=>{n++;return {rating:3,attribution:'invitation_possession'};});const {rating,comment,form}=fields(root);assert.ok(comment);rating.value='3';comment.value='a'.repeat(2001);comment.dispatch('input');form.dispatch('submit');assert.equal(n,0);assert.equal(comment.attributes['aria-invalid'],'true');assert.match(root.textContent,/2001/);
});
test('UX07 CSAT single-flight and exact replay survive callback payload mutation',async()=>{
 const m=await ui(),root=testDom(),calls:any[]=[];let done:(v:any)=>void=()=>{};const p=m.mountCsat(host(root),async(input:any,key:string)=>{calls.push({input:structuredClone(input),key});input.comment='MUTATED';if(calls.length===1)return new Promise(r=>done=r);return {rating:5,attribution:'invitation_possession'};},()=> 'fixed-intent-00001');const {rating,comment,form}=fields(root);assert.ok(comment);rating.value='5';comment.value='Meu comentário';form.dispatch('submit');form.dispatch('submit');assert.equal(calls.length,1);assert.equal(comment.disabled,true);done({rating:4,attribution:'invitation_possession'});await tick();assert.equal(rating.disabled,true);by(root,'retry-csat').dispatch('click');await tick();assert.deepEqual(calls[0],calls[1]);assert.equal(comment.value,'');assert.ok(by(root,'send-csat').disabled);assert.match(root.textContent,/registrada/);p.dispose();
});
test('UX07 incompatible attribution is not a CSAT confirmation',async()=>{
 const m=await ui(),root=testDom();m.mountCsat(host(root),async()=>({rating:5,attribution:'unverified' as any}));const {rating,form}=fields(root);rating.value='5';form.dispatch('submit');await tick();assert.ok(by(root,'retry-csat'));assert.equal(by(root,'retry-csat').hidden,false);assert.doesNotMatch(root.textContent,/Avaliação registrada/);
});
test('UX07 CSAT never renders raw exceptions',async()=>{
 const m=await ui(),root=testDom();m.mountCsat(host(root),async()=>{throw Error('PRIVATE_TOKEN');});const {rating,form}=fields(root);rating.value='2';form.dispatch('submit');await tick();assert.doesNotMatch(root.textContent,/PRIVATE_TOKEN/);assert.ok(by(root,'retry-csat'));
});
test('UX07 CSAT dispose cleans old nodes listeners and late response',async()=>{
 const m=await ui(),root=testDom();let done:(v:any)=>void=()=>{},calls=0;const p=m.mountCsat(host(root),()=>{calls++;return new Promise(r=>done=r);});const {rating,comment,form}=fields(root);assert.ok(comment);rating.value='5';comment.value='PRIVATE_COMMENT';form.dispatch('submit');const old=elements(root).slice(1);p.dispose();done({rating:5,attribution:'invitation_possession'});await tick();assert.equal(comment.value,'');assert.equal(root.textContent,'');rating.value='5';form.dispatch('submit');assert.equal(calls,1);assert.ok(old.every(n=>!n.textContent.includes('PRIVATE_COMMENT')));
});
test('UX07 CSAT remount does not let old responses or old dispose destroy current view',async()=>{
 const m=await ui(),root=testDom();let done:(v:any)=>void=()=>{};const old=m.mountCsat(host(root),()=>new Promise(r=>done=r));fields(root).rating.value='5';fields(root).form.dispatch('submit');const fresh=m.mountCsat(host(root),async()=>({rating:1,attribution:'invitation_possession'}));done({rating:5,attribution:'invitation_possession'});await tick();old.dispose();assert.equal(fields(root).rating.value,'');assert.doesNotMatch(root.textContent,/Avaliação registrada/);fresh.dispose();assert.equal(root.textContent,'');
});
test('UX07 CSAT independent roots keep distinct ids, comments and pending requests',async()=>{
 const m=await ui(),r1=testDom(),r2=testDom();const p1=m.mountCsat(host(r1),async()=>({rating:1,attribution:'invitation_possession'})),p2=m.mountCsat(host(r2),async()=>({rating:2,attribution:'invitation_possession'}));assert.notEqual(fields(r1).rating.id,fields(r2).rating.id);assert.ok(fields(r1).comment);fields(r1).comment.value='first';assert.equal(fields(r2).comment.value,'');p1.dispose();assert.ok(fields(r2).rating);p2.dispose();
});
test('UX07 unavailable CSAT adapter cannot create an intent',async()=>{
 const m=await ui(),root=testDom();m.mountCsat(host(root),undefined as any);assert.ok(by(root,'send-csat')?.disabled);assert.match(root.textContent,/indisponível/i);
});
test('UX07 CSAT failed key generation is a recoverable preparation error, not dispatched uncertainty',async()=>{
 const m=await ui(),root=testDom();let n=0;m.mountCsat(host(root),async()=>{n++;return {rating:5,attribution:'invitation_possession'};},()=>{throw Error('PRIVATE_KEY');});const {rating,form}=fields(root);rating.value='5';assert.doesNotThrow(()=>form.dispatch('submit'));assert.equal(n,0);assert.doesNotMatch(root.textContent,/PRIVATE_KEY/);assert.equal(rating.disabled,false);
});

test('UX07 microsecond package validity is not rounded down at the millisecond boundary',async()=>{
 const m=await helper();const date='2026-10-13T13:00:00.123456Z';assert.equal(m.packageAvailability({...grant(),expiresAt:date},Date.parse('2026-10-13T13:00:00.123Z')).state,'ready');assert.equal(m.packageAvailability({...grant(),expiresAt:date},Date.parse('2026-10-13T13:00:00.124Z')).state,'expired');
});
test('UX07 CSAT corrected fields clear the stale validation summary without sending',async()=>{
 const m=await ui(),root=testDom();let calls=0;m.mountCsat(host(root),async()=>{calls++;return {rating:5,attribution:'invitation_possession'};});const {rating,form}=fields(root);form.dispatch('submit');assert.match(root.textContent,/Revise os campos/);rating.value='5';rating.dispatch('change');assert.doesNotMatch(root.textContent,/Revise os campos/);assert.equal(calls,0);
});
