import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const legacy=['access-mode.js','totp-qr.js','recovery-password.js','account-security.js','index.html','ticket-actions.js','human-auth.js','human-session.js','session-fetch.js','app.js','conversation-state.js','mutation-state.js','ticket-create-state.js','support-catalog-state.js','ticket-list-state.js','timeline-state.js','styles.css','vendor/qrcodegen.js'];
/** Tests actual build program with OWNED fixture files. Not a build of the complete app. */
test('C07 build whitelist copies new form assets byte-for-byte and preserves old assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'helpdesk-forms-build-'));
 try{for(const path of ['scripts','web/vendor','web/assets','shared'])await mkdir(join(root,path),{recursive:true});
  await writeFile(join(root,'scripts/build.mjs'),await readFile(new URL('../scripts/build.mjs',import.meta.url)));
  await writeFile(join(root,'scripts/implantacao-assets.mjs'),await readFile(new URL('../scripts/implantacao-assets.mjs',import.meta.url)));
  await mkdir(join(root,'modules/implantacao/frontend/dist-support'),{recursive:true});
  await writeFile(join(root,'modules/implantacao/frontend/dist-support/support-app.js'),'owned-module-fixture');
  for(const path of [...legacy,'support-navigation.js'])await writeFile(join(root,'web',path),'owned-legacy-fixture:'+path);
  for(const path of ['instant.js','mfa.js'])await writeFile(join(root,'shared',path),'owned-shared-fixture:'+path);
  const added=['web/dynamic-form.js','web/admin-forms.js','web/dynamic-form.css','shared/form-rules.js','shared/cnpj.js','web/attachments.js','web/support-intake.js','web/review-state.js','web/approvals.js','web/form-review.js','web/delivery-operations.js','web/portal-state.js','web/customer-portal.js','web/support-queue.js','web/ticket-detail.js','web/reports.js','web/portal.css','web/optional-support.js','web/portal-format.js'];
  added.push('web/email-monitor.js','web/email-monitor.css');
  added.push('web/ticket-views.js');
  added.push('web/ticket-summary-state.js','shared/ticket-summary.js');
  added.push('web/consultegeo-request.js','web/consultegeo-request.css','web/consultegeo-intake-api.js','shared/consultegeo-request.js');
  added.push('web/execution-checklist.js','web/execution-checklist-state.js','web/execution-checklist-contract.js','web/execution-checklist.css','shared/checklist-evidence.js');
  added.push('web/consultegeo-configuration.js','web/consultegeo-configuration.css');
  added.push('web/implementation-support.js','web/implementation-support.css');
  added.push('shared/consultegeo-ticket.js','web/support-intake.css','web/consultegeo-operation.js','web/consultegeo-workflow.js','web/consultegeo-review.js','web/consultegeo-operation.css','web/response-diagnostic.js','web/version-receipt.js');
  added.push(...['brand-profile.js','brand-shell.js','inbox-view-state.js','inbox-workspace.js','theme-init.js','opening-flow.js','opening-wizard.js','form-feedback.js','portal-ui.js','admin-ui.js','admin-members.js','admin-members-state.js','admin-configuration.js','operations-ui.js','support-presentation.js','access-feedback.js','access-experience.js','geo-auth-callback.js','geo-auth-state.js','design-tokens.css','consulte-theme.css','inbox-workspace.css','form-experience.css','admin-experience.css','admin-members.css','operations-experience.css','support-experience.css','access-experience.css','assets/consulte-geo-color.png','assets/consulte-geo-white.png'].map(p=>'web/'+p));
  for(const path of added)await writeFile(join(root,path),await readFile(new URL('../'+path,import.meta.url)));
  await mkdir(join(root,'profiles','consultegeo'),{recursive:true});
  await writeFile(join(root,'profiles','consultegeo','execution-checklists.draft.json'),'PRIVATE DRAFT: MUST NOT COPY');
  await mkdir(join(root,'supabase','candidates'),{recursive:true});
  await writeFile(join(root,'supabase','candidates','hdn_execution_checklist.sql'),'PRIVATE SQL: MUST NOT COPY');
  await writeFile(join(root,'web/unlisted-private.txt'),'MUST NOT COPY');
  const r=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
  for(const path of added){const target=path.startsWith('web/')?path.slice(4):path;assert.deepEqual(await readFile(join(root,'dist',target)),await readFile(join(root,path)));}
  for(const path of legacy)assert.equal(await readFile(join(root,'dist',path),'utf8'),'owned-legacy-fixture:'+path);
  await assert.rejects(access(join(root,'dist/unlisted-private.txt')));
  await assert.rejects(access(join(root,'dist/profiles')));
  await assert.rejects(access(join(root,'dist/supabase')));
  assert.equal(await readFile(join(root,'dist/implantacao/support-app.js'),'utf8'),'owned-module-fixture');
 }finally{await rm(root,{recursive:true,force:true});}
});
