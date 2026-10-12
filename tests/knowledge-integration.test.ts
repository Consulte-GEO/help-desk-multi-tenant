import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,basename,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {auditKnowledgeSource} from '../scripts/knowledge-source-audit-core.mjs';
import {readPrivateKnowledgeJson,samePrivateKnowledgePath} from '../scripts/knowledge-local-input.mjs';
// The existing homologation module is JavaScript without a declaration.
const {sourceFingerprint}=await import('../scripts/'+'homologation-core.mjs');
const {sourceLinks}=await import('../scripts/'+'knowledge-source-safety.mjs');

async function fixture(t:any){
 const dir=await mkdtemp(join(tmpdir(),'hdw-integration-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const root=join(dir,'wiki');await mkdir(root);
 const text='# FAQ\n\n## Uso\nConteúdo sintético.\n';await writeFile(join(root,'faq.md'),text);
 const policy={schemaVersion:1,corpusId:'synthetic',revision:1,status:'draft',sources:[{path:'faq.md',sha256:createHash('sha256').update(text).digest('hex'),classification:'editorial',generation:'UNKNOWN',basis:['wiki_herdada'],target:null}]};
 return {dir,root,policy};
}

test('HDW audit respects platform path casing without accepting a different directory',async t=>{
 const f=await fixture(t),alternate=join(dirname(f.root),basename(f.root).toUpperCase());
 if(process.platform==='win32'){
  const original=await auditKnowledgeSource(f.root,f.policy,{at:'2026-10-12T12:00:00.000Z'});
  assert.deepEqual(await auditKnowledgeSource(alternate,f.policy,{at:original.observedAt}),original);
  assert.deepEqual(await auditKnowledgeSource(f.root[0]!.toLowerCase()+f.root.slice(1),f.policy,{at:original.observedAt}),original);
 }else await assert.rejects(()=>auditKnowledgeSource(alternate,f.policy));
 await assert.rejects(()=>auditKnowledgeSource(join(f.dir,'different'),f.policy));
});

test('HDW private JSON respects platform path casing and still rejects absent files',async t=>{
 const f=await fixture(t),path=join(f.dir,'Policy.json');await writeFile(path,JSON.stringify(f.policy));
 const alternate=join(f.dir,'policy.json');
 if(process.platform==='win32')assert.deepEqual(await readPrivateKnowledgeJson(alternate),f.policy);
 else await assert.rejects(()=>readPrivateKnowledgeJson(alternate));
 await assert.rejects(()=>readPrivateKnowledgeJson(join(f.dir,'absent.json')));
});

test('HDW canonical paths never fold distinct Unicode directory names into an alias',()=>{
 assert.equal(samePrivateKnowledgePath('C:/private/k/p.json','C:/private/K/p.json'),false);
});

test('homologation binds editorial policy and delivered decisions to the source',async t=>{
 const f=await fixture(t),root=f.dir,knowledge=join(root,'docs','knowledge','consultegeo');
 await mkdir(knowledge,{recursive:true});
 const before=await sourceFingerprint(root);
 const policy=join(knowledge,'source-policy-v3.json');await writeFile(policy,JSON.stringify(f.policy));
 const added=await sourceFingerprint(root);assert.notEqual(added,before);
 await writeFile(policy,JSON.stringify({...f.policy,revision:2}));
 const changed=await sourceFingerprint(root);assert.notEqual(changed,added);
 await writeFile(join(knowledge,'editorial-review-plan-v3.json'),'{"action":"pending"}');
 assert.notEqual(await sourceFingerprint(root),changed);
});

test('HDW link inspection refuses a hostile long line before regex scanning',()=>{
 assert.throws(()=>sourceLinks('['.repeat(65536),'faq.md',new Map()),/link_limit/);
});

test('HDW audit blocks sources exceeding the link line budget without leaking the text',async t=>{
 const f=await fixture(t),text='['.repeat(65536);
 await writeFile(join(f.root,'faq.md'),text);
 f.policy.sources[0]!.sha256=createHash('sha256').update(text).digest('hex');
 const audit=await auditKnowledgeSource(f.root,f.policy);
 assert.equal(audit.complete,false);assert.equal(audit.status,'blocked');
 assert.equal(audit.candidateBatch.items.length,0);
 assert.ok(audit.documents[0]!.findings.some(f=>f.code==='source_link_limit'));
 assert.equal(JSON.stringify(audit).includes('['.repeat(50)),false);
});

test('HDW audit refuses a corpus exceeding the shared link metadata budget',async t=>{
 const f=await fixture(t),text='[ok](faq.md)\n'.repeat(6000),digest=createHash('sha256').update(text).digest('hex');
 await writeFile(join(f.root,'faq.md'),text);await writeFile(join(f.root,'second.md'),text);
 f.policy.sources=[{...f.policy.sources[0]!,sha256:digest},{...f.policy.sources[0]!,path:'second.md',sha256:digest}];
 await assert.rejects(()=>auditKnowledgeSource(f.root,f.policy),{code:'knowledge_source_unavailable'});
});
