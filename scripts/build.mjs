import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const name of ['access-mode.js','totp-qr.js','recovery-password.js','account-security.js','index.html','ticket-actions.js','human-auth.js','human-session.js','session-fetch.js','app.js','conversation-state.js','mutation-state.js','ticket-create-state.js','support-catalog-state.js','ticket-list-state.js','timeline-state.js','styles.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

await mkdir(new URL('../dist/shared/',import.meta.url),{recursive:true});
await copyFile(new URL('../shared/instant.js',import.meta.url),new URL('../dist/shared/instant.js',import.meta.url));

await copyFile(new URL('../shared/mfa.js',import.meta.url),new URL('../dist/shared/mfa.js',import.meta.url));
console.log('Frontend estático criado em dist. O backend deve ser empacotado separadamente pelo Netlify.');

await mkdir(new URL('../dist/vendor/',import.meta.url),{recursive:true});
await copyFile(new URL('../web/vendor/qrcodegen.js',import.meta.url),new URL('../dist/vendor/qrcodegen.js',import.meta.url));

// Optional form components: copying assets does not mount or authorize the feature.
for(const name of ['dynamic-form.js','admin-forms.js','dynamic-form.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
for(const name of ['form-rules.js','cnpj.js'])await copyFile(new URL('../shared/'+name,import.meta.url),new URL('../dist/shared/'+name,import.meta.url));
// Optional C09/C10 components. Copying does not mount Storage, scanner or intake.
for(const name of ['attachments.js','support-intake.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
// Optional C11/C12 panels. Copying never mounts endpoints or enables delivery.
for(const name of ['review-state.js','approvals.js','form-review.js','delivery-operations.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// Optional C13/C14 surfaces; copying does not enable routes, providers or cohort.
for(const name of ['portal-state.js','customer-portal.js','support-queue.js','ticket-detail.js','reports.js','portal.css','optional-support.js','portal-format.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
// Optional internal checklist assets. Draft templates, SQL and fixtures stay private.
for(const name of ['execution-checklist.js','execution-checklist-state.js','execution-checklist-contract.js','execution-checklist.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
await copyFile(new URL('../shared/checklist-evidence.js',import.meta.url),new URL('../dist/shared/checklist-evidence.js',import.meta.url));
// Optional Consulte GEO configuration editor; no publication/runtime is enabled by copying.
for(const name of ['consultegeo-configuration.js','consultegeo-configuration.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
