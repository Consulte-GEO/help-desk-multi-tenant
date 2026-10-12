import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const legacy=['access-mode.js','totp-qr.js','recovery-password.js','account-security.js','index.html','ticket-actions.js','human-auth.js','human-session.js','session-fetch.js','app.js','conversation-state.js','mutation-state.js','ticket-create-state.js','support-catalog-state.js','ticket-list-state.js','timeline-state.js','styles.css','vendor/qrcodegen.js'];
/** Tests actual build program with OWNED fixture files. Not a build of the complete app. */
test('C07 build whitelist copies new form assets byte-for-byte and preserves old assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'helpdesk-forms-build-'));
 try{for(const path of ['scripts','web/vendor','shared'])await mkdir(join(root,path),{recursive:true});
  await writeFile(join(root,'scripts/build.mjs'),await readFile(new URL('../scripts/build.mjs',import.meta.url)));
  for(const path of legacy)await writeFile(join(root,'web',path),'owned-legacy-fixture:'+path);
  for(const path of ['instant.js','mfa.js'])await writeFile(join(root,'shared',path),'owned-shared-fixture:'+path);
  const added=['web/dynamic-form.js','web/admin-forms.js','web/dynamic-form.css','shared/form-rules.js','shared/cnpj.js','web/attachments.js','web/support-intake.js','web/review-state.js','web/approvals.js','web/form-review.js','web/delivery-operations.js','web/portal-state.js','web/customer-portal.js','web/support-queue.js','web/ticket-detail.js','web/reports.js','web/portal.css','web/optional-support.js','web/portal-format.js'];
  for(const path of added)await writeFile(join(root,path),await readFile(new URL('../'+path,import.meta.url)));
  await writeFile(join(root,'web/unlisted-private.txt'),'MUST NOT COPY');
  const r=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
  for(const path of added){const target=path.startsWith('web/')?path.slice(4):path;assert.deepEqual(await readFile(join(root,'dist',target)),await readFile(join(root,path)));}
  for(const path of legacy)assert.equal(await readFile(join(root,'dist',path),'utf8'),'owned-legacy-fixture:'+path);
  await assert.rejects(access(join(root,'dist/unlisted-private.txt')));
 }finally{await rm(root,{recursive:true,force:true});}
});
