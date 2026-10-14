import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('visual demo allowlist serves every CSS entry with text/css under nosniff',()=>{
 const code=read('scripts/demo.ts');const loops=[...code.matchAll(/for\(const file of \[[^\]]+\]\) assets\['\/'\+file\]=\{file,type:'[^']+'\};/g)].map(m=>m[0]).join('\n');
 assert.ok(loops.length);const assets:Record<string,{type:string}>={};runInNewContext(loops,{assets});
 for(const [name,a] of Object.entries(assets))if(name.endsWith('.css'))assert.equal(a.type,'text/css; charset=utf-8',name);
});
test('UX03 presentation assets are published with explicit file allowlists',()=>{
 const build=read('scripts/build.mjs'),demo=read('scripts/demo.ts');
 for(const name of ['opening-flow.js','opening-wizard.js','form-feedback.js','form-experience.css']){assert.ok(build.includes("'"+name+"'"),'build '+name);assert.ok(demo.includes("'"+name+"'"),'demo '+name);}
 assert.match(read('web/index.html'),/href="\/form-experience.css"/);
});
test('UX03 modules cannot issue requests, allocate business keys or store form data',()=>{
 for(const name of ['opening-flow.js','opening-wizard.js','form-feedback.js']){
  const s=read('web/'+name);assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|randomUUID\s*\(|innerHTML\s*=|outerHTML\s*=/);
 }
});
