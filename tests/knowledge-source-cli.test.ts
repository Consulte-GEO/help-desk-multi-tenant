import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const cli=fileURLToPath(new URL('../scripts/knowledge-source-audit.mjs',import.meta.url));
const at='2026-10-11T18:00:00.000Z';
const execute=(args:string[])=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000,maxBuffer:2000000});
async function fixture(t:any,body='# Source\n\n## Test\nNo private content.\n'){
 const dir=await mkdtemp(join(tmpdir(),'hdw00cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const root=join(dir,'wiki');await mkdir(root);await writeFile(join(root,'source.md'),body);
 const p={schemaVersion:1,corpusId:'synthetic',revision:1,status:'draft',sources:[{path:'source.md',sha256:createHash('sha256').update(body).digest('hex'),classification:'editorial',generation:'UNKNOWN',basis:['wiki_herdada'],target:null}]};const policy=join(dir,'policy.json');await writeFile(policy,JSON.stringify(p));return{root,policy,dir};
}
test('HDW00 CLI displays help without root, secret or network',()=>{const r=execute(['--help']);assert.equal(r.status,0);assert.match(r.stdout,/--root/);assert.match(r.stdout,/não publica/);});
test('HDW00 CLI returns exact read-only result and does not modify source bytes',async t=>{
 const f=await fixture(t);const b=await readFile(join(f.root,'source.md'));const r=execute(['--root',f.root,'--policy',f.policy,'--at',at]);assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);assert.equal(data.status,'review_required');assert.equal(data.publicationAllowed,false);assert.equal(data.observedAt,at);assert.deepEqual(await readFile(join(f.root,'source.md')),b);
});
test('HDW00 CLI blocks source with a synthetic crypto literal and never echoes it',async t=>{
 const secret=Buffer.alloc(32,9).toString('base64');const f=await fixture(t,`AddEncryptionKey(new SymmetricSecurityKey(Convert.FromBase64String("${secret}")));`);const r=execute(['--root',f.root,'--policy',f.policy]);assert.equal(r.status,2);assert.equal((r.stdout+r.stderr).includes(secret),false);assert.equal(JSON.parse(r.stdout).status,'blocked');
});
test('HDW00 CLI malformed JSON does not echo bytes or file path',async t=>{
 const f=await fixture(t);await writeFile(f.policy,'{"synthetic-private-marker":');const r=execute(['--root',f.root,'--policy',f.policy]);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr.includes('synthetic-private-marker'),false);assert.equal(r.stderr.includes(f.dir),false);
});
test('HDW00 CLI symbolic policy refused before reading',async t=>{
 const f=await fixture(t);const link=join(f.dir,'link.json');await symlink(f.policy,link);const r=execute(['--root',f.root,'--policy',link]);assert.equal(r.status,1);assert.equal(r.stdout,'');
});
test('HDW00 CLI oversized policy is not consumed as JSON',async t=>{
 const f=await fixture(t);await writeFile(f.policy,' '.repeat(262145));const r=execute(['--root',f.root,'--policy',f.policy]);assert.equal(r.status,1);assert.equal(r.stdout,'');
});
for(const args of [[],['--root'],['--execute'],['--publish'],['--root','x','--root','y','--policy','z'],['--help','--root','x'],['--root','x','--policy','z','--at','today']])test('HDW00 CLI refuses missing/unknown/duplicate arguments '+JSON.stringify(args),()=>{const r=execute(args);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Inspeção não concluída/);});
test('HDW00 CLI import has no execution, output, network or environment-driven action',()=>{
 const script=`await import(${JSON.stringify(new URL('../scripts/knowledge-source-audit.mjs',import.meta.url).href)}); console.log('imported')`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'imported');
});
