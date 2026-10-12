import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,link} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../scripts/knowledge-editorial-review.mjs',import.meta.url));
const auditCli=fileURLToPath(new URL('../scripts/knowledge-source-audit.mjs',import.meta.url));
const at='2026-10-11T23:00:00.000Z';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function run(args:string[]){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});}
function parsed(r:any){assert.notEqual(r.status,null);return JSON.parse(r.stdout);}
async function fixture(t:any){const dir=await mkdtemp(join(tmpdir(),'hdw-review-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const root=join(dir,'wiki');await mkdir(root);
 const text='# FAQ\n\n## Uso\nTexto privado de teste.\n';await writeFile(join(root,'faq.md'),text);
 const policy=join(dir,'policy.json');await writeFile(policy,JSON.stringify({schemaVersion:1,corpusId:'wiki-test',status:'draft',revision:1,sources:[{path:'faq.md',sha256:hash(text),classification:'editorial',generation:'NOVO_GEO',basis:['wiki_herdada'],target:null}]}));return {dir,root,policy};}
const args=(f:any)=>['--root',f.root,'--policy',f.policy,'--at',at];
async function planFile(f:any,select=false){const r=run(['--mode','prepare',...args(f)]);assert.equal(r.status,0,r.stderr);const p=parsed(r);if(select){p.sources[0].action='review_candidates';p.items[0].action='select';}const path=join(f.dir,'review.json');await writeFile(path,JSON.stringify(p));return {path,p};}

test('HDW00b CLI help documents review-only behavior',()=>{const r=run(['--help']);assert.equal(r.status,0);assert.match(r.stdout,/não publica/i);assert.equal(r.stderr,'');});
test('HDW00b CLI prepare and check end to end leave corpus untouched',async t=>{
 const f=await fixture(t),before=await readFile(join(f.root,'faq.md'));const {path}=await planFile(f,true);const r=run(['--mode','check',...args(f),'--review',path]);assert.equal(r.status,0,r.stderr);
 const p=parsed(r);assert.equal(p.status,'private_selection_prepared');assert.equal(p.selected.items.length,1);assert.equal(p.publicationAllowed,false);assert.equal(r.stdout.includes('Texto privado'),false);assert.deepEqual(await readFile(join(f.root,'faq.md')),before);
});
test('HDW00b CLI draft check exits 2 instead of implying completed review',async t=>{
 const f=await fixture(t),{path}=await planFile(f);const r=run(['--mode','check',...args(f),'--review',path]);assert.equal(r.status,2);assert.equal(parsed(r).status,'review_incomplete');
});
for(const extra of [[],['--mode','auto'],['--mode','prepare','--root','/absent'],['--mode','prepare','--help'],['--mode','prepare','--mode','prepare']])test('HDW00b CLI rejects argument variant '+JSON.stringify(extra),()=>{const r=run(extra);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Revisão não concluída/);assert.equal(r.stderr.includes('/absent'),false);});
test('HDW00b CLI prepare refuses a review argument; check requires one',async t=>{
 const f=await fixture(t);for(const a of [['--mode','prepare',...args(f),'--review','private-marker'],['--mode','check',...args(f)]]){const r=run(a);assert.equal(r.status,1);assert.match(r.stderr,/Revisão não concluída/);assert.equal(r.stderr.includes('private-marker'),false);}
});
test('HDW00b CLI stale plan returns a safe code, not source values',async t=>{
 const f=await fixture(t),{path}=await planFile(f,true);await writeFile(join(f.root,'faq.md'),'private-marker');const r=run(['--mode','check',...args(f),'--review',path]);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/knowledge_review_stale/);assert.equal(r.stderr.includes('private-marker'),false);
});
for(const kind of ['invalid-json','extra-field','oversized','directory','symlink','hardlink'] as const)test('HDW00b CLI refuses '+kind+' review input',async t=>{
 const f=await fixture(t),data=await planFile(f);let path=data.path;
 if(kind==='invalid-json')await writeFile(path,'{private-marker');
 if(kind==='extra-field')await writeFile(path,JSON.stringify({...data.p,secret:'private-marker'}));
 if(kind==='oversized')await writeFile(path,' '.repeat(4194305));
 if(kind==='directory')path=f.root;
 if(kind==='symlink'){path=join(f.dir,'linked.json');await symlink(data.path,path);}
 if(kind==='hardlink'){path=join(f.dir,'hard.json');await link(data.path,path);}
 const r=run(['--mode','check',...args(f),'--review',path]);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr.includes('private-marker'),false);assert.equal(r.stderr.includes(f.dir),false);
});
test('HDW00b CLI rejects policy symlink for both new and existing commands',async t=>{
 const f=await fixture(t),path=join(f.dir,'policy-link.json');await symlink(f.policy,path);
 for(const executable of [cli,auditCli]){const a=['--root',f.root,'--policy',path];if(executable===cli)a.unshift('--mode','prepare');const r=spawnSync(process.execPath,[executable,...a],{encoding:'utf8'});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,executable===cli?/Revisão não concluída/:/Inspeção não concluída/);}
});
test('HDW00b importing CLI modules does not run file reads or print output',()=>{
 const script=`await import(${JSON.stringify(new URL('../scripts/knowledge-editorial-review.mjs',import.meta.url).href)});await import(${JSON.stringify(new URL('../scripts/knowledge-local-input.mjs',import.meta.url).href)});`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
});
test('HDW00b same real input yields identical prepare JSON on repeated invocation',async t=>{
 const f=await fixture(t),a=run(['--mode','prepare',...args(f)]),b=run(['--mode','prepare',...args(f)]);assert.equal(a.status,0,a.stderr);assert.equal(a.stdout,b.stdout);
});
