import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const modulePath='../scripts/knowledge-editorial-review-core.mjs';
async function api(){const m=await import(modulePath).catch(()=>({}));assert.equal(typeof m.prepareKnowledgeReview,'function','Review-plan implementation missing');assert.equal(typeof m.evaluateKnowledgeReview,'function');return m;}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const at='2026-10-11T23:00:00.000Z';
const body='# Orientação\n\n## Consulta\nMensagem-sintética-privada. [a confirmar]\n';
async function fixture(t:any,docs:Record<string,string>={'operacao/consulta.md':body}){
 const root=await mkdtemp(join(tmpdir(),'hdw00b-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const [p,s] of Object.entries(docs)){await mkdir(join(root,p,'..'),{recursive:true});await writeFile(join(root,p),s);}
 return {root,policy:{schemaVersion:1,corpusId:'wiki-v3',revision:1,status:'draft',sources:Object.entries(docs).map(([path,s])=>({path,sha256:hash(s),classification:'editorial',generation:'MIXED',basis:['wiki_herdada'],target:null as string|null}))}};
}
const prepare=async(f:any)=>(await api()).prepareKnowledgeReview(f.root,f.policy,{at});
const evaluate=async(f:any,p:any)=>(await api()).evaluateKnowledgeReview(f.root,f.policy,p,{at});
function selected(p:any){p=structuredClone(p);p.sources.forEach((s:any)=>s.action='review_candidates');p.items.forEach((i:any)=>i.action='select');return p;}
const forbidden=(r:any)=>{assert.equal(r.publicationAllowed,false);assert.equal(r.operational,false);assert.equal(r.sanitizationVerified,false);};

test('HDW00b prepares a complete private pending plan with no source body or approval',async t=>{
 const f=await fixture(t),p=await prepare(f);assert.equal(p.kind,'knowledge_editorial_review');assert.equal(p.status,'draft');
 assert.equal(p.sources.length,1);assert.equal(p.items.length,1);assert.equal(p.sources[0].action,'pending');assert.equal(p.items[0].action,'pending');
 assert.equal(p.items[0].sectionSha256,hash('## Consulta\nMensagem-sintética-privada. [a confirmar]'));forbidden(p);
 assert.equal(JSON.stringify(p).includes('Mensagem-sintética-privada'),false);assert.equal(JSON.stringify(p).includes(f.root),false);
});
test('HDW00b unchanged source permits review at a different observation instant',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));const r=await(await api()).evaluateKnowledgeReview(f.root,f.policy,p,{at:'2026-10-11T23:01:00.000Z'});
 assert.equal(r.status,'private_selection_prepared');assert.equal(r.selected.items.length,1);assert.deepEqual(r.selected.items[0].markers,['unconfirmed']);
 assert.equal(r.selected.items[0].applicabilityVerified,false);assert.equal(r.selected.items[0].generation,'MIXED');forbidden(r);
});
test('HDW00b pending decisions do not select all items by default',async t=>{
 const f=await fixture(t),r=await evaluate(f,await prepare(f));assert.equal(r.status,'review_incomplete');assert.equal(r.selected.items.length,0);assert.equal(r.summary.pendingItems,1);forbidden(r);
});
test('HDW00b per-item selection and explicit exclusion retain complete input coverage',async t=>{
 const f=await fixture(t,{'operacao/consulta.md':body+'\n## Outra\nOutro assunto.\n'}),p=selected(await prepare(f));p.items[1].action='exclude';
 const before=JSON.stringify(p),r=await evaluate(f,p);assert.equal(r.selected.items.length,1);assert.equal(r.summary.excludedItems,1);assert.equal(JSON.stringify(p),before);forbidden(r);
});
test('HDW00b same ID input cannot approve itself or add a publication override',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));p.publicationAllowed=true;await assert.rejects(evaluate(f,p),{code:'knowledge_review_invalid'});
});
for(const [label,edit] of [
 ['source omitted',(p:any)=>p.sources.pop()],['source duplicate',(p:any)=>p.sources.push(p.sources[0])],
 ['item omitted',(p:any)=>p.items.pop()],['item duplicate',(p:any)=>p.items.push(p.items[0])],
 ['foreign item',(p:any)=>p.items[0].id='KBC-'+'e'.repeat(24)],
 ['range hash',(p:any)=>p.items[0].sectionSha256='e'.repeat(64)],
 ['source hash',(p:any)=>p.sources[0].sourceSha256='e'.repeat(64)],
 ['binding',(p:any)=>p.binding.sourceSetSha256='e'.repeat(64)],
] as const)test('HDW00b rejects incomplete or stale '+label,async t=>{const f=await fixture(t),p=selected(await prepare(f));edit(p);await assert.rejects(evaluate(f,p),(e:any)=>['knowledge_review_stale','knowledge_review_invalid'].includes(e.code));});
for(const action of ['pending','exclude','request_revision'])test('HDW00b select cannot bypass source decision '+action,async t=>{
 const f=await fixture(t),p=selected(await prepare(f));p.sources[0].action=action;await assert.rejects(evaluate(f,p),{code:'knowledge_review_selection_denied'});
});
test('HDW00b a quarantined source cannot be reviewed by declaring an exception',async t=>{
 const f=await fixture(t,{'operacao/consulta.md':body+'\nPassword="synthetic-private-marker";'});let p=await prepare(f);
 assert.equal(p.items.length,0);p=structuredClone(p);p.sources[0].action='review_candidates';
 await assert.rejects(evaluate(f,p),{code:'knowledge_review_selection_denied'});
});
test('HDW00b safe subset may be triaged without clearing another quarantined source',async t=>{
 const f=await fixture(t,{'operacao/consulta.md':body,'operacao/restrito.md':'Password="synthetic-private-marker";'}),p=structuredClone(await prepare(f));
 for(const s of p.sources)s.action=s.path.endsWith('restrito.md')?'request_revision':'review_candidates';p.items[0].action='select';
 const r=await evaluate(f,p);assert.equal(r.status,'private_selection_prepared');assert.equal(r.auditStatus,'blocked');assert.equal(r.summary.quarantinedSources,1);assert.equal(r.summary.requestedRevisions,1);assert.equal(r.selected.items.length,1);forbidden(r);assert.equal(JSON.stringify(r).includes('synthetic-private-marker'),false);
});
for(const [name,field,value] of [['internal','classification','internal'],['legacy','generation','LEGADO']] as const)test('HDW00b no review of excluded '+name+' documents',async t=>{
 const f=await fixture(t);(f.policy.sources[0] as any)[field]=value;const p=structuredClone(await prepare(f));p.sources[0].action='review_candidates';await assert.rejects(evaluate(f,p),{code:'knowledge_review_selection_denied'});
});
test('HDW00b instruction file is not an editorial candidate even if the policy says editorial',async t=>{
 const f=await fixture(t,{'AGENTS.md':body}),p=structuredClone(await prepare(f));p.sources[0].action='review_candidates';await assert.rejects(evaluate(f,p),{code:'knowledge_review_selection_denied'});
});
test('HDW00b source changes after plan invalidate it, without selecting partial surviving entries',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));await writeFile(join(f.root,'operacao/consulta.md'),body+'\nchanged');await assert.rejects(evaluate(f,p),{code:'knowledge_review_stale'});
});
test('HDW00b changing policy metadata, not just file bytes, invalidates previous decisions',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));f.policy.sources[0]!.generation='NOVO_GEO';await assert.rejects(evaluate(f,p),{code:'knowledge_review_stale'});
});
test('HDW00b newly unlisted file invalidates the plan even though configured files match',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));await writeFile(join(f.root,'new.md'),'New');await assert.rejects(evaluate(f,p),{code:'knowledge_review_stale'});
});
test('HDW00b an already incomplete audit can be inventoried but never yields a selected subset',async t=>{
 const f=await fixture(t);await rm(join(f.root,'operacao/consulta.md'));const p=await prepare(f),r=await evaluate(f,p);assert.equal(r.status,'source_blocked');assert.equal(r.selected.items.length,0);forbidden(r);
});
test('HDW00b unknown extras never carry free text or reviewer-supplied approval',async t=>{
 const f=await fixture(t);for(const mutate of [(p:any)=>p.approved=true,(p:any)=>p.items[0].body='private-marker',(p:any)=>p.sources[0].reason='private-marker',(p:any)=>p.binding.secret='private-marker']){
  const p=selected(await prepare(f));mutate(p);await assert.rejects(evaluate(f,p),(e:any)=>e.code==='knowledge_review_invalid'&&!e.message.includes('private-marker'));
 }
});
test('HDW00b getters, sparse arrays and hostile proxies fail without invoking source getters',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));let reads=0;
 const getter=structuredClone(p);Object.defineProperty(getter.items[0],'action',{enumerable:true,get(){reads++;return 'select';}});
 const sparse=structuredClone(p);delete sparse.items[0];
 for(const q of [getter,sparse,new Proxy({},{ownKeys(){throw Error('private-marker');}})])await assert.rejects(evaluate(f,q),(e:any)=>e.code==='knowledge_review_invalid'&&!e.message.includes('private-marker'));
 assert.equal(reads,0);
});
test('HDW00b exact source and policy yields immutable detached output without changing wiki',async t=>{
 const f=await fixture(t),before=await readFile(join(f.root,'operacao/consulta.md')),p=selected(await prepare(f)),r=await evaluate(f,p);
 assert.equal(Object.isFrozen(r),true);assert.equal(Object.isFrozen(r.selected.items),true);p.items[0].action='exclude';assert.equal(r.selected.items.length,1);assert.deepEqual(await readFile(join(f.root,'operacao/consulta.md')),before);
});
test('HDW00b overlay original and replacement do not share an actionable review identity',async t=>{
 const f=await fixture(t,{'operacao/consulta.md':body,'patches/arquivos-sanitizados/operacao/consulta.md':body+'\nNew'});f.policy.sources[1]!.target='operacao/consulta.md';
 const p=structuredClone(await prepare(f));p.sources.forEach((s:any)=>s.action=s.path.startsWith('patches/')?'review_candidates':'exclude');p.items.forEach((i:any)=>i.action='select');
 const r=await evaluate(f,p);assert.equal(r.selected.items.length,1);assert.equal(r.selected.items[0].sourcePath,'patches/arquivos-sanitizados/operacao/consulta.md');
 p.sources[0].action='review_candidates';await assert.rejects(evaluate(f,p),{code:'knowledge_review_selection_denied'});
});
test('HDW00b excluding a source excludes its pending items without treating them as selected',async t=>{
 const f=await fixture(t),p=structuredClone(await prepare(f));p.sources[0].action='exclude';const r=await evaluate(f,p);assert.equal(r.status,'review_incomplete');assert.equal(r.summary.effectivelyExcludedItems,1);assert.equal(r.selected.items.length,0);
});

for(const flag of ['operational','sanitizationVerified'])test('HDW00b cannot set '+flag+' in a draft',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));p[flag]=true;await assert.rejects(evaluate(f,p),{code:'knowledge_review_invalid'});
});
for(const [label,change] of [
 ['status',(p:any)=>p.status='approved'],['unknown action',(p:any)=>p.items[0].action='publish'],
 ['empty action',(p:any)=>p.sources[0].action=''],['path traversal',(p:any)=>p.sources[0].path='../secret.md'],
 ['non-enumerable',(p:any)=>Object.defineProperty(p,'private',{value:'private-marker'})],
 ['symbol',(p:any)=>p[Symbol('extra')]='private-marker'],
] as const)test('HDW00b rejects '+label+' without echoing data',async t=>{const f=await fixture(t),p=selected(await prepare(f));change(p);await assert.rejects(evaluate(f,p),(e:any)=>e.code==='knowledge_review_invalid'&&!e.message.includes('private-marker'));});
test('HDW00b source and item ordering in a manual plan does not change selected output',async t=>{
 const f=await fixture(t,{'a.md':body,'b.md':body+'\n## B\nOutra'}),p=selected(await prepare(f)),a=await evaluate(f,p);p.sources.reverse();p.items.reverse();assert.deepEqual(await evaluate(f,p),a);
});
test('HDW00b preexisting unlisted file cannot be hidden by preparing a new plan',async t=>{
 const f=await fixture(t);await writeFile(join(f.root,'extra.md'),'Private');const p=selected(await prepare(f)),r=await evaluate(f,p);assert.equal(r.status,'source_blocked');assert.equal(r.selected.items.length,0);forbidden(r);
});
test('HDW00b missing source cannot be replaced by another path with matching content',async t=>{
 const f=await fixture(t),p=selected(await prepare(f));p.sources[0].path='other.md';await assert.rejects(evaluate(f,p),{code:'knowledge_review_stale'});
});
test('HDW00b forced duplicate in an otherwise complete two-source plan is rejected',async t=>{
 const f=await fixture(t,{'a.md':body,'b.md':body}),p=selected(await prepare(f));p.sources[1]={...p.sources[0]};await assert.rejects(evaluate(f,p),{code:'knowledge_review_invalid'});
});
