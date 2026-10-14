import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const name of ['support-navigation.js','access-mode.js','totp-qr.js','recovery-password.js','account-security.js','index.html','ticket-actions.js','human-auth.js','human-session.js','session-fetch.js','app.js','conversation-state.js','mutation-state.js','ticket-create-state.js','support-catalog-state.js','ticket-list-state.js','timeline-state.js','styles.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

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

// UX01 presentation only: no feature is mounted or authorized by copying these assets.
for(const name of ['brand-profile.js','brand-shell.js','theme-init.js','design-tokens.css','consulte-theme.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
await mkdir(new URL('../dist/assets/',import.meta.url),{recursive:true});
for(const name of ['consulte-geo-color.png','consulte-geo-white.png'])await copyFile(new URL('../web/assets/'+name,import.meta.url),new URL('../dist/assets/'+name,import.meta.url));

// UX02: presentation only; auth, business APIs and gates remain unchanged.
for(const name of ['inbox-view-state.js','inbox-workspace.js','inbox-workspace.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX03: presentation only. No new API, providers, domain forms or feature activation.
for(const name of ['opening-flow.js','opening-wizard.js','form-feedback.js','form-experience.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX04: optional presentation assets only; no feature/capability is enabled here.
for(const name of ['portal-ui.js','support-intake.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX05: optional admin presentation only. Copying never enables a route or capability.
for(const name of ['admin-ui.js','admin-experience.css','admin-members.js','admin-members-state.js','admin-members.css','admin-configuration.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX06: optional presentation only. No Auth, scanner, delivery or business route is enabled.
for(const name of ['operations-ui.js','operations-experience.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX07: optional support presentation; no knowledge publication, download or vote on mount.
for(const name of ['support-presentation.js','support-experience.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX08: access presentation. GEO callback is an optional asset, never auto-mounted.
for(const name of ['access-feedback.js','access-experience.js','access-experience.css','geo-auth-callback.js','geo-auth-state.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

// UX10 merge: retain M04/M09 assets from the operational branch. No route is mounted here.
for(const name of ['consultegeo-configuration.js','consultegeo-configuration.css','consultegeo-request.js','consultegeo-request.css','consultegeo-intake-api.js'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
await copyFile(new URL('../shared/consultegeo-request.js',import.meta.url),new URL('../dist/shared/consultegeo-request.js',import.meta.url));
