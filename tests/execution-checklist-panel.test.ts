import test from 'node:test';
import assert from 'node:assert/strict';
import {testDom,elements,type TestElement} from './helpers/dom-port.ts';
import {mountExecutionChecklist} from '../web/execution-checklist.js';
import {markingFixture} from './fixtures/checklist/marking.ts';

function setup(){const root=testDom(),f=markingFixture();let count=0;let request=async()=>Response.json(f.record,{headers:{etag:'"0"'}});
 const panel=mountExecutionChecklist(root as unknown as HTMLElement,{audience:{principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:f.context.ticketId,canWrite:true},request:async()=>{count++;return request();}});
 return {root,f,panel,count:()=>count,request:(fn:typeof request)=>{request=fn;}};
}
function attr(root:TestElement,key:string){const found=elements(root).find(e=>key in e.attributes);assert.ok(found,key);return found;}
function field(root:TestElement,name:string){const found=elements(root).find(e=>e.attributes['data-checklist-field']===name);assert.ok(found,name);return found;}

test('HDN panel has no automatic request and labels the surface as internal',()=>{const h=setup();assert.equal(h.count(),0);assert.match(h.root.textContent,/Uso interno/);assert.match(h.root.textContent,/Checklist de execução/);assert.equal(elements(h.root).some(e=>e.textContent==='Resolver chamado'),false);h.panel.destroy();});
test('HDN panel renders all items and advisory counts after explicit load',async()=>{const h=setup();await h.panel.load();assert.equal(elements(h.root).filter(e=>'data-checklist-item' in e.attributes).length,3);assert.match(attr(h.root,'data-checklist-progress').textContent,/0 de 3/);assert.equal(h.root.textContent.includes(h.f.context.accountId),false);assert.equal(h.root.textContent.includes(h.f.context.reference.sha256),false);});
test('HDN panel uses textContent for untrusted label markup',async()=>{const h=setup();h.f.template.items[0]!.label='<img src=x onerror=alert(1)>';await h.panel.load();assert.match(h.root.textContent,/<img/);assert.equal(elements(h.root).some(e=>e.tagName==='img'),false);});
test('HDN panel field labels, modal title and reason requirements stay connected',async()=>{const h=setup();await h.panel.load();h.panel.editItem('email');const dialog=attr(h.root,'data-checklist-dialog');assert.equal(dialog.open,true);
 const ids=new Set(elements(h.root).map(e=>e.attributes.id).filter(Boolean));for(const l of elements(h.root).filter(e=>e.tagName==='label'))assert.ok(ids.has(l.attributes.for));assert.ok(ids.has(dialog.attributes['aria-labelledby']));h.panel.setField('status','not_applicable');assert.equal((field(h.root,'reason') as any).required,true);
});
test('HDN panel cancellation cleans controls and has no POST',async()=>{const h=setup();await h.panel.load();h.panel.editItem('grupo');h.panel.setField('reason','PRIVATE_DRAFT');const input=field(h.root,'reason');assert.equal(input.value,'PRIVATE_DRAFT');h.panel.cancel();assert.equal(input.value,'');assert.equal(h.count(),1);assert.equal(attr(h.root,'data-checklist-dialog').open,false);});
test('HDN panel clear removes source text, fields, acknowledgements and any detached values',async()=>{const h=setup();h.f.template.items[0]!.label='PRIVATE_LABEL';await h.panel.load();const old=elements(h.root);h.panel.editItem('risco');h.panel.setField('reason','PRIVATE_DRAFT');h.panel.setField('acknowledgeRisk',true);const reason=field(h.root,'reason'),ack=field(h.root,'acknowledgeRisk');h.panel.clear();assert.equal(reason.value,'');assert.equal(ack.checked,false);assert.equal(h.root.textContent.includes('PRIVATE_'),false);assert.equal(old.some(e=>e.own.includes('PRIVATE_LABEL')),false);});
test('HDN panel destruction clears externally retained controls and listeners',async()=>{const h=setup();await h.panel.load();h.panel.editItem('grupo');h.panel.setField('reason','PRIVATE_DRAFT');const old=elements(h.root);h.panel.destroy();assert.equal(h.root.textContent,'');assert.ok(old.filter(e=>['input','textarea','select'].includes(e.tagName)).every(e=>e.value===''&&!e.checked));assert.ok(old.every(e=>Object.values(e.handlers).every(a=>a.length===0)));});
test('HDN panel unknown outcome offers reconciliation only and no editable fields',async()=>{const h=setup();await h.panel.load();h.panel.editItem('grupo');h.panel.setField('evidenceText','00000000-0000-4000-8000-000000000090');h.panel.review();h.request(async()=>{throw Error('PRIVATE_ERROR');});await h.panel.confirm();assert.equal(attr(h.root,'data-checklist-reconcile').hidden,false);assert.equal(attr(h.root,'data-checklist-refresh').disabled,true);assert.equal(attr(h.root,'data-checklist-dialog').open,false);assert.equal(elements(h.root).filter(e=>'data-checklist-item' in e.attributes).length,0);assert.equal(h.root.textContent.includes('PRIVATE_ERROR'),false);});
test('HDN panel unavailable data is not displayed as zero completed',async()=>{const h=setup();await h.panel.load();h.request(async()=>Response.json({status:403,code:'checklist_forbidden'},{status:403}));await h.panel.load();assert.equal(attr(h.root,'data-checklist-progress').textContent.includes('0 de'),false);assert.equal(elements(h.root).filter(e=>'data-checklist-item' in e.attributes).length,0);});
test('HDN panel instances never duplicate modal or input IDs',()=>{const a=setup(),b=setup();const ids=elements(a.root).concat(elements(b.root)).map(e=>e.attributes.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length);a.panel.destroy();b.panel.destroy();});
test('HDN panel input events do not treat native Attr objects as field names',async()=>{
 const h=setup();await h.panel.load();h.panel.editItem('grupo');const input=field(h.root,'reason');
 // Native NamedNodeMap exposes Attr objects for named properties, unlike the
 // original small test DOM. Exercise the event callback, not the controller API.
 (input.attributes as any)['data-checklist-field']={value:'reason'};
 input.value='Motivo digitado pelo operador';input.dispatch('input');assert.equal(h.panel.view().draft?.reason,input.value);
});
test('HDN panel reload detaches obsolete row callbacks as well as clearing their text',async()=>{
 const h=setup();await h.panel.load();const oldRows=elements(h.root).filter(e=>'data-checklist-item' in e.attributes),oldButtons=oldRows.flatMap(elements).filter(e=>e.tagName==='button');
 await h.panel.load();assert.ok(oldButtons.every(e=>(e.handlers.click??[]).length===0));assert.ok(oldRows.every(e=>!('data-checklist-item' in e.attributes)));assert.equal(elements(h.root).filter(e=>'data-checklist-item' in e.attributes).length,3);
});
