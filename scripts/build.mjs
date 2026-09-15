import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const name of ['index.html','app.js','styles.css'])await copyFile(new URL('../web/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
console.log('Frontend estático criado em dist. O backend deve ser empacotado separadamente pelo Netlify.');
