import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {testDom,elements} from './helpers/dom-port.ts';
const file=(name:string)=>readFileSync(new URL('../web/'+name,import.meta.url),'utf8');
const load=async(name:string)=>import('../web/'+name);
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const audience={principalId:id(1),workspaceId:id(2),accountId:id(3),ticketId:id(4),canWrite:true};
const context={principalId:id(1),workspaceId:id(2),ticketId:id(4),version:7,formRevision:2,invitationId:id(5)};
const clock=()=> '2026-10-13T12:00:00.000Z';
const record=()=>({context:{workspaceId:id(2),accountId:id(3),ticketId:id(4),ticketVersion:7,profileVersionId:'profile-1',reference:{id:'checklist-1',version:1,sha256:'a'.repeat(64)}},template:{schema:1,id:'checklist-1',version:1,status:'published',items:[{id:'check',label:'Conferir a solicitação',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'sensitive'},{id:'optional',label:'Conferência complementar',required:false,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary'}]},snapshot:null,ticketStatus:'open',assignedTo:id(1),readAt:clock()});
function checklistOptions(){return {audience,request:async()=>Response.json(record(),{headers:{etag:'"0"'}})};}
const settle=()=>new Promise(r=>setTimeout(r,0));
const by=(root:any,name:string)=>elements(root).find((e:any)=>e.attributes?.['data-ops-action']===name)!;

test('UX06 checklist exposes a qualified native progress meter, without fake unloaded totals',async()=>{
 const m=await load('execution-checklist.js'),root=testDom(),p=m.mountExecutionChecklist(root,checklistOptions());
 const meter=elements(root).find(e=>e.attributes['data-checklist-meter']!==undefined);if(!meter)throw new Error('Missing native checklist progress');assert.equal(meter.hidden,true);
 await p.load();assert.equal(meter.hidden,false);assert.equal(meter.attributes.max,'1');assert.equal(meter.attributes.value,'0');assert.match(root.textContent,/resolução exige nova validação/);p.destroy();
});
test('UX06 checklist refuses missing evidence/risk and forbidden exemption using original controller',async()=>{
 const m=await load('execution-checklist.js'),root=testDom(),p=m.mountExecutionChecklist(root,checklistOptions());await p.load();p.editItem('check');assert.equal(p.review(),false);p.setField('evidenceText','note:'+id(9));assert.equal(p.review(),false);p.setField('acknowledgeRisk',true);assert.equal(p.review(),true);p.back();p.setField('status','not_applicable');p.setField('reason','Explicação');assert.equal(p.review(),false);p.destroy();
});
test('UX06 attachments cannot send an empty selection and expose the selection before upload',async()=>{
 const m=await load('attachments.js'),root=testDom();let calls=0;const p=m.mountAttachments(root,{api:{start:()=>{calls++;}}});
 const send=elements(root).find(e=>e.textContent==='Enviar arquivos selecionados');if(!send)throw new Error('Missing upload action');assert.equal(send.disabled,true);assert.ok(by(root,'select-files'));assert.equal(calls,0);p.destroy();
});
test('UX06 attachment limits and types are advisory checks before any remote intent',async()=>{
 const m=await load('operations-ui.js');assert.equal(m.attachmentSelectionIssue([]),'Selecione pelo menos um arquivo.');
 assert.match(m.attachmentSelectionIssue([{name:'a.pdf',size:0}]),/vazio/);assert.match(m.attachmentSelectionIssue([{name:'a.exe',size:4}]),/PNG/);
 assert.equal(m.attachmentSelectionIssue([{name:'a.PDF',size:104857600}]),'');assert.match(m.attachmentSelectionIssue([{name:'a.pdf',size:104857601}]),/100 MiB/);
 assert.match(m.attachmentSelectionIssue(Array.from({length:51},()=>({name:'x.pdf',size:1}))),/50/);
});
test('UX06 approval requires a local review, explicit decision, and no request on mount',async()=>{
 const m=await load('approvals.js'),root=testDom();let reads=0,writes=0;const p=m.mountApprovals(root,{context,clock,api:{prepare:async()=>{reads++;return {ticketId:id(4),invitationId:id(5),ticketVersion:7,formRevision:2,decisionApplied:false,token:'hd_approval_'+'a'.repeat(43),expiresAt:'2026-10-13T13:00:00.000Z'};},commit:async()=>{writes++;return {kind:'unknown'};}}});
 assert.equal(reads,0);assert.ok(by(root,'review-decision'));assert.equal(by(root,'confirm-decision').hidden,true);
 await p.state.prepare();const sel=elements(root).find(e=>e.attributes['data-ops-decision']!==undefined)!;assert.ok(sel);assert.equal(sel.value,'');by(root,'review-decision').dispatch('click');assert.equal(writes,0);p.destroy();
});
test('UX06 form review displays Before/After as distinct text-only public values',async()=>{
 const m=await load('form-review.js'),root=testDom();const p=m.mountFormReview(root,{context,clock,savedDraft:async()=>({draftId:id(6),expectedDraftRevision:3,comment:''}),api:{preview:async()=>({ticketId:id(4),version:7,formRevision:2,commitAuthorized:false,previewHash:'a'.repeat(64),publicDiff:[{path:'Descrição',before:'<script>private?</script>',after:'Nova descrição',privateExtra:'DO_NOT_RENDER'}]})}});
 await p.state.previewRevision({draftId:id(6),expectedDraftRevision:3,comment:''});assert.match(root.textContent,/Antes/);assert.match(root.textContent,/Depois/);assert.doesNotMatch(root.textContent,/DO_NOT_RENDER/);assert.ok(by(root,'confirm-revision'));p.destroy();
});
test('UX06 saved-draft lookup is single-flight and cannot call preview after destruction',async()=>{
 const m=await load('form-review.js'),root=testDom();let reads=0,previews=0,done:(v:any)=>void=()=>{};const p=m.mountFormReview(root,{context,clock,savedDraft:()=>{reads++;return new Promise(r=>done=r);},api:{preview:async()=>{previews++;throw Error();}}});
 const b=by(root,'preview-revision');assert.ok(b);b.dispatch('click');b.dispatch('click');await settle();assert.equal(reads,1);p.destroy();done({draftId:id(6),expectedDraftRevision:1,comment:''});await settle();assert.equal(previews,0);assert.equal(root.textContent,'');
});
test('UX06 delivery keeps accepted separate from delivered and ignores inherited/unknown keys',async()=>{
 const m=await load('delivery-operations.js');assert.equal(m.deliveryStatusText('toString'),'Estado indisponível.');assert.equal(m.deliveryStatusText('__proto__'),'Estado indisponível.');assert.match(m.deliveryStatusText('accepted'),/ainda não confirmada/);assert.match(m.deliveryStatusText('delivered'),/confirmada pelo provedor/);
});
test('UX06 delivery UI is explicit read-only, with no provider payload and no auto-read',async()=>{
 const m=await load('delivery-operations.js'),root=testDom();let reads=0;const p=m.mountDeliveryOperations(root,{intentId:id(8),api:{read:async()=>{reads++;return {intentId:id(8),state:'accepted',attempts:0,attention:false,nextAttemptAt:null,secret:'PRIVATE'};}}});
 assert.equal(reads,0);assert.ok(by(root,'read-delivery'));await p.state.load();assert.equal(reads,1);assert.ok(elements(root).some(e=>e.attributes['data-delivery-state']==='accepted'));assert.doesNotMatch(root.textContent,/PRIVATE/);assert.match(root.textContent,/não reenvia/);p.destroy();
});
test('UX06 CSS uses semantic tokens and includes scoped mobile readability',()=>{
 const css=file('execution-checklist.css');assert.match(css,/var\(--hd-surface/);assert.doesNotMatch(css,/#115e59/);assert.match(file('operations-experience.css'),/font-size:\s*16px/);
});
test('UX06 presentation state maps cannot treat unknown values as success',async()=>{
 const m=await load('operations-ui.js');for(const v of ['toString','__proto__','clean-ish',null,{}])assert.equal(m.attachmentView(v).tone,'neutral');assert.notEqual(m.attachmentView('pending_scan').tone,'success');assert.equal(m.attachmentView('clean').label,'Análise concluída');
});
test('UX06 security controllers match preserved reference and reviewed replay checkpoint',()=>{
 // Closed response diagnostics reviewed on 2026-10-14; validation/replay rules preserved.
 const expected={'execution-checklist-state.js':'73cbfaecb43b1db7354120bcc58ba661631eef42','execution-checklist-contract.js':'8ae90bb018c1e8e119ee1387463b0a548284c20b','review-state.js':'c5edf4bb39a6815468f7cea21efe91fbba4e1c01'};
 for(const [name,sha] of Object.entries(expected)){const b=Buffer.from(file(name));assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),sha,name);}
});


test('UX06 all presentation assets are explicitly distributed without mounting optional panels',()=>{
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const demo=readFileSync(new URL('../scripts/demo.ts',import.meta.url),'utf8');
 const html=file('index.html');
 for(const name of ['operations-ui.js','operations-experience.css']){assert.ok(build.includes("'"+name+"'"),name+' build');assert.ok(demo.includes("'"+name+"'"),name+' demo');}
 assert.ok(html.includes('href="/operations-experience.css"'));assert.ok(html.includes('href="/execution-checklist.css"'));
 assert.doesNotMatch(html,/mountApprovals|mountAttachments|mountExecutionChecklist|visual-operations/);
 assert.match(demo,/execution-checklist\.css[^\n]*text\/css/);
});
