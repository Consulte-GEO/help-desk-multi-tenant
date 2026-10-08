import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const name of ['totp-qr.js','recovery-password.js','account-security.js','index.html','ticket-actions.js','human-auth.js','human-session.js','session-fetch.js','app.js','conversation-state.js','mutation-state.js','ticket-create-state.js','support-catalog-state.js','ticket-list-state.js','timeline-state.js','styles.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));

await mkdir(new URL('../dist/shared/',import.meta.url),{recursive:true});
await copyFile(new URL('../shared/instant.js',import.meta.url),new URL('../dist/shared/instant.js',import.meta.url));

await copyFile(new URL('../shared/mfa.js',import.meta.url),new URL('../dist/shared/mfa.js',import.meta.url));
console.log('Frontend estático criado em dist. O backend deve ser empacotado separadamente pelo Netlify.');

await mkdir(new URL('../dist/vendor/',import.meta.url),{recursive:true});
await copyFile(new URL('../web/vendor/qrcodegen.js',import.meta.url),new URL('../dist/vendor/qrcodegen.js',import.meta.url));
